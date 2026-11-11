<?php
/**
 * Website Plan portal API. One endpoint, ?a=<action>, JSON in and out.
 *
 * Public:  config, signup, signup_status, create_account, login, logout,
 *          forgot, reset, me, demo_mandate_info, demo_mandate_complete
 * Client:  dashboard, brief_save, brief_submit, upload, file, file_delete,
 *          request_create, review_approve, review_revise, cancel_request,
 *          bank_update, account_update, password_change
 * Admin:   admin_login, admin_logout, admin_me, admin_overview, admin_client,
 *          admin_client_update, admin_request_update, admin_care_add,
 *          admin_care_delete, admin_payment_add, admin_payment_update,
 *          admin_brief_unlock, admin_send_report, admin_zip, admin_outbox
 *
 * Every POST needs the X-PX-Portal: 1 header (see px_require_post).
 */
declare(strict_types=1);

require __DIR__ . '/portal-lib/bootstrap.php';
require __DIR__ . '/portal-lib/mail.php';
require __DIR__ . '/portal-lib/netcash.php';
require __DIR__ . '/portal-lib/brief.php';

header('X-Robots-Tag: noindex, nofollow');

// The dispatcher sits at the end of this file: PHP only defines a top-level
// const once execution reaches it (functions are hoisted, constants are not).

/* ================================================================== */
/* Public                                                              */
/* ================================================================== */

function px_debit_day_label(string $day): string
{
    $n = (int) $day;
    $suffix = ($n % 100 >= 11 && $n % 100 <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][$n % 10] ?? 'th');
    return $n . $suffix;
}

function px_action_config(): never
{
    $days = [];
    foreach ((array) px_cfg('plan.debit_days', ['01']) as $d) {
        $days[] = ['value' => $d, 'label' => px_debit_day_label($d), 'first_debit' => px_first_debit_date($d)->format('Y-m-d')];
    }
    px_ok([
        'mode' => px_mode(),
        'plan' => [
            'name' => px_cfg('plan.name'),
            'amount' => px_amount(),
            'changes_per_month' => (int) px_cfg('plan.changes_per_month', 2),
            'debit_days' => $days,
            'terms_url' => px_cfg('plan.terms_url', '/terms'),
        ],
        'uploads' => ['max_file_mb' => (int) px_cfg('uploads.max_file_mb', 15)],
    ]);
}

function px_action_me(): never
{
    $client = px_current_client();
    px_ok(['client' => $client ? px_client_public($client) : null, 'mode' => px_mode()]);
}

function px_valid_mobile(string $m): ?string
{
    $digits = preg_replace('/\D/', '', $m) ?? '';
    if (preg_match('/^0\d{9}$/', $digits)) {
        return $digits;
    }
    if (preg_match('/^27\d{9}$/', $digits)) {
        return '0' . substr($digits, 2);
    }
    return null;
}

function px_action_signup(): never
{
    px_require_post();
    px_session();
    px_rate_limit('signup:' . px_client_ip(), 10, 3600);
    $in = px_input();

    $first = px_str($in, 'first_name', 60);
    $last = px_str($in, 'last_name', 60);
    $business = px_str($in, 'business_name', 100);
    $email = strtolower(px_str($in, 'email', 160));
    $mobile = px_valid_mobile(px_str($in, 'mobile', 20));
    $entity = px_str($in, 'entity_type', 20) === 'company' ? 'company' : 'individual';
    $regName = px_str($in, 'registered_name', 120);
    $regNo = px_str($in, 'reg_number', 30);
    $day = px_str($in, 'debit_day', 2);

    $errors = [];
    if ($first === '') { $errors['first_name'] = 'Add your first name.'; }
    if ($last === '') { $errors['last_name'] = 'Add your surname.'; }
    if ($business === '') { $errors['business_name'] = 'Add your business name.'; }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors['email'] = 'That email address does not look right.'; }
    if ($mobile === null) { $errors['mobile'] = 'Use a South African mobile number, like 082 555 1234.'; }
    if ($entity === 'company' && !preg_match('/^\d{4}\/\d{6}\/\d{2}$/', $regNo)) {
        $errors['reg_number'] = 'Use the CIPC format, like 2024/123456/07.';
    }
    if (!in_array($day, (array) px_cfg('plan.debit_days', []), true)) { $errors['debit_day'] = 'Pick a debit date.'; }
    if (empty($in['agree'])) { $errors['agree'] = 'Tick the box to accept the terms.'; }
    if ($errors) {
        px_fail('Please check the highlighted fields.', 422, ['fields' => $errors]);
    }

    $now = px_now();
    $firstDebit = px_first_debit_date($day)->format('Y-m-d');
    $amountCents = (int) round(px_amount() * 100);
    $existing = px_row('SELECT * FROM clients WHERE email = ?', [$email]);
    if ($existing && $existing['password_hash'] !== null) {
        px_fail('You already have an account with this email. Sign in instead.', 409, ['sign_in' => true]);
    }
    if ($existing && $existing['status'] === 'active') {
        // Signed but never created an account: send them to finish that.
        $_SESSION['pending_client'] = (int) $existing['id'];
        px_ok(['ref' => $existing['ref'], 'redirect' => '/start/done', 'first_debit' => $existing['first_debit_date']]);
    }

    $fields = [
        'first_name' => $first, 'last_name' => $last, 'business_name' => $business, 'mobile' => $mobile,
        'entity_type' => $entity, 'registered_name' => $entity === 'company' ? ($regName ?: $business) : null,
        'reg_number' => $entity === 'company' ? $regNo : null, 'debit_day' => $day, 'amount_cents' => $amountCents,
        'first_debit_date' => $firstDebit, 'status' => 'pending_mandate', 'updated_at' => $now,
    ];
    if ($existing) {
        $sets = implode(', ', array_map(fn ($k) => "{$k} = ?", array_keys($fields)));
        px_q("UPDATE clients SET {$sets} WHERE id = ?", [...array_values($fields), $existing['id']]);
        $id = (int) $existing['id'];
        px_event($id, 'signup', 'Sign-up details updated');
    } else {
        $fields += ['ref' => px_new_ref(), 'email' => $email, 'created_at' => $now];
        $cols = implode(', ', array_keys($fields));
        $marks = implode(', ', array_fill(0, count($fields), '?'));
        px_q("INSERT INTO clients ({$cols}) VALUES ({$marks})", array_values($fields));
        $id = (int) px_db()->lastInsertId();
        px_event($id, 'signup', 'Signed up for the ' . px_cfg('plan.name'));
    }
    $client = px_row('SELECT * FROM clients WHERE id = ?', [$id]);
    session_regenerate_id(true);
    $_SESSION['pending_client'] = $id;
    $url = px_mandate_start($client, 'signup');
    px_ok(['ref' => $client['ref'], 'redirect' => $url, 'first_debit' => $firstDebit]);
}

