<?php
/**
 * Website Plan portal: shared plumbing (config, database, sessions, guards).
 *
 * Only defines functions. Standard PHP 8.1+ with pdo_sqlite, nothing else
 * required (curl for real Netcash calls, zip for the admin "download all").
 */
declare(strict_types=1);

date_default_timezone_set('Africa/Johannesburg');

require_once __DIR__ . '/schema.php';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

/** The folder the site is served from (public_html on the host, public/ locally). */
function px_web_root(): string
{
    $root = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
    return $root !== '' ? $root : dirname(__DIR__, 2);
}

/** True on a developer's own machine: localhost, 127.0.0.1, ::1, *.localhost, *.test or the CLI. */
function px_is_local(): bool
{
    if (PHP_SAPI === 'cli') {
        return true;
    }
    $host = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')) ?? '');
    $host = trim($host, '[]');
    return in_array($host, ['localhost', '127.0.0.1', '::1'], true)
        || str_ends_with($host, '.localhost')
        || str_ends_with($host, '.test');
}

function px_merge(array $base, array $over): array
{
    foreach ($over as $k => $v) {
        if (is_array($v) && isset($base[$k]) && is_array($base[$k]) && array_is_list($v) === false) {
            $base[$k] = px_merge($base[$k], $v);
        } else {
            $base[$k] = $v;
        }
    }
    return $base;
}

/** The merged config: the sample's defaults with the real file laid over them. */
function px_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $config = require __DIR__ . '/config.sample.php';
    $config['_file'] = null;
    $candidates = array_filter([
        getenv('PX_PORTAL_CONFIG') ?: null,
        dirname(px_web_root()) . '/px-portal-config.php',
    ]);
    foreach ($candidates as $file) {
        if (is_file($file) && is_readable($file)) {
            $loaded = require $file;
            if (is_array($loaded)) {
                $config = px_merge($config, $loaded);
                $config['_file'] = $file;
            }
            break;
        }
    }
    return $config;
}

/** One config value by dotted path, e.g. px_cfg('plan.amount'). */
function px_cfg(string $path, mixed $default = null): mixed
{
    $node = px_config();
    foreach (explode('.', $path) as $key) {
        if (!is_array($node) || !array_key_exists($key, $node)) {
            return $default;
        }
        $node = $node[$key];
    }
    return $node;
}

function px_mode(): string
{
    return px_cfg('mode') === 'netcash' ? 'netcash' : 'demo';
}

/**
 * Refuses to run anywhere but localhost without a config file, and refuses
 * demo mode on a public host, so a deploy can never accept fake mandates.
 */
function px_assert_configured(): void
{
    $hasFile = px_cfg('_file') !== null;
    if (!$hasFile && !px_is_local()) {
        px_fail('The client portal is not configured on this server yet.', 503);
    }
    if (px_mode() === 'demo' && !px_is_local() && px_cfg('allow_demo_on_public_host') !== true) {
        px_fail('The client portal is in demo mode, which only runs locally.', 503);
    }
}

function px_site_url(): string
{
    if (px_is_local() && PHP_SAPI !== 'cli' && !empty($_SERVER['HTTP_HOST'])) {
        $scheme = px_is_https() ? 'https' : 'http';
        return $scheme . '://' . $_SERVER['HTTP_HOST'];
    }
    return rtrim((string) px_cfg('site_url', 'https://www.positionxero.com'), '/');
}

function px_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

function px_data_dir(string $sub = ''): string
{
    $base = px_cfg('data_dir') ?: dirname(px_web_root()) . '/px-portal-data';
    $dir = rtrim($base, '/') . ($sub !== '' ? '/' . trim($sub, '/') : '');
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
        px_fail('Storage is not writable on this server.', 500);
    }
    if ($sub === '' && !is_file($dir . '/.htaccess')) {
        // Belt and braces in case someone points data_dir inside the web root.
        @file_put_contents($dir . '/.htaccess', "Require all denied\n");
    }
    return $dir;
}

function px_db(): PDO
{
    static $db = null;
    if ($db instanceof PDO) {
        return $db;
    }
    $db = new PDO('sqlite:' . px_data_dir() . '/portal.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA busy_timeout = 5000');
    px_migrate($db);
    return $db;
}

