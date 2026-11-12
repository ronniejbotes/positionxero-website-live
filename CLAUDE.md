# Position Xero website

**This repo is the live site: `ronniejbotes/positionxero-website-live`.** positionxero.com deploys from `main`, automatically, in about 90 seconds.

It was called `alche-copy-website` until 2026-09-08, which is why a full day of work went into the wrong repo and had to be rebuilt here. The wrong one is `Keegshaumann/positionxero-website`: an older parallel copy, different design, deploys nowhere. Do not work in it.

## Structure

- **Root `index.html`, `packages.html`, `work.html`, `experience.html`, `cognexa.html`** are Vite entries, compiled to the hashed `/assets/*` bundles (so they need no `?v=` bump).
  - **`index.html` (the homepage), `packages.html` (`/packages`) and `work.html` (`/work`)** are the front pages built on 12 November 2026 and redesigned the same day after the owner's review. They load `/src/js/home.js` and `src/styles/home.css` only: no three.js, no WebGL. `index.html`, `packages.html` and `work.html` were written by a generator kept outside the repo, but they are plain HTML: edit them directly.
  - **`experience.html` (`/experience`)** is the immersive WebGL homepage that used to sit at `/`, moved unchanged apart from its head, a Packages link in the menu and footer, one line in the outro and one card tag ("No lock-in" instead of "Cancel anytime"). It loads `/src/js/main.js`. It is the live example of the immersive style; the "Looking for something more?" band under the packages names it, without a price.
  - `cognexa.html` loads `/src/js/subpage.js`. `/premium` and `/works` are gone (12 November 2026): `public/.htaccess` 301s `/premium` to `/packages#more` and `/works` to `/work`.
- **`public/`** is static passthrough: Vite copies it verbatim to the site root. Every other page lives here as hand-written HTML, along with `public/css/style.css`, `public/js/main.js`, `public/.htaccess`, `public/sitemap.xml` and `public/llms.txt`. A new static page needs no vite.config change.
- **`content/blog/*.md`** is dead legacy. Blog posts are hand-written HTML in `public/blog/`.
- Asset paths are always root-relative: `/css/style.css`, never `/public/css/...`, never `../`.
- **Microsoft Clarity** (heatmaps, owner approved 14 October 2026) is added at build time by the `px-clarity` plugin in `vite.config.js`, into the `<head>` of every built `.html` page, `public/` included. Do not paste the tag into a page by hand. It is disclosed on `/privacy`, section 6.
- **Google Analytics 4** (`G-SJ2ZVCFNTR`, 15 October 2026) is added the same way by the `px-google-analytics` plugin in `vite.config.js`, after the viewport meta of every built page. Do not paste it by hand. Disclosed on `/privacy`, sections 4 and 6.
- **Self-hosted fonts on `/free-audit` (18 October 2026).** `/free-audit` loads `/css/fonts.css` and `/fonts/*.woff2`, the exact Google Fonts files and `@font-face` rules for Archivo 600/700, Inter 400/500 and IBM Plex Mono 400, and preloads its two latin files, because the `fonts.googleapis.com` stylesheet was render-blocking there and held its first paint back (Lighthouse mobile around 70). Same files, so text looks identical. Every other page keeps the async Google Fonts link on purpose: tried on the SA landing pages the same day, same-origin fonts that arrive before the first paint get counted in LCP by Lighthouse's simulator (lab LCP about 1.0s to 1.7s, score 100 to 99) although the page paints at the same moment. Never give one page both the Google link and `fonts.css`, or the browser downloads two copies. A changed font file needs a new file name, because `/fonts/` is cached as immutable for a year.
- **Footer year** (14 October 2026): every footer prints `© <span data-year>2026</span> Position Xero`. The `px-footer-year` plugin in `vite.config.js` writes the build year into that span and adds a one-line script that sets the visitor's current year, so nobody edits years by hand at New Year. A new page copies the span; a bare "© 2026 Position Xero" is wrapped at build time anyway.

## Cache busting: bump the version or your change reaches nobody