/** The signing-up client: from an emailed link (ref + k) or from this browser's session. */
function px_pending_client(array $in): ?array
{
    px_session();
    $ref = px_str($in, 'ref', 20);
    $k = px_str($in, 'k', 100);
    if ($ref !== '' && $k !== '') {
        px_rate_limit('token:' . px_client_ip(), 30, 900);
        $c = px_row('SELECT * FROM clients WHERE ref = ?', [$ref]);
        if ($c && $c['account_token_hash'] && hash_equals($c['account_token_hash'], px_hash_token($k))
            && strtotime((string) $c['account_token_expires']) > time()) {
            $_SESSION['pending_client'] = (int) $c['id'];
            return $c;
        }
        return null;
    }
    $id = (int) ($_SESSION['pending_client'] ?? 0);
    return $id > 0 ? px_row('SELECT * FROM clients WHERE id = ?', [$id]) : null;
}

function px_action_signup_status(): never
{
    px_require_post();
    $c = px_pending_client(px_input());
    if (!$c) {
        $me = px_current_client();
        px_ok(['state' => $me ? 'has_account' : 'unknown']);
    }
    $state = match (true) {
        $c['password_hash'] !== null => 'has_account',
        $c['mandate_status'] === 'signed' => 'signed',
        $c['mandate_status'] === 'declined' => 'declined',
        default => 'pending',
    };
    px_ok([
        'state' => $state,
        'mode' => px_mode(),
        'client' => [
            'ref' => $c['ref'], 'first_name' => $c['first_name'], 'business_name' => $c['business_name'],
            'email' => $c['email'], 'first_debit_date' => $c['first_debit_date'], 'amount' => ((int) $c['amount_cents']) / 100,
        ],
    ]);
}

function px_password_problem(string $pw): ?string
{
    if (mb_strlen($pw) < 10) {
        return 'Use at least 10 characters.';
    }
    if (mb_strlen($pw) > 200) {
        return 'That password is too long.';
    }
    return null;
}

function px_action_create_account(): never
{
    px_require_post();
    $in = px_input();
    $c = px_pending_client($in);
    if (!$c) {
        px_fail('This sign-up link has expired. Sign up again with the same email to get a new one.', 403);
    }
    if ($c['password_hash'] !== null) {
        px_fail('You already have an account. Sign in instead.', 409, ['sign_in' => true]);
    }
    if ($c['mandate_status'] !== 'signed') {
        px_fail('Your debit order has not been confirmed yet.', 409);
    }
    $pw = (string) ($in['password'] ?? '');
    if ($problem = px_password_problem($pw)) {
        px_fail($problem, 422, ['fields' => ['password' => $problem]]);
    }
    $now = px_now();
    px_q('UPDATE clients SET password_hash = ?, account_token_hash = NULL, account_token_expires = NULL, last_login_at = ?, updated_at = ? WHERE id = ?',
        [password_hash($pw, PASSWORD_DEFAULT), $now, $now, $c['id']]);
    px_q('INSERT OR IGNORE INTO briefs (client_id, data, status, updated_at) VALUES (?, ?, ?, ?)', [$c['id'], '{}', 'draft', $now]);
    px_event((int) $c['id'], 'account', 'Portal account created');
    session_regenerate_id(true);
    unset($_SESSION['pending_client']);
    $_SESSION['client_id'] = (int) $c['id'];
    px_ok(['redirect' => '/portal/']);
}

function px_action_login(): never
{
    px_require_post();
    px_session();
    $in = px_input();
    $email = strtolower(px_str($in, 'email', 160));
    px_rate_limit('login-ip:' . px_client_ip(), 30, 900);
    px_rate_limit('login:' . px_client_ip() . ':' . $email, 6, 900);
    $c = px_row('SELECT * FROM clients WHERE email = ?', [$email]);
    $pw = (string) ($in['password'] ?? '');
    if (!$c || $c['password_hash'] === null || !password_verify($pw, $c['password_hash'])) {
        px_fail('That email and password do not match.', 401);
    }
    if ($c['status'] === 'cancelled') {
        px_fail('This plan has been cancelled. Call us on +27 66 241 2155 if that is a mistake.', 403);
    }
    if (password_needs_rehash($c['password_hash'], PASSWORD_DEFAULT)) {
        px_q('UPDATE clients SET password_hash = ? WHERE id = ?', [password_hash($pw, PASSWORD_DEFAULT), $c['id']]);
    }
    session_regenerate_id(true);
    $_SESSION['client_id'] = (int) $c['id'];
    px_q('UPDATE clients SET last_login_at = ? WHERE id = ?', [px_now(), $c['id']]);
    px_ok(['client' => px_client_public($c)]);
}

function px_action_logout(): never
{
    px_require_post();
    px_session();
    unset($_SESSION['client_id'], $_SESSION['pending_client']);
    session_regenerate_id(true);
    px_ok();
}

function px_action_forgot(): never
{
    px_require_post();
    px_rate_limit('forgot:' . px_client_ip(), 5, 3600);
    $email = strtolower(px_str(px_input(), 'email', 160));
    $c = px_row('SELECT * FROM clients WHERE email = ?', [$email]);
    if ($c && $c['password_hash'] !== null && $c['status'] !== 'cancelled') {
        $raw = px_token(24);
        px_q('DELETE FROM password_resets WHERE client_id = ?', [$c['id']]);
        px_q('INSERT INTO password_resets (token_hash, client_id, expires_at) VALUES (?, ?, ?)', [px_hash_token($raw), $c['id'], date('Y-m-d H:i:s', time() + 3600)]);
        px_notify_client($c, 'password_reset', ['link' => px_site_url() . '/portal/#reset=' . $raw]);
    }
    // Same answer either way, so the form cannot be used to test which emails have accounts.
    px_ok(['message' => 'If that email has an account, a reset link is on its way.']);
}

