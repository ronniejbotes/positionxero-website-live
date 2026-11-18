<?php
/**
 * Local preview of the site with the Website Plan portal running.
 *
 *   php -S 127.0.0.1:8833 -t public tools/portal/dev-router.php
 *
 * PHP's built-in server ignores .htaccess, so this does the two jobs the live
 * Apache config does for these pages: serve /website-plan from
 * website-plan.html, and refuse /api/portal-lib/. Vite's dev server cannot
 * run PHP, which is why the portal is previewed this way instead.
 */
$root = rtrim($_SERVER['DOCUMENT_ROOT'], '/');
$uri = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

if (preg_match('#^/api/portal-lib(/|$)#', $uri) || str_contains($uri, '..')) {
    http_response_code(404);
    echo 'Not found';
    return true;
}
$path = $root . $uri;
if (is_file($path)) {
    return false; // the built-in server serves it (and runs .php files)
}
if (is_dir($path)) {
    if (!str_ends_with($uri, '/')) {
        header('Location: ' . $uri . '/', true, 301);
        return true;
    }
    return false; // index.html
}
$html = $root . rtrim($uri, '/') . '.html';
if (is_file($html)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($html);
    return true;
}
http_response_code(404);
readfile($root . '/404.html');
return true;
