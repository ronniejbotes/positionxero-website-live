<?php
/**
 * Website Plan portal: Netcash debit order mandates (DebiCheck).
 *
 * The sequence, per Netcash's eMandate synchronous service (AddMandate on
 * NIWS_NIF, https://api.netcash.co.za/inbound-payments/emandate/emandate-synchronous/):
 *
 *   1. We call AddMandate with the client's details and the plan amount.
 *      Netcash answers with a MandateUrl.
 *   2. We send the client's browser to that URL. Netcash texts them a one
 *      time PIN, they fill in their bank details on Netcash's page and sign.
 *      With IncludeDebiCheck the bank then asks them to approve the mandate
 *      in their banking app.
 *   3. Netcash posts the result to our postback URL (/api/netcash-mandate.php,
 *      set once in Netcash under NetConnector > Debit Orders).
 *
 * Bank details are typed into Netcash's page, never ours, so this site never
 * holds an account number. The postback does carry one; it is cut down to the
 * last three digits before anything is stored or logged.
 *
 * In demo mode step 2 is /start/demo-mandate, a local stand-in that ends by
 * feeding a made-up postback through the same px_mandate_postback() below.
 */
declare(strict_types=1);

/** Starts a mandate for $client and returns the URL to send the browser to. */
function px_mandate_start(array $client, string $purpose): string
{
    $count = (int) (px_row('SELECT COUNT(*) AS n FROM mandates WHERE client_id = ?', [$client['id']])['n'] ?? 0);
    $agreementRef = $client['ref'] . '-' . ($count + 1);
    $secret = px_token(16);
    px_q(
        'INSERT INTO mandates (client_id, purpose, agreement_ref, secret, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [$client['id'], $purpose, $agreementRef, $secret, 'sent', px_now()]
    );
    $mandateId = (int) px_db()->lastInsertId();

    if (px_mode() === 'demo') {
        $url = '/start/demo-mandate';
    } else {
        $url = px_netcash_add_mandate($client, $mandateId, $agreementRef, $secret);
    }
    px_q('UPDATE mandates SET mandate_url = ? WHERE id = ?', [$url, $mandateId]);
    px_q("UPDATE clients SET mandate_status = CASE WHEN mandate_status = 'signed' THEN 'signed' ELSE 'sent' END, updated_at = ? WHERE id = ?", [px_now(), $client['id']]);
    px_event((int) $client['id'], 'mandate_sent', $purpose === 'update' ? 'New debit order started (bank details change)' : 'Debit order sent for signing');
    return $url;
}