function px_action_reset(): never
{
    px_require_post();
    px_session();
    px_rate_limit('reset:' . px_client_ip(), 10, 3600);
    $in = px_input();
    $row = px_row('SELECT * FROM password_resets WHERE token_hash = ?', [px_hash_token(px_str($in, 'token', 100))]);
    if (!$row || strtotime($row['expires_at']) < time()) {
        px_fail('This reset link has expired. Ask for a new one.', 403);
    }
    $pw = (string) ($in['password'] ?? '');
    if ($problem = px_password_problem($pw)) {
        px_fail($problem, 422, ['fields' => ['password' => $problem]]);
    }
    px_q('UPDATE clients SET password_hash = ?, updated_at = ? WHERE id = ?', [password_hash($pw, PASSWORD_DEFAULT), px_now(), $row['client_id']]);
    px_q('DELETE FROM password_resets WHERE client_id = ?', [$row['client_id']]);
    px_event((int) $row['client_id'], 'account', 'Password reset');
    session_regenerate_id(true);
    $_SESSION['client_id'] = (int) $row['client_id'];
    px_ok();
}

/* ---------------- Demo mandate (local only) ---------------- */

function px_demo_target(): array
{
    if (px_mode() !== 'demo') {
        px_fail('The demo mandate page only works in demo mode.', 404);
    }
    px_session();
    $id = (int) ($_SESSION['pending_client'] ?? 0);
    $client = $id > 0 ? px_row('SELECT * FROM clients WHERE id = ?', [$id]) : px_current_client();
    if (!$client) {
        px_fail('Start from the sign-up page first.', 404);
    }
    $mandate = px_row("SELECT * FROM mandates WHERE client_id = ? AND status = 'sent' ORDER BY id DESC LIMIT 1", [$client['id']]);
    if (!$mandate) {
        px_fail('There is no debit order waiting to be signed.', 404);
    }
    return [$client, $mandate];
}

function px_action_demo_mandate_info(): never
{
    [$c, $m] = px_demo_target();
    px_ok([
        'client' => ['first_name' => $c['first_name'], 'last_name' => $c['last_name'], 'business_name' => $c['business_name'],
            'mobile' => $c['mobile'], 'ref' => $c['ref'], 'debit_day' => $c['debit_day'], 'entity_type' => $c['entity_type']],
        'mandate' => ['agreement_ref' => $m['agreement_ref'], 'purpose' => $m['purpose'], 'amount' => ((int) $c['amount_cents']) / 100,
            'first_debit' => px_first_debit_date($c['debit_day'])->format('Y-m-d')],
        'otp' => '000000',
    ]);
}

function px_action_demo_mandate_complete(): never
{
    px_require_post();
    [$c, $m] = px_demo_target();
    $in = px_input();
    $approve = !empty($in['approve']);
    $last3 = preg_replace('/\D/', '', px_str($in, 'account_last3', 3)) ?: '000';
    [$code, $msg] = px_mandate_postback([
        'AccountRef' => $c['ref'],
        'Field1' => $m['secret'],
        'Field2' => (string) $m['id'],
        'MandateSuccessful' => $approve ? 'True' : 'False',
        'IsDeclined' => $approve ? 'False' : 'True',
        'ReasonForDecline' => $approve ? '' : 'Declined in the banking app (demo)',
        'MandateReferenceNumber' => 'DEMO-' . $m['agreement_ref'],
        'BankName' => px_str($in, 'bank_name', 40) ?: 'Demo Bank',
        'BankAccountType' => px_str($in, 'account_type', 20) ?: 'Current',
        'BankAccountNo' => '0000000' . $last3,
    ]);
    if ($code !== 200) {
        px_fail('Demo postback failed: ' . $msg, 500);
    }
    px_ok(['next' => $m['purpose'] === 'update' ? '/portal/?view=billing' : '/start/done']);
}

/* ================================================================== */
/* Client                                                              */
/* ================================================================== */

function px_action_dashboard(): never
{
    $c = px_require_client();
    $id = (int) $c['id'];
    $brief = px_row('SELECT * FROM briefs WHERE client_id = ?', [$id]);
    if (!$brief) {
        px_q('INSERT INTO briefs (client_id, data, status, updated_at) VALUES (?, ?, ?, ?)', [$id, '{}', 'draft', px_now()]);
        $brief = px_row('SELECT * FROM briefs WHERE client_id = ?', [$id]);
    }
    $files = px_rows('SELECT * FROM files WHERE client_id = ? ORDER BY id', [$id]);
    $requests = px_rows('SELECT * FROM requests WHERE client_id = ? ORDER BY id DESC', [$id]);
    $month = px_month_key();
    $careMonths = array_column(px_rows('SELECT DISTINCT month_key FROM care_log WHERE client_id = ? ORDER BY month_key DESC LIMIT 12', [$id]), 'month_key');
    $care = px_rows('SELECT * FROM care_log WHERE client_id = ? ORDER BY month_key DESC, id', [$id]);
    $mandate = px_row("SELECT bank_summary, completed_at, netcash_ref FROM mandates WHERE client_id = ? AND status = 'signed' ORDER BY id DESC LIMIT 1", [$id]);

    px_ok([
        'mode' => px_mode(),
        'client' => px_client_public($c),
        'plan' => ['name' => px_cfg('plan.name'), 'amount' => px_amount(), 'changes_per_month' => (int) px_cfg('plan.changes_per_month', 2)],
        'brief' => [
            'status' => $brief['status'],
            'data' => json_decode($brief['data'], true) ?: new stdClass(),
            'submitted_at' => $brief['submitted_at'],
            'updated_at' => $brief['updated_at'],
            'files' => array_map('px_file_public', array_values(array_filter($files, fn ($f) => $f['request_id'] === null && in_array($f['kind'], ['logo', 'photo', 'brand'], true)))),
        ],
        'quota' => px_quota($id),
        'requests' => array_map(fn ($r) => px_request_public($r, $files), $requests),
        'care' => [
            'current_month' => $month,
            'months' => $careMonths,
            'items' => array_map(fn ($r) => [
                'id' => (int) $r['id'], 'month' => $r['month_key'], 'category' => $r['category'], 'text' => $r['text'],
                'metric_label' => $r['metric_label'], 'metric_value' => $r['metric_value'], 'created_at' => $r['created_at'],
            ], $care),
        ],
        'payments' => array_map(fn ($p) => ['amount' => ((int) $p['amount_cents']) / 100, 'status' => $p['status'], 'date' => $p['pay_date'], 'note' => $p['note']],
            px_rows('SELECT * FROM payments WHERE client_id = ? ORDER BY pay_date DESC, id DESC LIMIT 24', [$id])),
        'bank' => $mandate ? ['summary' => $mandate['bank_summary'], 'signed_at' => $mandate['completed_at']] : null,
        'events' => px_rows('SELECT type, message, created_at FROM events WHERE client_id = ? ORDER BY id DESC LIMIT 25', [$id]),
    ]);
}

