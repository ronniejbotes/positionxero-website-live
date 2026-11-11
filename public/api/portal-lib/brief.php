<?php
/**
 * Website Plan portal: the website brief.
 *
 * One map below names every section and field. The portal form, the
 * "what's missing" check, the admin view and the brief.txt in the download
 * all read from it, so a new question is added in one place (plus its input
 * in /js/portal-app.js).
 */
declare(strict_types=1);

const PX_BRIEF = [
    'business' => ['Your business', [
        'name' => 'Business or brand name',
        'tagline' => 'Tagline or slogan',
        'description' => 'What the business does',
        'services' => 'Main services or products',
        'areas' => 'Where you work',
        'audience' => 'Who your customers are',
        'different' => 'Why customers choose you',
        'established' => 'Year started',
    ]],
    'brand' => ['Brand identity', [
        'logo_status' => 'Logo',
        'colours' => 'Brand colours',
        'colours_note' => 'Colour notes',
        'fonts' => 'Fonts',
        'personality' => 'How the site should feel',
        'likes' => 'Websites they like',
        'avoid' => 'Things to avoid',
        'competitors' => 'Competitors',
    ]],
    'pages' => ['Pages and words', [
        'list' => 'Pages',
        'other' => 'Other pages',
        'copy_source' => 'Who writes the words',
        'copy_text' => 'Their own text',
        'stock_ok' => 'Stock photos where theirs run out',
    ]],
    'contact' => ['Contact details and domain', [
        'phone' => 'Phone on the site',
        'whatsapp' => 'WhatsApp number',
        'email' => 'Email for enquiries',
        'address' => 'Address',
        'show_address' => 'Show the address on the site',
        'hours' => 'Business hours',
        'socials' => 'Social profiles',
        'domain_status' => 'Domain',
        'domain' => 'Domain name',
        'domain_registrar' => 'Domain registered with',
        'domain_wishes' => 'Domain ideas',
        'current_site' => 'Current website',
    ]],
    'extras' => ['Extras', [
        'features' => 'Features',
        'booking_url' => 'Booking or quote link',
        'deadline' => 'Date to be live by',
        'notes' => 'Anything else',
    ]],
];

const PX_BRIEF_OPTIONS = [
    'logo_status' => ['have' => 'Has a logo (uploaded)', 'need' => 'No logo yet'],
    'copy_source' => ['mine' => 'Client supplies the text', 'brief' => 'Write it from this brief', 'mix' => 'Some of their text, we write the rest'],
    'domain_status' => ['own' => 'Already owns a domain', 'need' => 'Needs a domain'],
];

/** Recursively keeps strings, booleans and small lists or maps, capped in size and depth. */
function px_brief_clean_value(mixed $v, int $depth = 0): mixed
{
    if (is_bool($v)) {
        return $v;
    }
    if (is_int($v) || is_float($v)) {
        return (string) $v;
    }
    if (is_string($v)) {
        return mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? ''), 0, 6000);
    }
    if (is_array($v) && $depth < 3) {
        $out = [];
        $n = 0;
        foreach ($v as $k => $x) {
            if (++$n > 40) {
                break;
            }
            $key = is_int($k) ? $k : preg_replace('/[^a-z0-9_]/', '', strtolower((string) $k));
            if ($key === '') {
                continue;
            }
            $clean = px_brief_clean_value($x, $depth + 1);
            if ($clean !== null) {
                $out[$key] = $clean;
            }
        }
        return array_is_list($v) ? array_values($out) : $out;
    }
    return null;
}

/** Keeps only the sections and fields named in PX_BRIEF. */
function px_brief_clean(mixed $data): array
{
    $out = [];
    if (!is_array($data)) {
        return $out;
    }
    foreach (PX_BRIEF as $section => [, $fields]) {
        if (!isset($data[$section]) || !is_array($data[$section])) {
            continue;
        }
        foreach ($fields as $key => $label) {
            if (array_key_exists($key, $data[$section])) {
                $out[$section][$key] = px_brief_clean_value($data[$section][$key], 1);
            }
        }
    }
    return $out;
}

function px_brief_get(array $data, string $path): mixed
{
    $node = $data;
    foreach (explode('.', $path) as $k) {
        if (!is_array($node) || !array_key_exists($k, $node)) {
            return null;
        }
        $node = $node[$k];
    }
    return $node;
}