function px_q(string $sql, array $params = []): PDOStatement
{
    $st = px_db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function px_row(string $sql, array $params = []): ?array
{
    $row = px_q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function px_rows(string $sql, array $params = []): array
{
    return px_q($sql, $params)->fetchAll();
}

function px_log(string $channel, string $message): void
{
    $line = '[' . date('Y-m-d H:i:s') . "] {$message}\n";
    @file_put_contents(px_data_dir('logs') . '/' . preg_replace('/[^a-z0-9-]/', '', $channel) . '.log', $line, FILE_APPEND | LOCK_EX);
}

/* ------------------------------------------------------------------ */
/* Responses and input                                                 */
/* ------------------------------------------------------------------ */

function px_json(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function px_ok(array $data = []): never
{
    px_json(['ok' => true] + $data);
}

function px_fail(string $message, int $code = 400, array $extra = []): never
{
    px_json(['ok' => false, 'error' => $message] + $extra, $code);
}

/** JSON body for JSON requests, form fields otherwise. */
function px_input(): array
{
    static $input = null;
    if ($input !== null) {
        return $input;
    }
    $type = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
    if (str_contains($type, 'application/json')) {
        $raw = file_get_contents('php://input') ?: '';
        if (strlen($raw) > 1_000_000) {
            px_fail('That request is too large.', 413);
        }
        $decoded = json_decode($raw, true);
        $input = is_array($decoded) ? $decoded : [];
    } else {
        $input = $_POST;
    }
    return $input;
}

/** A trimmed, length-capped string from an array, with control characters removed. */
function px_str(array $from, string $key, int $max = 300): string
{
    $v = $from[$key] ?? '';
    if (!is_scalar($v)) {
        return '';
    }
    $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) $v) ?? '');
    return mb_substr($v, 0, $max);
}

function px_now(): string
{
    return date('Y-m-d H:i:s');
}

function px_token(int $bytes = 24): string
{
    return bin2hex(random_bytes($bytes));
}

function px_hash_token(string $raw): string
{
    return hash('sha256', $raw);
}

/* ------------------------------------------------------------------ */
/* Sessions and guards                                                 */
/* ------------------------------------------------------------------ */

function px_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $lifetime = 60 * 60 * 24 * 30;
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    ini_set('session.use_strict_mode', '1');
    session_save_path(px_data_dir('sessions'));
    session_name('pxportal');
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => px_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/**
 * Every state-changing request must come from our own pages: it must be a
 * POST, carry the X-PX-Portal header (a cross-site form cannot set custom
 * headers, and we answer no CORS preflight), and not be flagged cross-site.
 */
function px_require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        px_fail('Use POST for this.', 405);
    }
    if (($_SERVER['HTTP_X_PX_PORTAL'] ?? '') !== '1') {
        px_fail('Missing request header.', 403);
    }
    $site = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($site !== '' && !in_array($site, ['same-origin', 'none'], true)) {
        px_fail('Cross-site request refused.', 403);
    }
}

function px_current_client(): ?array
{
    px_session();
    $id = (int) ($_SESSION['client_id'] ?? 0);
    if ($id <= 0) {
        return null;
    }
    $client = px_row('SELECT * FROM clients WHERE id = ?', [$id]);
    if (!$client || $client['password_hash'] === null || $client['status'] === 'cancelled') {
        unset($_SESSION['client_id']);
        return null;
    }
    return $client;
}

function px_require_client(): array
{
    $client = px_current_client();
    if (!$client) {
        px_fail('Please sign in again.', 401, ['signed_out' => true]);
    }
    return $client;
}

function px_is_admin(): bool
{
    px_session();
    return !empty($_SESSION['admin']) && ($_SESSION['admin_until'] ?? 0) > time();
}

function px_require_admin(): void
{
    if (!px_is_admin()) {
        px_fail('Please sign in to the admin screen.', 401, ['signed_out' => true]);
    }
    $_SESSION['admin_until'] = time() + 60 * 60 * 8;
}

function px_client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/** Allows $max hits per $window seconds for $key, then refuses with 429. */
function px_rate_limit(string $key, int $max, int $window): void
{
    $now = time();
    $k = hash('sha256', $key);
    $row = px_row('SELECT hits, window_start FROM rate_limits WHERE k = ?', [$k]);
    if (!$row || $now - (int) $row['window_start'] >= $window) {
        px_q('INSERT OR REPLACE INTO rate_limits (k, hits, window_start) VALUES (?, 1, ?)', [$k, $now]);
        return;
    }
    if ((int) $row['hits'] >= $max) {
        $wait = (int) ceil(($window - ($now - (int) $row['window_start'])) / 60);
        px_fail("Too many attempts. Try again in {$wait} minute" . ($wait === 1 ? '' : 's') . '.', 429);
    }
    px_q('UPDATE rate_limits SET hits = hits + 1 WHERE k = ?', [$k]);
}

/* ------------------------------------------------------------------ */
/* Domain helpers                                                      */
/* ------------------------------------------------------------------ */

function px_event(int $clientId, string $type, string $message): void
{
    px_q('INSERT INTO events (client_id, type, message, created_at) VALUES (?, ?, ?, ?)', [$clientId, $type, $message, px_now()]);
}

function px_month_key(?DateTimeImmutable $d = null): string
{
    return ($d ?? new DateTimeImmutable('now'))->format('Y-m');
}

function px_month_label(string $key): string
{
    $d = DateTimeImmutable::createFromFormat('!Y-m', $key);
    return $d ? $d->format('F Y') : $key;
}

/** Adds $days business days (Monday to Friday) to $from. Public holidays are left to Netcash. */
function px_add_business_days(DateTimeImmutable $from, int $days): DateTimeImmutable
{
    $d = $from;
    while ($days > 0) {
        $d = $d->modify('+1 day');
        if ((int) $d->format('N') <= 5) {
            $days--;
        }
    }
    return $d;
}