function px_action_brief_save(): never
{
    px_require_post();
    $c = px_require_client();
    $brief = px_row('SELECT * FROM briefs WHERE client_id = ?', [$c['id']]);
    if ($brief && $brief['status'] === 'submitted') {
        px_fail('Your brief is with the build team. Send anything new as a note on your progress page.', 409);
    }
    $data = px_brief_clean(px_input()['data'] ?? []);
    px_q('INSERT INTO briefs (client_id, data, status, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(client_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
        [$c['id'], json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $brief['status'] ?? 'draft', px_now()]);
    px_ok(['saved_at' => px_now()]);
}

function px_action_brief_submit(): never
{
    px_require_post();
    $c = px_require_client();
    $id = (int) $c['id'];
    $brief = px_row('SELECT * FROM briefs WHERE client_id = ?', [$id]);
    if ($brief && $brief['status'] === 'submitted') {
        px_fail('Your brief has already been sent.', 409);
    }
    $data = px_brief_clean(px_input()['data'] ?? []);
    $files = px_rows("SELECT * FROM files WHERE client_id = ? AND request_id IS NULL", [$id]);
    $problems = px_brief_problems($data, $files);
    if ($problems) {
        px_fail('A few things are still missing.', 422, ['missing' => $problems]);
    }
    $now = px_now();
    $wasUnlocked = ($brief['status'] ?? '') === 'unlocked';
    px_q("UPDATE briefs SET data = ?, status = 'submitted', submitted_at = ?, updated_at = ? WHERE client_id = ?",
        [json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $now, $now, $id]);
    if ($c['stage'] === 'brief') {
        px_q("UPDATE clients SET stage = 'building', updated_at = ? WHERE id = ?", [$now, $id]);
    }
    px_event($id, 'brief', $wasUnlocked ? 'Brief updated and re-sent' : 'Brief sent to the build team');
    $c = px_row('SELECT * FROM clients WHERE id = ?', [$id]);
    if (!$wasUnlocked) {
        px_notify_client($c, 'brief_received');
    }
    px_notify_team($wasUnlocked ? 'Brief updated' : 'New brief to build', [
        'Client' => $c['business_name'], 'Reference' => $c['ref'], 'Files' => (string) count($files),
        'Pages' => implode(', ', (array) ($data['pages']['list'] ?? [])),
        'Domain' => ($data['contact']['domain_status'] ?? '') === 'own' ? ($data['contact']['domain'] ?? '') : 'needs one',
    ], px_admin_link($c));
    px_ok();
}

/* ---------------- Files ---------------- */

const PX_UPLOAD_TYPES = [
    'jpg' => 'image', 'jpeg' => 'image', 'png' => 'image', 'webp' => 'image', 'gif' => 'image',
    'heic' => 'any', 'heif' => 'any', 'svg' => 'svg', 'pdf' => 'pdf', 'ai' => 'any', 'eps' => 'any',
    'psd' => 'any', 'zip' => 'any', 'doc' => 'any', 'docx' => 'any', 'txt' => 'text', 'pptx' => 'any', 'xlsx' => 'any',
];

function px_action_upload(): never
{
    px_require_post();
    $c = px_require_client();
    $id = (int) $c['id'];
    px_rate_limit('upload:' . $id, 200, 3600);
    $kind = px_str($_POST, 'kind', 20);
    if (!in_array($kind, ['logo', 'photo', 'brand', 'change'], true)) {
        px_fail('Unknown upload type.');
    }
    if (in_array($kind, ['logo', 'photo', 'brand'], true)) {
        $b = px_row('SELECT status FROM briefs WHERE client_id = ?', [$id]);
        if (($b['status'] ?? 'draft') === 'submitted') {
            px_fail('Your brief is locked while we build. Add new files to a change request instead.', 409);
        }
    }
    $incoming = $_FILES['files'] ?? null;
    if (!$incoming || !is_array($incoming['name'])) {
        px_fail('No files arrived. Try again, or try a smaller file.');
    }
    $maxFile = (int) px_cfg('uploads.max_file_mb', 15) * 1024 * 1024;
    $maxClient = (int) px_cfg('uploads.max_client_mb', 300) * 1024 * 1024;
    $used = (int) (px_row('SELECT COALESCE(SUM(size), 0) AS s FROM files WHERE client_id = ?', [$id])['s'] ?? 0);
    $dir = px_data_dir('uploads/' . $id);
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $saved = [];
    $rejected = [];

    foreach ($incoming['name'] as $i => $name) {
        $name = mb_substr(basename(str_replace('\\', '/', (string) $name)), 0, 120);
        $err = (int) $incoming['error'][$i];
        $tmp = (string) $incoming['tmp_name'][$i];
        $size = (int) $incoming['size'][$i];
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
            $rejected[] = "{$name}: did not upload" . ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE ? ' (too big)' : '');
            continue;
        }
        if (!isset(PX_UPLOAD_TYPES[$ext])) {
            $rejected[] = "{$name}: that file type is not accepted";
            continue;
        }
        if ($size > $maxFile) {
            $rejected[] = "{$name}: larger than " . px_cfg('uploads.max_file_mb', 15) . ' MB';
            continue;
        }
        if ($used + $size > $maxClient) {
            $rejected[] = "{$name}: your storage is full. Send larger sets as a link in the notes";
            continue;
        }
        $mime = (string) $finfo->file($tmp);
        $rule = PX_UPLOAD_TYPES[$ext];
        $okType = match ($rule) {
            'image' => str_starts_with($mime, 'image/') && $mime !== 'image/svg+xml',
            'svg' => in_array($mime, ['image/svg+xml', 'text/xml', 'application/xml', 'text/plain', 'text/html'], true),
            'pdf' => $mime === 'application/pdf',
            'text' => str_starts_with($mime, 'text/plain'),
            default => !preg_match('/(php|javascript|x-sh|x-executable|x-mach|x-dosexec|html)/', $mime),
        };
        if (!$okType) {
            $rejected[] = "{$name}: the contents do not match a .{$ext} file";
            continue;
        }
        if ($ext === 'svg') {
            $mime = 'image/svg+xml';
        }
        $stored = px_token(16) . '.' . $ext;
        if (!move_uploaded_file($tmp, "{$dir}/{$stored}")) {
            $rejected[] = "{$name}: could not be saved";
            continue;
        }
        @chmod("{$dir}/{$stored}", 0640);
        px_q('INSERT INTO files (client_id, kind, request_id, orig_name, stored_name, mime, size, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
            [$id, $kind, $name, $stored, $mime, $size, px_now()]);
        $used += $size;
        $saved[] = px_file_public(px_row('SELECT * FROM files WHERE id = ?', [(int) px_db()->lastInsertId()]));
    }
    px_ok(['files' => $saved, 'rejected' => $rejected]);
}

