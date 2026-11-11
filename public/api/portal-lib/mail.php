<?php
/**
 * Website Plan portal: email.
 *
 * Every message the portal sends is written here, so the whole sequence a
 * client receives can be read in one place. The portal does the talking:
 * each email points back to the portal rather than inviting a reply thread.
 */
declare(strict_types=1);

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

function px_mail_header_safe(string $v): string
{
    return trim(str_replace(["\r", "\n"], ' ', $v));
}

function px_mail_encode_header(string $v): string
{
    $v = px_mail_header_safe($v);
    return preg_match('/[^\x20-\x7E]/', $v) ? '=?UTF-8?B?' . base64_encode($v) . '?=' : $v;
}

/** Builds a multipart/alternative message (plain text plus HTML). */
function px_mail_build(string $to, string $subject, string $text, string $html): array
{
    $from = px_mail_header_safe((string) px_cfg('mail.from'));
    $fromName = (string) px_cfg('mail.from_name', 'Position Xero');
    $boundary = 'pxb_' . px_token(12);
    $host = parse_url(px_site_url(), PHP_URL_HOST) ?: 'positionxero.com';
    $headers = [
        'From: ' . px_mail_encode_header($fromName) . " <{$from}>",
        'To: <' . px_mail_header_safe($to) . '>',
        'Subject: ' . px_mail_encode_header($subject),
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: <' . px_token(10) . '@' . $host . '>',
        'MIME-Version: 1.0',
        "Content-Type: multipart/alternative; boundary=\"{$boundary}\"",
    ];
    $norm = fn (string $s) => str_replace("\n", "\r\n", str_replace(["\r\n", "\r"], "\n", $s));
    $body = "--{$boundary}\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
        . quoted_printable_encode($norm($text)) . "\r\n"
        . "--{$boundary}\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n"
        . quoted_printable_encode($norm($html)) . "\r\n"
        . "--{$boundary}--\r\n";
    return [$headers, $body];
}