`public/.htaccess` caches CSS and JS for a month. Both are referenced with a version query string:

```html
<link rel="stylesheet" href="/css/style.css?v=20260908" />
<script src="/js/main.js?v=20260908" defer></script>
```

**Whenever you change `public/css/style.css` or `public/js/main.js`, bump that version across all pages in `public/`**, or browsers and the edge cache keep serving the old file. This is not theoretical: on 2026-09-08 the intake overlay deployed correctly and did not run for exactly this reason, and it failed silently because the overlay's JS checks its CSS is present and bails out rather than rendering unstyled.

```bash
grep -rl 'v=20260908' public --include='*.html' | xargs sed -i '' 's/v=20260908/v=YYYYMMDD/g'
```

`/js/immersive.js` (the header retract, reveals and backdrop on every page in `public/`) is cached the same way and carries its own `?v=` since 28 October 2026: bump it too when that file changes.

**Pages are held at the CDN edge for a day (18 October 2026).** `public/.htaccess` sends `Cache-Control: public, max-age=0, s-maxage=86400` on every `.html` page except the 404, so Hostinger's CDN serves pages from the edge instead of fetching each one from the server (an audit had scored the uncached 0.72s response as slow; an edge hit answers in about 0.03s). Browsers still revalidate on every visit, and a deploy clears the edge: checked live twice that day, the cached homepage was replaced within about a minute of the new files landing, on both Johannesburg edge nodes. So allow a minute or two after a deploy before checking it. If it still does not show, check `x-hcdn-cache-status` and `age`, then flush the CDN in hPanel (Websites, Performance, CDN).

## Honest copy: who the company is

Position Xero is **founder-led** by Ronnie James Botes and Keegan Shane Haumann, but is **no longer only two people**. There is a person running paid ads, a sales team doing cold outreach and closing, and a second developer.

- Never write "just the two of us", "run by two people", "the two people running your account", "no account managers", "no handoffs", or that the founders personally do all the work. All of it used to be on the site and all of it is now false.
- The corrected position: day to day a client works with the person who actually runs their service, and a founder stays close to the account and joins meetings where they can. The surviving differentiator is that you deal with the person doing the work rather than a middleman relaying messages. Never write "always" about founder involvement.
- Never promise that "a founder" personally answers every enquiry. Keep the 24 hour promise, drop the claim about who. This includes hidden autoresponder fields in forms.
- Ronnie's background is web development and SEO. Keegan's is full-stack development, and other developers also do build work.
- **Only the two co-founders may be named, pictured or described.** Never add other employees.
- **Never publish a headcount**, in any wording. The real number is not authorised for the site and this repo is public.
- No invented client results, case studies, testimonials or client counts. No `LocalBusiness`, `GeoCoordinates`, `OpeningHoursSpecification`, `Review` or `AggregateRating` schema. The one `PostalAddress` is the homepage Organization's, and it carries only Centurion, Gauteng, ZA: the owner approved "Centurion, Gauteng" on 26 October 2026 (About, footers, Organization markup), never a street address.

## Numbers: no figure goes live without a source and a date

**Every number a visitor can read needs a link to the source it came from and the date that source was checked.** That covers percentages, counts, prices, durations, benchmark ranges, population and market figures, and the soft ones such as "most", "typically", "on average" and "up to". If a figure cannot be traced to a source you opened yourself, rewrite the sentence without it, or cut it. Never keep a number because it sounds right. The one exception is the business's own facts, which are covered by the last bullet below.

The whole pitch of this business is that it is the honest agency, so one checkable error costs more than any of these pages earn. AI-assisted drafting produces confident, specific, invented figures constantly. Assume they are in the draft and go looking.