function px_action_file(): never
{
    $fileId = (int) ($_GET['id'] ?? 0);
    $f = px_row('SELECT * FROM files WHERE id = ?', [$fileId]);
    $client = px_current_client();
    $allowed = $f && (px_is_admin() || ($client && (int) $client['id'] === (int) $f['client_id']));
    if (!$allowed) {
        http_response_code(404);
        exit;
    }
    $path = px_data_dir('uploads/' . $f['client_id']) . '/' . basename($f['stored_name']);
    if (!is_file($path)) {
        http_response_code(404);
        exit;
    }
    $inline = !empty($_GET['inline']) && in_array($f['mime'], ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true);
    header('Content-Type: ' . ($inline ? $f['mime'] : 'application/octet-stream'));
    header('Content-Length: ' . filesize($path));
    header("Content-Disposition: " . ($inline ? 'inline' : 'attachment') . "; filename*=UTF-8''" . rawurlencode($f['orig_name']));
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; sandbox");
    header('Cache-Control: private, max-age=3600');
    readfile($path);
    exit;
}

function px_action_file_delete(): never
{
    px_require_post();
    $c = px_require_client();
    $f = px_row('SELECT * FROM files WHERE id = ? AND client_id = ?', [(int) (px_input()['id'] ?? 0), $c['id']]);
    if (!$f) {
        px_fail('That file is not there any more.', 404);
    }
    if ($f['request_id'] !== null) {
        px_fail('Files on a sent request stay with the request.', 409);
    }
    $b = px_row('SELECT status FROM briefs WHERE client_id = ?', [$c['id']]);
    if (in_array($f['kind'], ['logo', 'photo', 'brand'], true) && ($b['status'] ?? '') === 'submitted') {
        px_fail('Your brief is locked while we build.', 409);
    }
    @unlink(px_data_dir('uploads/' . $c['id']) . '/' . basename($f['stored_name']));
    px_q('DELETE FROM files WHERE id = ?', [$f['id']]);
    px_ok();
}

/** Attaches already-uploaded, still-loose 'change' files to a request. */
function px_attach_files(int $clientId, int $requestId, array $ids): void
{
    foreach (array_slice($ids, 0, 20) as $fid) {
        px_q("UPDATE files SET request_id = ? WHERE id = ? AND client_id = ? AND request_id IS NULL AND kind = 'change'", [$requestId, (int) $fid, $clientId]);
    }
}

/* ---------------- Requests ---------------- */