function px_xml(string|int|float|bool|null $v): string
{
    if (is_bool($v)) {
        return $v ? 'true' : 'false';
    }
    return htmlspecialchars((string) $v, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

/** Calls Netcash AddMandate. Returns the MandateUrl or fails the request with a friendly error. */
function px_netcash_add_mandate(array $client, int $mandateId, string $agreementRef, string $secret): string
{
    $key = (string) px_cfg('netcash.debit_order_service_key', '');
    if ($key === '') {
        px_fail('Payments are not set up yet. Please call us on +27 66 241 2155.', 503);
    }
    $isCompany = $client['entity_type'] === 'company';
    $first = new DateTimeImmutable($client['first_debit_date'] ?: px_first_debit_date($client['debit_day'])->format('Y-m-d'));
    $amount = number_format(((int) $client['amount_cents']) / 100, 2, '.', '');
    $mobile = preg_replace('/\D/', '', $client['mobile']) ?? '';
    if (str_starts_with($mobile, '27')) {
        $mobile = '0' . substr($mobile, 2);
    }
    $includeDebiCheck = (bool) px_cfg('netcash.include_debicheck', true);

    // Order matters: WCF reads these in the order of the published schema.
    $fields = [
        'ServiceKey' => $key,
        'AccountReference' => $client['ref'],
        'MandateName' => mb_substr($client['business_name'], 0, 50),
        'MandateAmount' => $amount,
        'IsConsumer' => !$isCompany,
        'FirstName' => $client['first_name'],
        'Surname' => $client['last_name'],
        'TradingName' => $isCompany ? $client['business_name'] : null,
        'RegistrationNumber' => $isCompany ? $client['reg_number'] : null,
        'RegisteredName' => $isCompany ? ($client['registered_name'] ?: $client['business_name']) : null,
        'MobileNumber' => $mobile,
        'DebitFrequency' => 'Monthly',
        'CommencementMonth' => (int) $first->format('n'),
        'CommencementDay' => str_pad($client['debit_day'], 2, '0', STR_PAD_LEFT),
        'AgreementDate' => date('Ymd'),
        'AgreementReferenceNumber' => $agreementRef,
        'CancellationNoticePeriod' => (int) px_cfg('netcash.cancellation_notice_days', 30),
        'PublicHolidayOption' => (string) px_cfg('netcash.public_holiday_option', 'VeryNextOrdinaryBusinessDay'),
        'Notes' => 'Position Xero ' . px_cfg('plan.name', 'Website Plan'),
        // Field1 and Field2 come back in the postback. The secret proves the
        // postback is about a mandate we started; nobody else knows it.
        'Field1' => $secret,
        'Field2' => (string) $mandateId,
        'AllowVariableDebitAmounts' => false,
        'EmailAddress' => $client['email'],
        'DebitMasterfileGroup' => px_cfg('netcash.masterfile_group') ?: null,
        'MandateActive' => true,
        'IncludeDebiCheck' => $includeDebiCheck,
        'DebiCheckMandateTemplateId' => $includeDebiCheck ? (string) px_cfg('netcash.debicheck_template_id', '') : null,
        'DebiCheckCollectionAmount' => $includeDebiCheck ? $amount : null,
        'DebiCheckFirstCollectionDiffers' => $includeDebiCheck ? false : null,
        'DebiCheckCollectionDayCode' => $includeDebiCheck ? 'MNTH_' . str_pad($client['debit_day'], 2, '0', STR_PAD_LEFT) : null,
        'AddToMasterFile' => true,
    ];
    $body = '';
    foreach ($fields as $name => $value) {
        if ($value === null || $value === '') {
            continue;
        }
        $body .= "<tem:{$name}>" . px_xml($value) . "</tem:{$name}>";
    }
    $envelope = '<?xml version="1.0" encoding="utf-8"?>'
        . '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">'
        . '<soapenv:Header/><soapenv:Body><tem:AddMandate>' . $body . '</tem:AddMandate></soapenv:Body></soapenv:Envelope>';

    $ch = curl_init((string) px_cfg('netcash.endpoint', 'https://ws.netcash.co.za/NIWS/NIWS_NIF.svc'));
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $envelope,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Content-Type: text/xml; charset=utf-8',
            'SOAPAction: "http://tempuri.org/INIWS_NIF/AddMandate"',
        ],
    ]);
    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $status >= 500 && !str_contains((string) $response, 'AddMandateResponse')) {
        px_log('netcash', "AddMandate HTTP {$status} for {$agreementRef}: " . ($curlError ?: substr((string) $response, 0, 500)));
        px_fail('We could not reach the debit order service. Please try again in a minute.', 502);
    }

    $doc = new DOMDocument();
    if (!@$doc->loadXML((string) $response)) {
        px_log('netcash', "AddMandate unreadable reply for {$agreementRef}: " . substr((string) $response, 0, 500));
        px_fail('The debit order service gave an unexpected answer. Please try again.', 502);
    }
    $pick = function (string $tag) use ($doc): string {
        $n = $doc->getElementsByTagNameNS('*', $tag)->item(0);
        return $n ? trim($n->textContent) : '';
    };
    $list = function (string $tag) use ($doc): array {
        $n = $doc->getElementsByTagNameNS('*', $tag)->item(0);
        $out = [];
        if ($n) {
            foreach ($n->childNodes as $c) {
                if (trim($c->textContent) !== '') {
                    $out[] = trim($c->textContent);
                }
            }
        }
        return $out;
    };
    $url = $pick('MandateUrl');
    $code = $pick('ErrorCode');
    $errors = $list('Errors');
    $warnings = $list('Warnings');
    if ($warnings) {
        px_log('netcash', "AddMandate warnings for {$agreementRef}: " . implode(' | ', $warnings));
    }
    if ($url === '' || ($code !== '' && $code !== '000' && $code !== '0')) {
        px_log('netcash', "AddMandate failed for {$agreementRef}: code={$code} errors=" . implode(' | ', $errors));
        px_q("UPDATE mandates SET status = 'error', reason = ? WHERE id = ?", [mb_substr(implode('; ', $errors) ?: "code {$code}", 0, 500), $mandateId]);
        px_fail('The debit order could not be started: ' . ($errors[0] ?? 'please check your details and try again') . '.', 422);
    }
    return $url;
}

function px_truthy(mixed $v): bool
{
    return in_array(strtolower(trim((string) $v)), ['true', '1', 'yes', 'y'], true);
}

/**
 * Applies a Netcash mandate postback. Returns [httpCode, message].
 * Idempotent: Netcash retries postbacks, and a repeat changes nothing.
 */
