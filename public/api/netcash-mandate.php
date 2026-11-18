<?php
/**
 * Netcash posts the result of every signed (or declined) eMandate here.
 * Set this URL once in Netcash: Account Profile > NetConnector > Debit Orders,
 * "Mandate postback URL":  https://www.positionxero.com/api/netcash-mandate.php
 *
 * Trust comes from Field1, a random secret we sent with AddMandate that only
 * Netcash and our database know. See px_mandate_postback() for the rest.
 */
declare(strict_types=1);

require __DIR__ . '/portal-lib/bootstrap.php';
require __DIR__ . '/portal-lib/mail.php';
require __DIR__ . '/portal-lib/netcash.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo 'POST only';
    exit;
}
if (px_cfg('_file') === null && !px_is_local()) {
    http_response_code(503);
    echo 'not configured';
    exit;
}

[$code, $message] = px_mandate_postback($_POST);
px_log('netcash', "Postback {$code} {$message} (AccountRef=" . substr((string) ($_POST['AccountRef'] ?? ''), 0, 30) . ')');
http_response_code($code);
header('Content-Type: text/plain; charset=utf-8');
echo $message;
