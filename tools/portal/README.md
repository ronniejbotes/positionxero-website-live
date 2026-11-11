# Website Plan: funnel and client portal

R1,000 a month by DebiCheck debit order. We build the client's website from a brief they send through their own portal, then host it, secure it, keep the SEO in order, read their Google Analytics monthly, and make two changes a month. The portal carries the communication: progress, preview approval, change requests, the monthly report and billing.

This lives on the branch `feat/website-plan-portal` and is **not linked from anywhere on the live site**. Every new page is `noindex`, nothing is in `sitemap.xml` or `llms.txt`, and the only existing file touched is `.gitignore`.

## The sequence

| Step | Page | What happens |
| --- | --- | --- |
| 1 | `/website-plan` | Landing page. Plan, what's in it, how it works, FAQ, "Start your Website Plan". |
| 2 | `/start/` | Three steps: details, debit date, review. On submit the server calls Netcash `AddMandate`. |
| 3 | Netcash's mandate page | Client gets an OTP, types their bank details **on Netcash's site**, signs, approves DebiCheck in their banking app. Locally this is `/start/demo-mandate`. |
| 4 | `/api/netcash-mandate.php` | Netcash posts the result. Signed: client is active, first debit scheduled, "create your account" email sent, team notified. Declined: "try again" email. |
| 5 | `/start/done` | Waits for the signed mandate, then the client chooses a password. The same page opens from the emailed link (`#ref=...&k=...`, 7 days). |
| 6 | `/portal/` Brief | Five sections plus "Check and send": business, brand (logo, colours, feel, sites they like), pages and words, photos, contact details, socials, domain, extras. Saves as they type. Uploads go outside the web root. |
| 7 | Stages | Brief → Building → Review (preview link, approve or ask for changes) → Launch → Live. The team moves the stage in admin; Review and Live email the client. |
| 8 | `/portal/` Changes | Two changes per calendar month, enforced on the server. "Something is broken" never counts. Before launch, clients can send the build team notes. |
| 9 | `/portal/` Overview | Stage tracker, next step, changes left, next debit, monthly care report, activity. |
| 10 | `/portal/` Billing | Plan, next debit, bank account (last three digits only), debits, change bank details (signs a new mandate), cancel request. |
| 11 | `/portal/admin` | Work queue (problems first), every client, stage and links, brief and files (zip download), requests, care log, "email this month's report", debits, mandates, activity, email outbox. |

Every email the portal sends is in `public/api/portal-lib/mail.php`.

## Files

```
public/website-plan.html            landing page
public/start/                       sign-up, create login, demo mandate
public/portal/                      client portal and admin
public/css/portal.css               px-* classes, built on style.css tokens
public/js/portal-*.js               core helpers, sign-up, portal, admin
public/api/portal.php               JSON API (?a=action)
public/api/netcash-mandate.php      Netcash mandate postback
public/api/portal-lib/              config sample, DB schema, Netcash, mail, brief (denied by .htaccess)
tools/portal/dev-router.php         local preview with PHP
```

PHP 8.1+, `pdo_sqlite`, `curl`, `fileinfo`, `zip` (zip only for the admin download). No Composer, no Node at runtime. Vite copies `public/` as is, so the build needs nothing new.

## Run it locally

```bash
php -S 127.0.0.1:8833 -t public tools/portal/dev-router.php
```

Without a config file it runs in demo mode on localhost only: the debit order is simulated and emails are written to `px-portal-data/mail/` (and shown in the admin Outbox) instead of being sent. Admin sign-in needs `admin.password_hash` in a `px-portal-config.php` next to `public/` (git-ignored).

## Going live

1. **Hosting.** It needs PHP on the host. Put `px-portal-config.php` in the folder above `public_html` (copy `public/api/portal-lib/config.sample.php`). Client data goes to `px-portal-data/` next to it, outside the web root. Hostinger deploys replace `public_html`, so nothing that matters lives inside it.
2. **Netcash** (Debit Order service with DebiCheck):
   - Debit Order service with DebiCheck and the eMandate service switched on.
   - A DebiCheck mandate template; put its ID in `netcash.debicheck_template_id`.
   - The Debit Order service key in `netcash.debit_order_service_key`.
   - Mandate postback URL, under NetConnector > Debit Orders: `https://www.positionxero.com/api/netcash-mandate.php`.
   - Ask Netcash whether the mandate site can send the client back to `/start/done` after signing. If it can't, the emailed link covers it.
   - Set `mode` to `netcash`.
3. **Email.** `mail.mode` = `smtp`, a mailbox for `mail.from`, and its password in a file outside the web root (`mail.smtp.password_file`). PHP `mail()` lands in spam.
4. **Admin password.** `php -r 'echo password_hash("...", PASSWORD_DEFAULT), "\n";'` into `admin.password_hash`.
5. **Pages.** Remove `noindex` from `/website-plan`, add it to `sitemap.xml` and `llms.txt`, and link it from wherever the plan is sold. The portal pages stay `noindex`.

## Not built yet

- **Collecting the monthly R1,000.** Signing a mandate does not move money. Netcash collects when a debit batch is submitted. Either set up a recurring batch from the master file in Netcash's back office (`AddToMasterFile` is on), or add a monthly job that calls `BatchFileUpload`. Confirm with Netcash which they recommend for DebiCheck. Until then the team records each month's result in admin under Debits, and the client sees it under Billing.
- **Failed debits.** No automatic suspension or reminder when a debit bounces.
- **Netcash `PostbackVerify`.** Postbacks are trusted through a per-mandate secret in `Field1`. Netcash also offers `PostbackVerify` as a second check.
- **The AddMandate call has only been checked against Netcash's published schema**, not against a live account. Test it with Netcash's test credentials before launch.

## Before launch

The plan's commercial terms (minimum term, ownership on cancellation, plan terms page, what counts as a change, copywriting and logo design, debit dates) are not settled. The pages word these neutrally until they are. That list is kept outside this public repository.