function px_mandate_postback(array $post): array
{
    $mandateId = (int) ($post['Field2'] ?? 0);
    $secret = (string) ($post['Field1'] ?? '');
    $mandate = $mandateId > 0 ? px_row('SELECT * FROM mandates WHERE id = ?', [$mandateId]) : null;
    if (!$mandate || $secret === '' || !hash_equals($mandate['secret'], $secret)) {
        px_log('netcash', 'Postback refused: unknown mandate or wrong secret (AccountRef=' . substr((string) ($post['AccountRef'] ?? ''), 0, 30) . ')');
        return [403, 'unknown mandate'];
    }
    if (in_array($mandate['status'], ['signed', 'declined'], true)) {
        return [200, 'already recorded'];
    }
    $client = px_row('SELECT * FROM clients WHERE id = ?', [$mandate['client_id']]);
    if (!$client) {
        return [404, 'unknown client'];
    }

    $signed = px_truthy($post['MandateSuccessful'] ?? '') && !px_truthy($post['IsDeclined'] ?? '');
    $reason = mb_substr(trim((string) ($post['ReasonForDecline'] ?? '')), 0, 300);
    $acct = preg_replace('/\D/', '', (string) ($post['BankAccountNo'] ?? '')) ?? '';
    $bankSummary = trim(implode(' ', array_filter([
        mb_substr((string) ($post['BankName'] ?? ''), 0, 40),
        mb_substr((string) ($post['BankAccountType'] ?? ''), 0, 20),
        $acct !== '' ? '••• ' . substr($acct, -3) : '',
    ])));

    px_q(
        'UPDATE mandates SET status = ?, netcash_ref = ?, pdf_link = ?, reason = ?, bank_summary = ?, completed_at = ? WHERE id = ?',
        [$signed ? 'signed' : 'declined', mb_substr((string) ($post['MandateReferenceNumber'] ?? ''), 0, 60) ?: null,
         mb_substr((string) ($post['MandatePDFLink'] ?? ''), 0, 500) ?: null, $reason ?: null, $bankSummary ?: null, px_now(), $mandateId]
    );
    $now = px_now();

    if (!$signed) {
        if ($mandate['purpose'] === 'signup' && $client['mandate_status'] !== 'signed') {
            px_q("UPDATE clients SET mandate_status = 'declined', status = 'mandate_declined', updated_at = ? WHERE id = ?", [$now, $client['id']]);
        }
        px_event((int) $client['id'], 'mandate_declined', 'Debit order not approved' . ($reason ? ": {$reason}" : ''));
        px_notify_client($client, 'mandate_declined', ['reason' => $reason]);
        px_notify_team('Debit order declined', [
            'Client' => $client['business_name'], 'Reference' => $client['ref'], 'Reason' => $reason ?: 'not given',
        ], px_admin_link($client));
        return [200, 'declined recorded'];
    }

    // Signed.
    $firstDebit = $client['first_debit_date'];
    if ($mandate['purpose'] === 'signup' || !$firstDebit) {
        $firstDebit = px_first_debit_date($client['debit_day'])->format('Y-m-d');
    }
    px_q(
        "UPDATE clients SET mandate_status = 'signed', mandate_ref = ?, mandate_pdf = ?, mandate_signed_at = ?,
            status = CASE WHEN status IN ('pending_mandate', 'mandate_declined') THEN 'active' ELSE status END,
            first_debit_date = ?, updated_at = ? WHERE id = ?",
        [mb_substr((string) ($post['MandateReferenceNumber'] ?? $mandate['agreement_ref']), 0, 60), mb_substr((string) ($post['MandatePDFLink'] ?? ''), 0, 500) ?: null,
         $now, $firstDebit, $now, $client['id']]
    );
    $client = px_row('SELECT * FROM clients WHERE id = ?', [$client['id']]);
    $firstLabel = (new DateTimeImmutable($firstDebit))->format('j F Y');

    if ($mandate['purpose'] === 'signup') {
        px_event((int) $client['id'], 'mandate_signed', "Debit order signed. First debit {$firstLabel}");
        if (!px_row("SELECT 1 FROM payments WHERE client_id = ? AND pay_date = ?", [$client['id'], $firstDebit])) {
            px_q("INSERT INTO payments (client_id, amount_cents, status, pay_date, note, created_at) VALUES (?, ?, 'scheduled', ?, 'First debit', ?)",
                [$client['id'], $client['amount_cents'], $firstDebit, $now]);
        }
        if ($client['password_hash'] === null) {
            $raw = px_token(24);
            px_q('UPDATE clients SET account_token_hash = ?, account_token_expires = ? WHERE id = ?',
                [px_hash_token($raw), date('Y-m-d H:i:s', time() + 7 * 86400), $client['id']]);
            $link = px_site_url() . '/start/done#ref=' . rawurlencode($client['ref']) . '&k=' . $raw;
            px_notify_client($client, 'account_link', ['link' => $link, 'first_debit' => $firstLabel]);
        }
        px_notify_team('New client signed', [
            'Client' => $client['business_name'],
            'Contact' => "{$client['first_name']} {$client['last_name']}",
            'Email' => $client['email'],
            'Mobile' => $client['mobile'],
            'Reference' => $client['ref'],
            'First debit' => $firstLabel,
        ], px_admin_link($client));
    } else {
        px_event((int) $client['id'], 'mandate_signed', 'New debit order signed (bank details changed)');
        px_notify_client($client, 'bank_updated', ['next_debit' => (string) px_next_debit_date($client)]);
        px_notify_team('Client changed bank details', ['Client' => $client['business_name'], 'Reference' => $client['ref']], px_admin_link($client));
    }
    return [200, 'signed recorded'];
}