- The source link sits in the same paragraph as the figure, not in a list at the foot of the page.
- Any page carrying a table of figures also carries a visible "Figures checked \<month year\>" line.
- Where the only available source is a vendor selling the thing being measured, say so in the sentence. Do not launder it into "industry benchmarks show".
- A figure in the visible text almost always appears again inside that page's JSON-LD, and sometimes in `llms.txt` and `pricing.md` as well. Change every copy in one go or the page contradicts itself.
- **Never publish a number of leads, a ranking position, or a date for page one.** A lead target is agreed with the client at kickoff, described as a target, and reported against. It is never printed on a sales page.
- **No guarantee of results, in any wording.** The 90-day cost-per-lead guarantee (a free fourth month) came off every page on 26 October 2026; the owner: "we can never guarantee something like that". What the site commits to is the work and the reporting: the target agreed at kickoff, the Day 30 report, the monthly video report, the 90-day review on `/how-we-work#review`, and month-to-month terms. Section 8 of `/terms` rules out guaranteed results.
- **South African prices are the four packages only (owner, 12 November 2026).** The custom once-off and monthly prices (landing page from R12,500, full website from R29,900, local SEO from R9,900, full SEO from R16,500) and the USD ads management prices on the SA pages and `/faq` were removed that day, with their FAQ and FAQPage copy, Offer markup, `pricing.md` and `llms.txt` lines. Anything the packages do not cover (ads management, online stores, immersive builds, bigger or multi-location projects) is "priced on your brief" through the WhatsApp message `Hi there, I would like to enquire about getting some of your offerings.` Never put a custom price back without a dated owner confirmation. The US-market pages (`/lead-generation-dallas`, `/hvac-marketing`, `/roofing-marketing`) and the international pages (`/ads`, `/web-design`, the US blog posts) keep their USD prices.
- **The business's own facts are the exception, and they are never cut for want of a link.** Prices, the response-time promise, turnaround commitments and the steps of our own process have no external source and never will. They are sourced by a dated written confirmation from Ronnie or Keegan, recorded in the plan folder beside the register. If one of those figures has no confirmation yet, ask for it and leave the figure alone. Do not strip the prices off the site because nothing outside the business can vouch for them.

An inventory of the figures published on the site, one row per line of source with its file and line number, is kept outside this repo at `SEO Program/plans/positionxero/number-register.md`. Built 2026-09-17 against commit `77bed45` across all 65 files that carry visible copy: 1,390 lines holding 3,258 figure instances in the first pass over 62 files, plus 4 figures found by hand in the 3 files that pass missed. 29 lines have any genuine source link within six lines. The register is a floor rather than a complete census: its extractor matched digits carrying a unit plus a fixed list of soft quantifiers, so bare counts and numbers written as words are under-counted. Work through that register rather than hunting page by page, and add anything it missed as you go.

## Three things the animated pages leave out on purpose

These used to be HTML comments inside the old homepage (now `experience.html`) and `works.html`. They were removed on 2026-09-17 because a comment is not private: anyone who views the page source reads it, and so does every AI crawler. The instructions themselves still stand, so they live here instead.

1. **Step 03 of the process section on `/experience` ships no time-to-live figure, deliberately.** The site contradicts itself on this, `/about` says 5 business days and `/ads`, `/lead-gen` and `/how-we-work` say 10, and nobody has picked one. Do not put a number back into that step until the figure is settled everywhere at once. That is task T-12 in the SEO plan.
2. **The `works-item__result` values on `/experience` and the "What we built" lines on `/work` describe scope, not measured outcomes.** They are outcome nouns ("Online quotes", "AI systems") on purpose. Do not swap them for numbers, dates or results unless the number is real, the client has agreed in writing to it being published, and it is recorded in the plan folder. **There is no date in that block now (T-10).** On 21 September 2026 the `/works` entry for Cajee Botes changed from "Client since 2021" to "Booked appointments", and on 12 October 2026 the homepage card's wrong "2021 / CLIENT SINCE" line became "Online bookings / LOCAL SEO + BOOKING", the same pattern as the other client cards. Do not add a date back without the written agreement described above.
3. **Showcase permission: `/works` was recorded on 21 September 2026 (T-02 lifted), and `/work`, which replaced it on 12 November 2026, rests on the owner's instruction that day: "we must have a FULL showcase if people want to see all the work we have done (just not eazy f&i)". The list, with the evidence that each site is our build, is in `client-permissions.md` in the plan folder. Eazy F&I, SIG Eagle Eye, Veena Chauhan and the Peak Leads Agency clients stay off it; D&D Luxury appears only as SEO work, because Hustlery built its store.** Ronnie confirmed in writing that all four businesses named there agreed to appear, and asked for more to be added. That record, with the source of each entry's description, is kept in the plan folder. A new entry needs the same before it goes up: permission recorded there first, and every claim in its description traceable to something real. Vital Socks, Austek Engineering and Peak Leads were added on 18 October 2026 on that basis. An `/experience` entry is three edits kept in the same order: a `.works-item` card, a `.works-scroll__item` spacer and a `WORKS` entry in `src/js/gl/works-media.js`, whose screenshot is a 1600x900 capture of the live site framed to leave out the client's own prices, figures and any faces.