/** What still has to be filled in before the brief can be sent: [{field, message}]. */
function px_brief_problems(array $data, array $files): array
{
    $p = [];
    $s = fn (string $path) => trim((string) (is_scalar(px_brief_get($data, $path)) ? px_brief_get($data, $path) : ''));
    if ($s('business.name') === '') {
        $p[] = ['field' => 'business.name', 'message' => 'Add your business name.'];
    }
    if (mb_strlen($s('business.description')) < 20) {
        $p[] = ['field' => 'business.description', 'message' => 'Tell us what the business does, in a sentence or two.'];
    }
    $services = array_filter((array) (px_brief_get($data, 'business.services') ?? []), fn ($x) => is_array($x) && trim((string) ($x['name'] ?? '')) !== '');
    if (!$services) {
        $p[] = ['field' => 'business.services', 'message' => 'Add at least one service or product.'];
    }
    $logo = $s('brand.logo_status');
    $hasLogo = (bool) array_filter($files, fn ($f) => $f['kind'] === 'logo');
    if ($logo === '') {
        $p[] = ['field' => 'brand.logo_status', 'message' => 'Tell us whether you have a logo.'];
    } elseif ($logo === 'have' && !$hasLogo) {
        $p[] = ['field' => 'brand.logo_status', 'message' => 'Upload your logo, or choose "No logo yet".'];
    }
    if (!array_filter((array) (px_brief_get($data, 'pages.list') ?? []))) {
        $p[] = ['field' => 'pages.list', 'message' => 'Pick the pages you want.'];
    }
    if ($s('pages.copy_source') === '') {
        $p[] = ['field' => 'pages.copy_source', 'message' => 'Tell us who writes the words on the site.'];
    }
    if ($s('contact.phone') === '' && $s('contact.email') === '') {
        $p[] = ['field' => 'contact.phone', 'message' => 'Add a phone number or an email address for the site.'];
    }
    $domain = $s('contact.domain_status');
    if ($domain === '') {
        $p[] = ['field' => 'contact.domain_status', 'message' => 'Tell us about your domain name.'];
    } elseif ($domain === 'own' && $s('contact.domain') === '') {
        $p[] = ['field' => 'contact.domain', 'message' => 'Add the domain name you own.'];
    }
    return $p;
}

/** One field's value as readable text. */
function px_brief_value_text(string $key, mixed $v): string
{
    if ($v === null || $v === '' || $v === []) {
        return '';
    }
    if (is_bool($v)) {
        return $v ? 'Yes' : 'No';
    }
    if (isset(PX_BRIEF_OPTIONS[$key]) && is_string($v)) {
        return PX_BRIEF_OPTIONS[$key][$v] ?? $v;
    }
    if (is_array($v)) {
        $lines = [];
        foreach ($v as $k => $item) {
            if (is_array($item)) {
                if ($key === 'services') {
                    $line = trim(($item['name'] ?? '') . (!empty($item['desc']) ? ': ' . $item['desc'] : ''));
                } elseif ($key === 'likes') {
                    $line = trim(($item['url'] ?? '') . (!empty($item['note']) ? ' (' . $item['note'] . ')' : ''));
                } else {
                    $line = implode(', ', array_filter(array_map('strval', $item)));
                }
            } else {
                $line = is_string($k) ? ucfirst($k) . ': ' . $item : (string) $item;
            }
            if (trim($line) !== '' && trim($line) !== ':') {
                $lines[] = $line;
            }
        }
        $joinWithLines = in_array($key, ['services', 'likes', 'socials'], true);
        return implode($joinWithLines ? "\n" : ', ', $lines);
    }
    return (string) $v;
}

/** The brief as titled sections of label/value rows, empty answers left out. */
function px_brief_sections(array $data): array
{
    $out = [];
    foreach (PX_BRIEF as $section => [$title, $fields]) {
        $rows = [];
        foreach ($fields as $key => $label) {
            $text = px_brief_value_text($key, $data[$section][$key] ?? null);
            if ($text !== '') {
                $rows[] = ['label' => $label, 'value' => $text];
            }
        }
        if ($rows) {
            $out[] = ['title' => $title, 'rows' => $rows];
        }
    }
    return $out;
}

/** Plain-text brief for the download and for anyone reading it outside the portal. */
function px_brief_text(array $client, array $data): string
{
    $t = "WEBSITE BRIEF: {$client['business_name']} ({$client['ref']})\n";
    $t .= "Contact: {$client['first_name']} {$client['last_name']}, {$client['email']}, {$client['mobile']}\n";
    $t .= 'Exported ' . date('j F Y H:i') . "\n\n";
    foreach (px_brief_sections($data) as $section) {
        $t .= strtoupper($section['title']) . "\n" . str_repeat('-', mb_strlen($section['title'])) . "\n";
        foreach ($section['rows'] as $row) {
            $t .= $row['label'] . ":\n  " . str_replace("\n", "\n  ", $row['value']) . "\n";
        }
        $t .= "\n";
    }
    return $t;
}
