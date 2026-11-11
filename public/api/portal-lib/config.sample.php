<?php
/**
 * Website Plan portal: sample configuration.
 *
 * Copy this file to px-portal-config.php in the folder ABOVE the web root
 * (next to public_html on Hostinger, next to public/ when running locally)
 * and fill it in. That copy holds secrets, so it never goes in the
 * repository: this repository is public.
 *
 *   /home/<user>/domains/<site>/px-portal-config.php   <- the real config
 *   /home/<user>/domains/<site>/px-portal-data/        <- database, uploads, logs
 *   /home/<user>/domains/<site>/public_html/           <- the site
 *
 * With no config file the portal runs in demo mode on localhost only, and
 * answers "not configured" anywhere else, so a deploy can never quietly
 * accept fake debit orders.
 */
return [
    // 'demo' simulates the Netcash mandate page so the whole sequence can be
    // clicked through locally. 'netcash' calls Netcash for real.
    'mode' => 'demo',

    // Used to build links in emails. No trailing slash.
    'site_url' => 'https://www.positionxero.com',

    // Where the SQLite database, uploads, sessions and logs live. Must be
    // outside the web root. null = <folder above the web root>/px-portal-data
    'data_dir' => null,

    'plan' => [
        'name' => 'Website Plan',
        'amount' => 1000.00,            // rand, per month
        'changes_per_month' => 2,
        // Debit days a client can pick (day of the month, two digits).
        'debit_days' => ['01', '15', '25', '26'],
        // Business days between signing and the first debit. DebiCheck
        // needs some lead time; confirm the number with Netcash.
        'first_debit_lead_days' => 3,
        // Shown on the sign-up page next to the tick box.
        'terms_url' => '/terms',
    ],

    'netcash' => [
        // Netcash > Account Profile > NetConnector > Debit Orders service key
        'debit_order_service_key' => '',
        'endpoint' => 'https://ws.netcash.co.za/NIWS/NIWS_NIF.svc',
        'include_debicheck' => true,
        // The DebiCheck mandate template set up on the Netcash account.
        'debicheck_template_id' => '',
        'cancellation_notice_days' => 30,
        'public_holiday_option' => 'VeryNextOrdinaryBusinessDay', // or PrecedingOrdinaryBusinessDay
        // Optional: Netcash debit master file group to file these clients under.
        'masterfile_group' => '',
    ],

    'mail' => [
        // 'log' writes every email to px-portal-data/mail/ instead of sending
        // (and shows them in the admin Outbox). 'smtp' logs in to a mailbox.
        // 'mail' uses PHP mail(), which usually lands in spam.
        'mode' => 'log',
        'from' => 'hello@positionxero.com',
        'from_name' => 'Position Xero',
        // Who gets the team notifications (new sign-up, brief, change request).
        'team' => ['hello@positionxero.com'],
        'smtp' => [
            'host' => 'smtp.hostinger.com',
            'port' => 465,
            'user' => 'hello@positionxero.com',
            // Path to a file holding only the mailbox password, outside the web root.
            'password_file' => '',
        ],
    ],

    'admin' => [
        // php -r 'echo password_hash("your password", PASSWORD_DEFAULT), "\n";'
        // Empty = the admin screen refuses every login.
        'password_hash' => '',
    ],

    'uploads' => [
        'max_file_mb' => 15,
        'max_client_mb' => 300,
    ],
];