function px_action_request_create(): never
{
    px_require_post();
    $c = px_require_client();
    $id = (int) $c['id'];
    px_rate_limit('request:' . $id, 20, 86400);
    $in = px_input();
    // change: counts towards the monthly allowance. problem: something is
    // broken, never counts. note: a message to the build team before launch.
    $type = px_str($in, 'type', 10);
    $type = in_array($type, ['change', 'problem', 'note'], true) ? $type : 'change';
    $title = px_str($in, 'title', 120);
    $page = px_str($in, 'page', 80);
    $details = px_str($in, 'details', 4000);
    if ($type !== 'note' && $c['stage'] !== 'live') {
        px_fail('Change requests open once your site is live. Until then, send the build team a note instead.', 409);
    }
    if ($title === '' || mb_strlen($details) < 10) {
        px_fail('Give it a short title and tell us what you need.', 422, ['fields' => [
            'title' => $title === '' ? 'Add a short title.' : null,
            'details' => mb_strlen($details) < 10 ? 'Add a little more detail.' : null,
        ]]);
    }
    $db = px_db();
    $db->beginTransaction();
    try {
        $quota = px_quota($id);
        if ($type === 'change' && $quota['left'] <= 0) {
            $db->rollBack();
            px_fail('You have used this month\'s changes. They reset on ' . (new DateTimeImmutable($quota['resets_on']))->format('j F') . '. If something is broken, report it as a problem instead.', 409, ['quota' => $quota]);
        }
        $now = px_now();
        px_q('INSERT INTO requests (client_id, type, title, page, details, status, month_key, counts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $type, $title, $page ?: null, $details, 'received', px_month_key(), $type === 'change' ? 1 : 0, $now, $now]);
        $rid = (int) $db->lastInsertId();
        px_attach_files($id, $rid, (array) ($in['file_ids'] ?? []));
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
    $labels = ['problem' => 'Problem reported', 'change' => 'Change requested', 'note' => 'Note for the build team'];
    px_event($id, $type, $labels[$type] . ': ' . $title);
    $quota = px_quota($id);
    if ($type !== 'note') {
        px_notify_client($c, 'request_received', ['type' => $type, 'title' => $title, 'left' => $quota['left'], 'allowed' => $quota['allowed']]);
    }
    px_notify_team($labels[$type] . ': ' . $c['business_name'], [
        'Client' => $c['business_name'], 'Title' => $title, 'Page' => $page ?: 'not given', 'Details' => mb_substr($details, 0, 600),
    ], px_admin_link($c));
    px_ok(['quota' => $quota]);
}

function px_action_review_approve(): never
{
    px_require_post();
    $c = px_require_client();
    if ($c['stage'] !== 'review') {
        px_fail('There is no preview waiting for you right now.', 409);
    }
    px_q("UPDATE clients SET stage = 'launching', updated_at = ? WHERE id = ?", [px_now(), $c['id']]);
    px_event((int) $c['id'], 'review', 'Preview approved. Getting ready to go live');
    px_notify_team('Preview approved, ready to launch', ['Client' => $c['business_name'], 'Reference' => $c['ref'], 'Preview' => (string) $c['preview_url']], px_admin_link($c));
    px_ok();
}

function px_action_review_revise(): never
{
    px_require_post();
    $c = px_require_client();
    if ($c['stage'] !== 'review') {
        px_fail('There is no preview waiting for you right now.', 409);
    }
    $in = px_input();
    $details = px_str($in, 'details', 6000);
    if (mb_strlen($details) < 10) {
        px_fail('Tell us what to change. List everything in one go.', 422, ['fields' => ['details' => 'Add the changes you want.']]);
    }
    $round = (int) $c['review_round'] + 1;
    $now = px_now();
    px_q('INSERT INTO requests (client_id, type, title, page, details, status, month_key, counts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
        [$c['id'], 'revision', "Preview changes, round {$round}", null, $details, 'received', px_month_key(), $now, $now]);
    $rid = (int) px_db()->lastInsertId();
    px_attach_files((int) $c['id'], $rid, (array) ($in['file_ids'] ?? []));
    px_q("UPDATE clients SET stage = 'building', review_round = ?, updated_at = ? WHERE id = ?", [$round, $now, $c['id']]);
    px_event((int) $c['id'], 'review', "Preview changes sent (round {$round})");
    px_notify_team("Preview changes, round {$round}", ['Client' => $c['business_name'], 'Changes' => mb_substr($details, 0, 1200)], px_admin_link($c));
    px_ok();
}

function px_action_cancel_request(): never
{
    px_require_post();
    $c = px_require_client();
    if ($c['status'] === 'cancel_requested') {
        px_fail('We already have your cancellation request.', 409);
    }
    $reason = px_str(px_input(), 'reason', 2000);
    $now = px_now();
    px_q('INSERT INTO requests (client_id, type, title, page, details, status, month_key, counts, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?, 0, ?, ?)',
        [$c['id'], 'cancel', 'Cancel the plan', $reason ?: 'No reason given', 'received', px_month_key(), $now, $now]);
    px_q("UPDATE clients SET status = 'cancel_requested', updated_at = ? WHERE id = ?", [$now, $c['id']]);
    px_event((int) $c['id'], 'cancel', 'Asked to cancel the plan');
    px_notify_client($c, 'cancel_received');
    px_notify_team('Cancellation request', ['Client' => $c['business_name'], 'Reference' => $c['ref'], 'Reason' => $reason ?: 'not given'], px_admin_link($c));
    px_ok();
}

function px_action_bank_update(): never
{
    px_require_post();
    $c = px_require_client();
    px_rate_limit('bank:' . $c['id'], 5, 86400);
    if ($c['mandate_status'] !== 'signed') {
        px_fail('Finish your first debit order before changing it.', 409);
    }
    px_ok(['redirect' => px_mandate_start($c, 'update')]);
}

function px_action_account_update(): never
{
    px_require_post();
    $c = px_require_client();
    $in = px_input();
    $first = px_str($in, 'first_name', 60);
    $last = px_str($in, 'last_name', 60);
    $mobile = px_valid_mobile(px_str($in, 'mobile', 20));
    if ($first === '' || $last === '' || $mobile === null) {
        px_fail('Check your name and mobile number.', 422);
    }
    px_q('UPDATE clients SET first_name = ?, last_name = ?, mobile = ?, updated_at = ? WHERE id = ?', [$first, $last, $mobile, px_now(), $c['id']]);
    px_ok();
}

function px_action_password_change(): never
{
    px_require_post();
    $c = px_require_client();
    px_rate_limit('pwchange:' . $c['id'], 6, 900);
    $in = px_input();
    if (!password_verify((string) ($in['current'] ?? ''), (string) $c['password_hash'])) {
        px_fail('Your current password is not right.', 403, ['fields' => ['current' => 'Not right.']]);
    }
    $pw = (string) ($in['password'] ?? '');
    if ($problem = px_password_problem($pw)) {
        px_fail($problem, 422, ['fields' => ['password' => $problem]]);
    }
    px_q('UPDATE clients SET password_hash = ?, updated_at = ? WHERE id = ?', [password_hash($pw, PASSWORD_DEFAULT), px_now(), $c['id']]);
    px_event((int) $c['id'], 'account', 'Password changed');
    px_ok();
}

/* ================================================================== */
/* Admin                                                               */
/* ================================================================== */

function px_action_admin_login(): never
{
    px_require_post();
    px_session();
    px_rate_limit('admin:' . px_client_ip(), 8, 900);
    $hash = (string) px_cfg('admin.password_hash', '');
    if ($hash === '') {
        px_fail('Admin sign-in is switched off until admin.password_hash is set in px-portal-config.php.', 403);
    }
    if (!password_verify((string) (px_input()['password'] ?? ''), $hash)) {
        px_fail('That password is not right.', 401);
    }
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    $_SESSION['admin_until'] = time() + 60 * 60 * 8;
    px_ok();
}

function px_action_admin_logout(): never
{
    px_require_post();
    px_session();
    unset($_SESSION['admin'], $_SESSION['admin_until']);
    px_ok();
}

function px_action_admin_me(): never
{
    px_ok(['admin' => px_is_admin(), 'mode' => px_mode(), 'enabled' => (string) px_cfg('admin.password_hash', '') !== '']);
}

function px_admin_client_or_fail(string $ref): array
{
    $c = px_row('SELECT * FROM clients WHERE ref = ?', [$ref]);
    if (!$c) {
        px_fail('No client with that reference.', 404);
    }
    return $c;
}

function px_action_admin_overview(): never
{
    px_require_admin();
    $clients = px_rows("SELECT c.*, b.status AS brief_status, b.submitted_at,
        (SELECT COUNT(*) FROM requests r WHERE r.client_id = c.id AND r.status IN ('received', 'in_progress')) AS open_requests
        FROM clients c LEFT JOIN briefs b ON b.client_id = c.id ORDER BY c.id DESC");
    $queue = px_rows("SELECT r.*, c.business_name, c.ref FROM requests r JOIN clients c ON c.id = r.client_id
        WHERE r.status IN ('received', 'in_progress') ORDER BY CASE r.type WHEN 'problem' THEN 0 WHEN 'cancel' THEN 1 ELSE 2 END, r.id");
    px_ok([
        'mode' => px_mode(),
        'clients' => array_map(fn ($c) => px_client_public($c) + [
            'brief_status' => $c['brief_status'], 'brief_submitted_at' => $c['submitted_at'],
            'open_requests' => (int) $c['open_requests'], 'has_account' => $c['password_hash'] !== null, 'last_login_at' => $c['last_login_at'],
        ], $clients),
        'queue' => array_map(fn ($r) => px_request_public($r) + ['business_name' => $r['business_name'], 'ref' => $r['ref']], $queue),
        'mrr' => array_sum(array_map(fn ($c) => in_array($c['status'], ['active', 'cancel_requested'], true) ? (int) $c['amount_cents'] : 0, $clients)) / 100,
    ]);
}

function px_action_admin_client(): never
{
    px_require_admin();
    $c = px_admin_client_or_fail(px_str($_GET, 'ref', 20));
    $id = (int) $c['id'];
    $brief = px_row('SELECT * FROM briefs WHERE client_id = ?', [$id]);
    $files = px_rows('SELECT * FROM files WHERE client_id = ? ORDER BY id', [$id]);
    $data = $brief ? (json_decode($brief['data'], true) ?: []) : [];
    px_ok([
        'client' => px_client_public($c) + [
            'registered_name' => $c['registered_name'], 'reg_number' => $c['reg_number'], 'internal_notes' => $c['internal_notes'],
            'mandate_pdf' => $c['mandate_pdf'], 'has_account' => $c['password_hash'] !== null, 'last_login_at' => $c['last_login_at'],
        ],
        'brief' => ['status' => $brief['status'] ?? 'draft', 'submitted_at' => $brief['submitted_at'] ?? null, 'data' => $data ?: new stdClass(),
            'sections' => px_brief_sections($data)],
        'files' => array_map('px_file_public', $files),
        'requests' => array_map(fn ($r) => px_request_public($r, $files), px_rows('SELECT * FROM requests WHERE client_id = ? ORDER BY id DESC', [$id])),
        'quota' => px_quota($id),
        'care' => px_rows('SELECT * FROM care_log WHERE client_id = ? ORDER BY month_key DESC, id', [$id]),
        'payments' => px_rows('SELECT id, amount_cents, status, pay_date, note FROM payments WHERE client_id = ? ORDER BY pay_date DESC, id DESC', [$id]),
        'mandates' => px_rows('SELECT id, purpose, agreement_ref, status, netcash_ref, pdf_link, reason, bank_summary, created_at, completed_at FROM mandates WHERE client_id = ? ORDER BY id DESC', [$id]),
        'events' => px_rows('SELECT type, message, created_at FROM events WHERE client_id = ? ORDER BY id DESC LIMIT 60', [$id]),
    ]);
}

const PX_STAGES = ['brief', 'building', 'review', 'launching', 'live'];

function px_action_admin_client_update(): never
{
    px_require_post();
    px_require_admin();
    $in = px_input();
    $c = px_admin_client_or_fail(px_str($in, 'ref', 20));
    $id = (int) $c['id'];
    $updates = [];
    foreach (['preview_url', 'live_url'] as $k) {
        if (array_key_exists($k, $in)) {
            $v = px_str($in, $k, 300);
            if ($v !== '' && !preg_match('#^https?://#i', $v)) {
                px_fail("The {$k} must start with http:// or https://");
            }
            $updates[$k] = $v ?: null;
        }
    }
    if (array_key_exists('internal_notes', $in)) {
        $updates['internal_notes'] = px_str($in, 'internal_notes', 5000) ?: null;
    }
    $newStage = null;
    if (array_key_exists('stage', $in)) {
        $s = px_str($in, 'stage', 20);
        if (!in_array($s, PX_STAGES, true)) {
            px_fail('Unknown stage.');
        }
        if ($s !== $c['stage']) {
            $newStage = $s;
            $updates['stage'] = $s;
        }
    }
    if (array_key_exists('status', $in)) {
        $s = px_str($in, 'status', 20);
        if (!in_array($s, ['active', 'cancel_requested', 'cancelled', 'pending_mandate', 'mandate_declined'], true)) {
            px_fail('Unknown status.');
        }
        if ($s !== $c['status']) {
            $updates['status'] = $s;
            if ($s === 'cancelled') {
                $updates['cancelled_at'] = px_now();
            }
            px_event($id, 'status', 'Plan status set to ' . str_replace('_', ' ', $s));
        }
    }
    if ($newStage === 'review' && empty($updates['preview_url'] ?? $c['preview_url'])) {
        px_fail('Add the preview link before moving the client to review.');
    }
    if ($updates) {
        $updates['updated_at'] = px_now();
        $sets = implode(', ', array_map(fn ($k) => "{$k} = ?", array_keys($updates)));
        px_q("UPDATE clients SET {$sets} WHERE id = ?", [...array_values($updates), $id]);
    }
    if ($newStage) {
        $labels = ['brief' => 'Waiting for the brief', 'building' => 'Building', 'review' => 'Preview ready for review', 'launching' => 'Getting ready to go live', 'live' => 'Live'];
        px_event($id, 'stage', $labels[$newStage]);
        $fresh = px_row('SELECT * FROM clients WHERE id = ?', [$id]);
        if ($newStage === 'review') {
            px_notify_client($fresh, 'stage_review');
        } elseif ($newStage === 'live') {
            px_notify_client($fresh, 'stage_live');
        }
    }
    px_ok();
}

function px_action_admin_request_update(): never
{
    px_require_post();
    px_require_admin();
    $in = px_input();
    $r = px_row('SELECT * FROM requests WHERE id = ?', [(int) ($in['id'] ?? 0)]);
    if (!$r) {
        px_fail('No such request.', 404);
    }
    $status = px_str($in, 'status', 20);
    if (!in_array($status, ['received', 'in_progress', 'done', 'declined'], true)) {
        px_fail('Unknown status.');
    }
    $note = px_str($in, 'team_note', 2000);
    $now = px_now();
    px_q('UPDATE requests SET status = ?, team_note = ?, updated_at = ?, completed_at = ? WHERE id = ?',
        [$status, $note ?: null, $now, in_array($status, ['done', 'declined'], true) ? $now : null, $r['id']]);
    $c = px_row('SELECT * FROM clients WHERE id = ?', [$r['client_id']]);
    if ($status !== $r['status']) {
        px_event((int) $c['id'], 'request', '"' . $r['title'] . '" marked ' . str_replace('_', ' ', $status));
        if ($r['type'] !== 'revision' && $r['type'] !== 'cancel') {
            if ($status === 'done') {
                px_notify_client($c, 'request_done', ['title' => $r['title'], 'note' => $note]);
            } elseif ($status === 'declined') {
                px_notify_client($c, 'request_declined', ['title' => $r['title'], 'note' => $note]);
            }
        }
    }
    px_ok();
}

function px_action_admin_care_add(): never
{
    px_require_post();
    px_require_admin();
    $in = px_input();
    $c = px_admin_client_or_fail(px_str($in, 'ref', 20));
    $month = px_str($in, 'month', 7);
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        $month = px_month_key();
    }
    $cat = px_str($in, 'category', 20);
    if (!in_array($cat, ['security', 'backup', 'seo', 'analytics', 'maintenance', 'uptime', 'change', 'note'], true)) {
        px_fail('Unknown category.');
    }
    $text = px_str($in, 'text', 600);
    if ($text === '') {
        px_fail('Say what was done.');
    }
    px_q('INSERT INTO care_log (client_id, month_key, category, text, metric_label, metric_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$c['id'], $month, $cat, $text, px_str($in, 'metric_label', 60) ?: null, px_str($in, 'metric_value', 40) ?: null, px_now()]);
    px_ok();
}

function px_action_admin_care_delete(): never
{
    px_require_post();
    px_require_admin();
    px_q('DELETE FROM care_log WHERE id = ?', [(int) (px_input()['id'] ?? 0)]);
    px_ok();
}

function px_action_admin_payment_add(): never
{
    px_require_post();
    px_require_admin();
    $in = px_input();
    $c = px_admin_client_or_fail(px_str($in, 'ref', 20));
    $status = px_str($in, 'status', 20);
    if (!in_array($status, ['scheduled', 'paid', 'failed', 'reversed'], true)) {
        px_fail('Unknown payment status.');
    }
    $date = px_str($in, 'date', 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        px_fail('Use a date like 2026-12-01.');
    }
    $amount = (float) ($in['amount'] ?? px_amount());
    px_q('INSERT INTO payments (client_id, amount_cents, status, pay_date, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [$c['id'], (int) round($amount * 100), $status, $date, px_str($in, 'note', 200) ?: null, px_now()]);
    px_event((int) $c['id'], 'payment', 'Debit of ' . px_money($amount, false) . " on {$date}: {$status}");
    px_ok();
}

function px_action_admin_payment_update(): never
{
    px_require_post();
    px_require_admin();
    $in = px_input();
    $status = px_str($in, 'status', 20);
    if (!in_array($status, ['scheduled', 'paid', 'failed', 'reversed'], true)) {
        px_fail('Unknown payment status.');
    }
    $p = px_row('SELECT * FROM payments WHERE id = ?', [(int) ($in['id'] ?? 0)]);
    if (!$p) {
        px_fail('No such payment.', 404);
    }
    px_q('UPDATE payments SET status = ? WHERE id = ?', [$status, $p['id']]);
    px_event((int) $p['client_id'], 'payment', 'Debit of ' . px_money((int) $p['amount_cents']) . " on {$p['pay_date']}: {$status}");
    px_ok();
}

function px_action_admin_brief_unlock(): never
{
    px_require_post();
    px_require_admin();
    $c = px_admin_client_or_fail(px_str(px_input(), 'ref', 20));
    px_q("UPDATE briefs SET status = 'unlocked', updated_at = ? WHERE client_id = ?", [px_now(), $c['id']]);
    px_event((int) $c['id'], 'brief', 'Brief opened again for edits');
    px_ok();
}

function px_action_admin_send_report(): never
{
    px_require_post();
    px_require_admin();
    $in = px_input();
    $c = px_admin_client_or_fail(px_str($in, 'ref', 20));
    $month = px_str($in, 'month', 7) ?: px_month_key();
    $items = px_rows('SELECT * FROM care_log WHERE client_id = ? AND month_key = ? ORDER BY id', [$c['id'], $month]);
    if (!$items) {
        px_fail('Log some work for that month before sending the report.');
    }
    px_notify_client($c, 'care_report', ['month_label' => px_month_label($month), 'items' => $items]);
    px_event((int) $c['id'], 'report', 'Website report for ' . px_month_label($month) . ' emailed');
    px_ok();
}

function px_action_admin_zip(): never
{
    px_require_admin();
    $c = px_admin_client_or_fail(px_str($_GET, 'ref', 20));
    if (!class_exists('ZipArchive')) {
        px_fail('This server has no zip support. Download the files one by one.', 501);
    }
    $brief = px_row('SELECT * FROM briefs WHERE client_id = ?', [$c['id']]);
    $data = $brief ? (json_decode($brief['data'], true) ?: []) : [];
    $tmp = tempnam(sys_get_temp_dir(), 'pxzip');
    $zip = new ZipArchive();
    $zip->open($tmp, ZipArchive::OVERWRITE);
    $zip->addFromString('brief.txt', px_brief_text($c, $data));
    $zip->addFromString('brief.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $seen = [];
    foreach (px_rows('SELECT * FROM files WHERE client_id = ? ORDER BY id', [$c['id']]) as $f) {
        $path = px_data_dir('uploads/' . $c['id']) . '/' . basename($f['stored_name']);
        if (!is_file($path)) {
            continue;
        }
        $folder = $f['request_id'] !== null ? 'request-' . $f['request_id'] : $f['kind'];
        $name = $folder . '/' . preg_replace('/[^\w.\- ]/u', '_', $f['orig_name']);
        if (isset($seen[$name])) {
            $name = $folder . '/' . $f['id'] . '-' . preg_replace('/[^\w.\- ]/u', '_', $f['orig_name']);
        }
        $seen[$name] = true;
        $zip->addFile($path, $name);
    }
    $zip->close();
    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($c['business_name'])) ?: 'client';
    header('Content-Type: application/zip');
    header('Content-Length: ' . filesize($tmp));
    header('Content-Disposition: attachment; filename="' . $c['ref'] . '-' . trim($slug, '-') . '.zip"');
    header('Cache-Control: no-store');
    readfile($tmp);
    @unlink($tmp);
    exit;
}

function px_action_admin_outbox(): never
{
    px_require_admin();
    $dir = px_data_dir('mail');
    $files = glob($dir . '/*.json') ?: [];
    rsort($files);
    $out = [];
    foreach (array_slice($files, 0, 50) as $f) {
        $m = json_decode((string) file_get_contents($f), true);
        if (is_array($m)) {
            $out[] = $m;
        }
    }
    px_ok(['messages' => $out, 'mode' => px_cfg('mail.mode')]);
}

/* ================================================================== */
/* Dispatch                                                            */
/* ================================================================== */

try {
    px_assert_configured();
    $action = preg_replace('/[^a-z_]/', '', (string) ($_GET['a'] ?? ''));
    $fn = 'px_action_' . $action;
    if ($action === '' || !function_exists($fn)) {
        px_fail('Unknown action.', 404);
    }
    $fn();
} catch (Throwable $e) {
    px_log('errors', get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
    px_fail('Something went wrong on our side. Please try again, or call us on +27 66 241 2155.', 500);
}