/**
 * The first debit date for a debit day ("01" to "28"): this month's date if it
 * is at least the lead time away, otherwise next month's.
 */
function px_first_debit_date(string $day, ?DateTimeImmutable $from = null): DateTimeImmutable
{
    $from = ($from ?? new DateTimeImmutable('today'))->setTime(0, 0);
    $earliest = px_add_business_days($from, (int) px_cfg('plan.first_debit_lead_days', 3));
    $dom = max(1, min(28, (int) $day));
    $month = $from->modify('first day of this month');
    for ($i = 0; $i < 3; $i++) {
        $candidate = $month->setDate((int) $month->format('Y'), (int) $month->format('n'), $dom);
        if ($candidate >= $earliest) {
            return $candidate;
        }
        $month = $month->modify('first day of next month');
    }
    return $candidate;
}

/** The next debit on or after today, given the first debit date and the debit day. */
function px_next_debit_date(array $client): ?string
{
    if (!in_array($client['status'], ['active', 'cancel_requested'], true) || !$client['first_debit_date']) {
        return null;
    }
    $first = new DateTimeImmutable($client['first_debit_date']);
    $today = new DateTimeImmutable('today');
    if ($first >= $today) {
        return $first->format('Y-m-d');
    }
    $dom = (int) $client['debit_day'];
    $candidate = $today->setDate((int) $today->format('Y'), (int) $today->format('n'), $dom);
    if ($candidate < $today) {
        $next = $today->modify('first day of next month');
        $candidate = $next->setDate((int) $next->format('Y'), (int) $next->format('n'), $dom);
    }
    return $candidate->format('Y-m-d');
}

function px_new_ref(): string
{
    for ($i = 0; $i < 20; $i++) {
        $ref = 'PXW' . random_int(10000, 99999);
        if (!px_row('SELECT 1 FROM clients WHERE ref = ?', [$ref])) {
            return $ref;
        }
    }
    return 'PXW' . strtoupper(substr(px_token(4), 0, 8));
}

function px_amount(): float
{
    return round((float) px_cfg('plan.amount', 1000), 2);
}

function px_money(int|float $cents_or_rand, bool $isCents = true): string
{
    $rand = $isCents ? $cents_or_rand / 100 : $cents_or_rand;
    return 'R' . number_format((float) $rand, (fmod((float) $rand, 1.0) === 0.0) ? 0 : 2, '.', ',');
}

/** Change requests used and left this calendar month. */
function px_quota(int $clientId): array
{
    $month = px_month_key();
    $used = (int) (px_row(
        "SELECT COUNT(*) AS n FROM requests WHERE client_id = ? AND type = 'change' AND counts = 1 AND month_key = ? AND status <> 'declined'",
        [$clientId, $month]
    )['n'] ?? 0);
    $allowed = (int) px_cfg('plan.changes_per_month', 2);
    $resets = (new DateTimeImmutable('first day of next month'))->format('Y-m-d');
    return ['month' => $month, 'allowed' => $allowed, 'used' => $used, 'left' => max(0, $allowed - $used), 'resets_on' => $resets];
}

/** The parts of a client row that the client and the pages may see. */
function px_client_public(array $c): array
{
    return [
        'ref' => $c['ref'],
        'email' => $c['email'],
        'first_name' => $c['first_name'],
        'last_name' => $c['last_name'],
        'business_name' => $c['business_name'],
        'mobile' => $c['mobile'],
        'entity_type' => $c['entity_type'],
        'status' => $c['status'],
        'stage' => $c['stage'],
        'preview_url' => $c['preview_url'],
        'live_url' => $c['live_url'],
        'debit_day' => $c['debit_day'],
        'amount' => ((int) $c['amount_cents']) / 100,
        'mandate_status' => $c['mandate_status'],
        'mandate_ref' => $c['mandate_ref'],
        'first_debit_date' => $c['first_debit_date'],
        'next_debit_date' => px_next_debit_date($c),
        'review_round' => (int) $c['review_round'],
        'created_at' => $c['created_at'],
    ];
}

function px_file_public(array $f): array
{
    return [
        'id' => (int) $f['id'],
        'kind' => $f['kind'],
        'request_id' => $f['request_id'] !== null ? (int) $f['request_id'] : null,
        'name' => $f['orig_name'],
        'mime' => $f['mime'],
        'size' => (int) $f['size'],
        'is_image' => in_array($f['mime'], ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true),
        'created_at' => $f['created_at'],
    ];
}

function px_request_public(array $r, array $files = []): array
{
    return [
        'id' => (int) $r['id'],
        'type' => $r['type'],
        'title' => $r['title'],
        'page' => $r['page'],
        'details' => $r['details'],
        'status' => $r['status'],
        'team_note' => $r['team_note'],
        'counts' => (bool) $r['counts'],
        'month' => $r['month_key'],
        'created_at' => $r['created_at'],
        'completed_at' => $r['completed_at'],
        'files' => array_map('px_file_public', array_values(array_filter($files, fn ($f) => (int) $f['request_id'] === (int) $r['id']))),
    ];
}