## Voice: do not let it read as AI-written

- **No em dashes.** Not the character, not `&mdash;`. Every served file is at zero. Use commas, colons or full stops. `&ndash;` is fine inside number ranges.
- **No antithesis construction**: "it is not X, it is Y", "the problem isn't X, the problem is Y", "not because X but because Y". Say the positive thing directly. Twenty-four of these were rewritten out on 2026-09-08.
- Avoid: delve, leverage as a verb, robust, seamless, "Here's the thing", "At the end of the day", "It's worth noting", "In today's", "dive into", rule-of-three padding, one-word dramatic paragraphs.
- **British spelling** throughout: optimise, specialise, analyse, behaviour, organisation. Exceptions are schema.org property names such as `hiringOrganization`, which must stay as the spec defines them.
- House voice: direct, plain, specific. Short sentences mixed with long. No hype, no exclamation marks, no emoji.

Check before shipping:

```bash
grep -rc -e '—' -e '&mdash;' public --include='*.html'
grep -rnE "(is|are) not [^.;<]{3,60}[.,;] *(It|it|They|they) (is|are)" public --include='*.html'
```

## Conventions

- Extensionless root-relative internal links: `/services`, `/blog/post-slug`, `/blog/`, `/careers/`. `.htaccess` 301s `.html` URLs to the clean form. The one public `.md` is `/pricing.md`.
- Canonicals are `https://www.positionxero.com` + the extensionless path.
- `<title>` at most 60 characters and a **different string** from the `<h1>`.
- Blog posts carry a `BreadcrumbList` of exactly 3 items (Home, Blog, post) plus a matching visible breadcrumb. The last item's `item` must equal the canonical exactly and its `name` must equal the `<h1>`.
- **Blog posts print no author's name, Position Xero's included.** The owner decided on 7 October 2026 that a post names a person only where a name is genuinely necessary, and that the name would then be Ronnie or Keegan. None is necessary now. A post has no visible byline (its `article-meta` line is the tag, the `Last updated` date and the read time), no `<meta name="author">` and no `article:author`, and the cards on `/blog/` print no author. In JSON-LD the `BlogPosting` author, on the post and in the `blogPost` list on `/blog/`, is the `Organization`: `"author": { "@type": "Organization", "@id": "https://www.positionxero.com/#organization", "name": "Position Xero", "url": "https://www.positionxero.com" }`. `publisher` stays the bare `@id` reference, and no `Person` node goes on a post. The rule covers blog posts only: the founders stay named on `/about`, `/how-we-work`, the homepage and the careers pages.
- Honest read times: real word count divided by 225.
- **No inline styles (18 October 2026).** An SEO audit flagged them, and every page in the repo now carries zero `style=""` attributes and zero `<style>` blocks. Use or add a class in `public/css/style.css` section 16 (the `u-mt-*`, `u-mb-*` and `u-fs-*` utilities live there), or in `src/styles/main.css` for the Vite pages. `/free-audit` keeps its own sheet, `public/css/free-audit.css`. JavaScript setting `el.style` at runtime is fine. Check: `grep -rc 'style="' public index.html packages.html work.html experience.html cognexa.html --include='*.html' | grep -v ':0$'` prints nothing.
- Phone number is **+27 66 241 2155** sitewide.
- **The News panel on `/experience` (`experience.html`, the old homepage) names three real posts.** The new homepage has no News panel. Each `news-hud__item` links to a published post under `/blog/` and shows that post's own `datePublished` from its JSON-LD, formatted `YYYY MM.DD`. When a new post goes live, put it at the top and drop the oldest. Never a date that is not in the post's schema, never a link to `/blog/` itself, and never a staged post.
- The nav on the static pages in `public/` carries eight links since `/careers/` was added (the front pages have their own short nav: Packages, Work, About, Contact, with Careers in the footer only). Spacing tightens at 1200px, phone digits drop at 1120px, the hamburger takes over at 1024px. Adding a ninth link means re-measuring.