function px_mail_send(string $to, string $subject, string $text, string $html): bool
{
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    [$headers, $body] = px_mail_build($to, $subject, $text, $html);
    $mode = (string) px_cfg('mail.mode', 'log');

    if ($mode === 'smtp') {
        $smtp = (array) px_cfg('mail.smtp', []);
        $pwFile = (string) ($smtp['password_file'] ?? '');
        $password = ($pwFile !== '' && is_readable($pwFile)) ? trim((string) file_get_contents($pwFile)) : '';
        if ($password === '') {
            px_log('mail', "SMTP password file missing, message to {$to} logged instead");
        } else {
            $ok = px_smtp_send(
                (string) ($smtp['host'] ?? 'smtp.hostinger.com'),
                (int) ($smtp['port'] ?? 465),
                (string) ($smtp['user'] ?? px_cfg('mail.from')),
                $password,
                (string) px_cfg('mail.from'),
                $to,
                implode("\r\n", $headers) . "\r\n\r\n" . $body
            );
            px_log('mail', ($ok ? 'sent' : 'FAILED') . " smtp to={$to} subject={$subject}");
            if ($ok) {
                return true;
            }
        }
    } elseif ($mode === 'mail') {
        $hdrs = array_values(array_filter($headers, fn ($h) => !str_starts_with($h, 'To:') && !str_starts_with($h, 'Subject:')));
        $ok = @mail($to, px_mail_encode_header($subject), $body, implode("\r\n", $hdrs));
        px_log('mail', ($ok ? 'sent' : 'FAILED') . " mail() to={$to} subject={$subject}");
        if ($ok) {
            return true;
        }
    }

    // 'log' mode, or a failed send: keep the message so nothing is lost.
    $dir = px_data_dir('mail');
    $name = date('Ymd-His') . '-' . substr(px_token(3), 0, 6);
    file_put_contents("{$dir}/{$name}.eml", implode("\r\n", $headers) . "\r\n\r\n" . $body);
    file_put_contents("{$dir}/{$name}.json", json_encode([
        'to' => $to, 'subject' => $subject, 'text' => $text, 'at' => px_now(), 'mode' => $mode,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    if ($mode === 'log') {
        px_log('mail', "logged to={$to} subject={$subject}");
    }
    return $mode === 'log';
}

/** Logs in to the mailbox and sends one message. Port 465 is TLS from the start. */
function px_smtp_send(string $host, int $port, string $user, string $password, string $from, string $to, string $message): bool
{
    $context = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host]]);
    $scheme = $port === 465 ? 'ssl' : 'tcp';
    $socket = @stream_socket_client("{$scheme}://{$host}:{$port}", $errno, $errstr, 10, STREAM_CLIENT_CONNECT, $context);
    if ($socket === false) {
        px_log('mail', "SMTP could not connect to {$host}:{$port}: {$errstr}");
        return false;
    }
    stream_set_timeout($socket, 15);
    $step = static function (?string $command, int $expect, string $label) use ($socket): bool {
        if ($command !== null) {
            fwrite($socket, $command . "\r\n");
        }
        $reply = '';
        while (($line = fgets($socket, 1024)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }
        if ((int) substr($reply, 0, 3) === $expect) {
            return true;
        }
        px_log('mail', "SMTP {$label} failed: " . trim((string) strtok($reply, "\r\n")));
        return false;
    };
    $data = preg_replace('/^\./m', '..', $message) ?? $message;
    $sent = $step(null, 220, 'greeting')
        && $step('EHLO ' . (gethostname() ?: 'localhost'), 250, 'EHLO')
        && $step('AUTH LOGIN', 334, 'AUTH')
        && $step(base64_encode($user), 334, 'username')
        && $step(base64_encode($password), 235, 'login')
        && $step("MAIL FROM:<{$from}>", 250, 'MAIL FROM')
        && $step("RCPT TO:<{$to}>", 250, 'RCPT TO')
        && $step('DATA', 354, 'DATA')
        && $step($data . "\r\n.", 250, 'message');
    fwrite($socket, "QUIT\r\n");
    fclose($socket);
    return $sent;
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

function px_h(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/**
 * Renders one email from simple blocks so the HTML and plain text versions
 * always say the same thing. Block types: p, button, list, kv, small.
 */
function px_mail_render(string $heading, array $blocks): array
{
    $text = $heading . "\n" . str_repeat('=', min(60, mb_strlen($heading))) . "\n\n";
    $html = '';
    foreach ($blocks as $b) {
        [$type, $value] = $b;
        switch ($type) {
            case 'p':
                $text .= wordwrap($value, 76) . "\n\n";
                $html .= '<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#D6DDE3;">' . px_h($value) . '</p>';
                break;
            case 'small':
                $text .= wordwrap($value, 76) . "\n\n";
                $html .= '<p style="margin:0 0 14px;font-size:13px;line-height:1.7;color:#8A949D;">' . px_h($value) . '</p>';
                break;
            case 'button':
                [$label, $url] = $value;
                $text .= "{$label}:\n{$url}\n\n";
                $html .= '<p style="margin:24px 0 26px;"><a href="' . px_h($url) . '" style="display:inline-block;background:#FF6A1F;color:#05070A;text-decoration:none;font-family:Menlo,Consolas,monospace;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;padding:14px 26px;border-radius:999px;">' . px_h($label) . ' &rarr;</a></p>';
                break;
            case 'list':
                $html .= '<ul style="margin:0 0 18px;padding-left:20px;color:#D6DDE3;font-size:15px;line-height:1.7;">';
                foreach ($value as $item) {
                    $text .= "  - {$item}\n";
                    $html .= '<li style="margin:0 0 6px;">' . px_h($item) . '</li>';
                }
                $text .= "\n";
                $html .= '</ul>';
                break;
            case 'kv':
                $html .= '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-top:1px solid #1A2129;">';
                foreach ($value as $k => $v) {
                    $text .= "{$k}: {$v}\n";
                    $html .= '<tr><td style="padding:10px 0;border-bottom:1px solid #1A2129;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8A949D;width:42%;">' . px_h($k) . '</td><td style="padding:10px 0;border-bottom:1px solid #1A2129;font-size:15px;color:#F2F5F7;">' . px_h($v) . '</td></tr>';
                }
                $text .= "\n";
                $html .= '</table>';
                break;
        }
    }
    $text .= "Position Xero\n" . px_site_url() . "/portal/\n";

    $doc = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>' . px_h($heading) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#05070A;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070A;"><tr><td align="center" style="padding:32px 16px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;">'
        . '<tr><td style="padding:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:16px;letter-spacing:0.08em;text-transform:uppercase;color:#F2F5F7;">Position <span style="color:#A3AEB8;">Xero</span></td></tr>'
        . '<tr><td style="background:#090D12;border:1px solid #1A2129;border-radius:2px;padding:32px 28px;">'
        . '<h1 style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.25;color:#F2F5F7;">' . px_h($heading) . '</h1>'
        . $html
        . '</td></tr>'
        . '<tr><td style="padding:20px 4px 0;font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.06em;color:#8A949D;line-height:1.7;">Position Xero &middot; Web Development &amp; SEO &middot; Centurion, Gauteng<br><a href="' . px_h(px_site_url() . '/portal/') . '" style="color:#2EE6FF;">Your client portal</a></td></tr>'
        . '</table></td></tr></table></body></html>';

    return [$text, $doc];
}

/* ------------------------------------------------------------------ */
/* The messages                                                        */
/* ------------------------------------------------------------------ */

/** Sends one of the client emails below. Returns false if the template is unknown. */
function px_notify_client(array $client, string $template, array $v = []): bool
{
    $portal = px_site_url() . '/portal/';
    $first = $client['first_name'];
    $plan = (string) px_cfg('plan.name', 'Website Plan');

    switch ($template) {
        case 'account_link':
            $subject = 'Debit order signed. Create your portal account';
            [$t, $h] = px_mail_render("You're in, {$first}", [
                ['p', "Your debit order for the {$plan} is signed. Next, create your account. It is where you send us your logo, photos and brand details, and where you'll see your website come together."],
                ['button', ['Create your account', $v['link']]],
                ['kv', [
                    'Plan' => $plan . ', ' . px_money((int) $client['amount_cents']) . ' a month',
                    'First debit' => $v['first_debit'] ?? '',
                    'Reference' => $client['ref'],
                ]],
                ['small', 'This link works for 7 days. If it runs out, sign up again with the same email address and we will pick up where you left off.'],
            ]);
            break;

        case 'mandate_declined':
            $subject = 'Your debit order was not approved';
            [$t, $h] = px_mail_render('The debit order did not go through', [
                ['p', "Hi {$first}. The debit order for the {$plan} was not approved" . (!empty($v['reason']) ? " ({$v['reason']})" : '') . '. Nothing has been taken from your account.'],
                ['p', 'You can try again with the same or a different bank account.'],
                ['button', ['Try again', px_site_url() . '/start/']],
            ]);
            break;

        case 'bank_updated':
            $subject = 'Your new debit order is signed';
            [$t, $h] = px_mail_render('Bank details updated', [
                ['p', "Hi {$first}. Your new debit order is signed, and future debits for the {$plan} come off the new account."],
                ['kv', ['Next debit' => $v['next_debit'] ?? '', 'Amount' => px_money((int) $client['amount_cents'])]],
                ['button', ['Open your portal', $portal]],
            ]);
            break;

        case 'brief_received':
            $subject = 'We have your website brief';
            [$t, $h] = px_mail_render('Brief received. Building starts now', [
                ['p', "Thanks {$first}. Your brief for {$client['business_name']} is with the build team. You do not need to do anything else for now."],
                ['p', 'When the first version of your site is ready, you will get an email with a preview link. You can approve it or ask for changes straight from the portal.'],
                ['button', ['See your progress', $portal]],
            ]);
            break;

        case 'stage_review':
            $subject = 'Your website preview is ready';
            [$t, $h] = px_mail_render('Your preview is ready to look at', [
                ['p', "Hi {$first}. The first version of the {$client['business_name']} website is up on a private preview link."],
                ['p', 'Have a look on your phone and on a computer. Then, in the portal, either approve it to go live or tell us what to change. Put every change into one message; it is faster for everyone.'],
                ['button', ['Review your site', $portal]],
                ['small', 'Preview link: ' . ($client['preview_url'] ?: 'in your portal')],
            ]);
            break;

        case 'stage_live':
            $subject = 'Your website is live';
            [$t, $h] = px_mail_render('Your website is live', [
                ['p', "{$client['business_name']} is live" . ($client['live_url'] ? " at {$client['live_url']}" : '') . '. From here we keep it running: security updates, backups, the SEO basics and a monthly look at your Google Analytics.'],
                ['p', 'Each month you can send us ' . (int) px_cfg('plan.changes_per_month', 2) . ' changes from the portal: new text, new photos, a new section, a price update. If something ever breaks, report it as a problem. Fixes never count towards your changes.'],
                ['button', ['Open your portal', $portal]],
            ]);
            break;

        case 'request_received':
            $isProblem = $v['type'] === 'problem';
            $subject = $isProblem ? 'We have your problem report' : 'We have your change request';
            [$t, $h] = px_mail_render($isProblem ? 'Problem report received' : 'Change request received', [
                ['p', "Hi {$first}. We have \"{$v['title']}\" and it is in the queue. You will get an email when it is done, and you can follow it in the portal."],
                $isProblem
                    ? ['small', 'Problem reports never count towards your monthly changes.']
                    : ['small', "Changes left this month: {$v['left']} of {$v['allowed']}."],
                ['button', ['Track it in the portal', $portal]],
            ]);
            break;

        case 'request_done':
            $subject = 'Done: ' . $v['title'];
            $blocks = [['p', "Hi {$first}. \"{$v['title']}\" is done."]];
            if (!empty($v['note'])) {
                $blocks[] = ['p', 'Note from the team: ' . $v['note']];
            }
            $blocks[] = ['button', ['See it in the portal', $portal]];
            [$t, $h] = px_mail_render('Your request is done', $blocks);
            break;

        case 'request_declined':
            $subject = 'About your request: ' . $v['title'];
            [$t, $h] = px_mail_render('We could not do this one as asked', [
                ['p', "Hi {$first}. We have not gone ahead with \"{$v['title']}\"."],
                ['p', 'Why: ' . ($v['note'] ?: 'the team left a note in your portal.')],
                ['small', 'It does not count towards your monthly changes.'],
                ['button', ['Open your portal', $portal]],
            ]);
            break;

        case 'care_report':
            $subject = 'Your website report for ' . $v['month_label'];
            $items = array_map(fn ($r) => $r['text'] . ($r['metric_label'] ? " ({$r['metric_label']}: {$r['metric_value']})" : ''), $v['items']);
            [$t, $h] = px_mail_render('What we did on your site in ' . $v['month_label'], [
                ['p', "Hi {$first}. Here is the work done on the {$client['business_name']} website this month."],
                ['list', $items ?: ['Routine checks only this month.']],
                ['button', ['Full report in the portal', $portal]],
            ]);
            break;

        case 'password_reset':
            $subject = 'Reset your portal password';
            [$t, $h] = px_mail_render('Reset your password', [
                ['p', "Hi {$first}. Someone asked to reset the password for your Position Xero portal. If it was you, use the button below. It works for one hour."],
                ['button', ['Choose a new password', $v['link']]],
                ['small', 'If it was not you, ignore this email. Your password stays as it is.'],
            ]);
            break;

        case 'cancel_received':
            $subject = 'We have your cancellation request';
            [$t, $h] = px_mail_render('Cancellation request received', [
                ['p', "Hi {$first}. We have your request to cancel the {$plan}. We will confirm the last debit date and what happens to your site and domain by email."],
                ['button', ['Open your portal', $portal]],
            ]);
            break;

        default:
            return false;
    }
    return px_mail_send($client['email'], $subject, $t, $h);
}

/** A short note to the team inbox. $lines are label => value pairs. */
function px_notify_team(string $subject, array $lines, ?string $link = null): void
{
    $blocks = [['kv', $lines]];
    if ($link) {
        $blocks[] = ['button', ['Open in admin', $link]];
    }
    [$t, $h] = px_mail_render($subject, $blocks);
    foreach ((array) px_cfg('mail.team', []) as $to) {
        px_mail_send((string) $to, '[Website Plan] ' . $subject, $t, $h);
    }
}

function px_admin_link(array $client): string
{
    return px_site_url() . '/portal/admin?client=' . rawurlencode($client['ref']);
}