## The front pages: `/`, `/packages`, `/work` (12 November 2026)

**Why:** Clarity, 1 to 11 November 2026: about 3 homepage visits a day, 18% average scroll depth, 2 contact-page visits in 11 days. Visitors called the old homepage cool but too busy. The owner asked for one clear path, still in the site's visual language, with the immersive page kept as a showcase at `/experience`.

- **The four packages and their prices are the business's own facts**, confirmed by the owner in chat on 12 November 2026 and recorded in `SEO Program/plans/positionxero/` (owner-confirmations note and number register). Minimum R490, Standard R990 (marked "Recommended"; not "Most popular", which no client data backs yet), Growth R1,490, Full House R4,990 a month; yearly is 10 times the monthly price ("pay for 10 months, get 12"). Domain not included in any package ("we can register your domain for you at cost"; no domain price is printed). Full House changes: up to 4 hours a month, done the same working day. Moving an existing site and email is free. Position Xero is not VAT-registered, so the packages never mention VAT. Yearly plans: full refund in the first 30 days, then no refund but the plan runs to the end of the paid year and is not renewed if cancelled; a missed 7-day launch on a yearly plan adds one free month at the end. Full House covers SEO for one local business website; SEO for bigger sites, several locations or national campaigns is priced on the brief (the "Looking for something more?" band). A price or inclusion changes on the homepage cards, `/packages` (cards, comparison table, yearly list and FAQ), both pages' Offer and FAQPage JSON-LD, `/terms` section 7A, `/faq`, `pricing.md` and `llms.txt` at once.
- **The five commitments are the only promises the packages make**: live within 7 days of receiving your details or the first month is free; full refund if not happy in the first 30 days; changes within 2 working days or that month is free; no contract, cancel with 30 days' notice, domain, email and words go with you; website files are the client's after 12 paid months. They are about our work. Never add a promise of leads, rankings, page one or any result. "Live in 7 days" is for package sites only: the custom-build timelines are still open (T-12).
- **"Looking for something more?" (`#more`, under the packages on `/` and `/packages`) replaced `/premium` on 12 November 2026 (owner).** No price list, no options, no form: its only action is a WhatsApp button, and that button alone opens `wa.me/27662412155` with exactly `Hi there, I would like to enquire about getting some of your offerings.` It may mention `/experience` as the example of an immersive build, without a price. Every other WhatsApp button keeps its own package-specific message.
- **GA4 lead events:** `src/js/home.js` sends `gtag('event', 'generate_lead', { method, package, location })` on every WhatsApp (`method: 'whatsapp'`) and phone (`method: 'phone'`) tap on the package pages, guarded by `typeof gtag === 'function'`. Each link carries `data-lead-package` and `data-lead-location`. The "Looking for something more?" button sends `package: 'looking_for_more'`, `location: 'looking_for_more_band'`, plus its own event `looking_for_more_click` (from `data-lead-event`), so the owner can see over time how often the packages were not what a visitor wanted.
- **Work previews:** `public/img/work/<site>-desktop-1600.webp` and `-desktop-800.webp` (1600x900 captures) and `<site>-phone-540.webp` (390x844 at 2x) are headless captures of the live sites, taken 12 November 2026 with the clients' prices, figures, phone numbers, promo bars, pop-ups and chat bubbles hidden and no faces in frame (Peak Leads is shown at its SEO section, because its hero carries a revenue figure and faces). The homepage shows four (The Vault SA, Vital Socks, Cognexa, Tiny Homes SA); `/work` shows every site. Each has a Desktop / Phone switch: wider screens open on desktop, phones on the phone view (`data-view-scope` and `data-view-for` in `home.js`, with a CSS fallback before it runs). A new site needs the permission record first, then both captures.
- **Design (owner's review, 12 November 2026: "it looks AI-generated"; he likes Vital Socks, The Vault SA and Otaku TCG):** warm ink (`#0F0E0C`) and paper (`#EEEAE2`) grounds, one orange (`#FF5B1F`; `#B23A0C` for small orange text on paper), Archivo for text and an extra-condensed Archivo 800 cut for display (`/fonts/archivo-xcond-800-v25-latin.woff2`, a static instance of the variable font at its narrowest width), real screenshots of real work, a client-name tape, hand-drawn underline, offset outline on the founders photo, film grain. Keep out the AI tells he named: monospace letter-spaced eyebrows on every section, cyan or neon accents, glass and gradient blobs, uniform card grids of tick lists, generic icon rows, everything centred.
- **Phones first:** no text under 16px at 390px wide on these three pages, the hero's promise, price and WhatsApp button inside the first phone screen, and no sideways scroll.
- **The FAQ JSON-LD must match the visible answers word for word** (links stripped). Change both together.

## The free audit intake overlay

Clicking any link to `/free-audit` opens a full-screen eight-step intake, built in `public/css/style.css` (section 15) and appended to `public/js/main.js` as one IIFE. The CTAs stay real anchors: the click is only intercepted on an unmodified primary click, so modified clicks, crawlers and no-JS visitors still reach the `/free-audit` page.

**It does not run on the Vite pages (`/`, `/packages`, `/work`, `/experience`, `/cognexa`)**, because they do not load `/js/main.js`. Their CTA navigates to `/free-audit` instead. Fixing that means extracting the overlay to its own file and loading it on those pages too.

Submissions post to FormSubmit exactly as `public/contact.html` does, landing on `/thank-you`, with a `source` field so the two lead streams can be told apart.

## Staged blog posts

A scheduled post lives in `public/blog/` carrying `<meta name="robots" content="noindex, follow" />` and is deliberately **absent** from `public/blog/index.html`, `public/sitemap.xml` and `public/llms.txt`, so Google never sees it before its date. Going live means removing the noindex, stamping the dates, and adding it to those three files.

Currently staged: none.

**The three posts staged in September went live on 7 October 2026** (`google-ads-cost-south-africa`, `how-to-rank-in-google-ai-overviews` and `conversion-tracking-for-lead-generation`), at first keeping their September dates, because the owner had asked for one post for every week the blog had missed, each dated its own week. On 30 October 2026 he answered the open backdating question ("yes change to their real dates"), so they and the four other 7 October backfill posts now carry 7 October 2026, the day they first went live. Before they went out, every figure in them was either sourced in the same paragraph or cut, the Seer Interactive figures and the ppc.land link were removed, and each page's FAQ section and FAQPage block came out because its answers no longer matched the text.

The rule stands for anything staged from now on: do not publish a staged post early, do not read a passed date as permission, and when one goes live, follow the go-live steps above and stamp the real date if the date has moved.

## Careers

`/careers/` plus three role pages and a noindex `/careers/thank-you`. Role pages carry `JobPosting` schema with no `baseSalary` and no address object, which keeps a worldwide-remote posting inside the honest-schema policy. Roles are framed as ongoing recruitment, never as a first hire, because paid media, closing and development already run here.

**Stale job postings are a Google Jobs violation.** When a role is filled, remove its page, its `sitemap.xml` entry and its `llms.txt` line, and delist it from the hub.
