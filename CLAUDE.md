# Position Xero website

**This repo is the live site.** positionxero.com deploys from `main`, automatically, in about 90 seconds. There is a second repo, `Keegshaumann/positionxero-website`, which is an older parallel copy that deploys nowhere. Do not work in it. On 2026-09-08 a full day of work went into it by mistake and had to be rebuilt here.

## Structure

- **Root `index.html`, `works.html`, `cognexa.html`** are Vite entries. They compile to the hashed `/assets/*` bundles and load `/src/js/main.js`. This is the immersive homepage.
- **`public/`** is static passthrough: Vite copies it verbatim to the site root. Every other page lives here as hand-written HTML, along with `public/css/style.css`, `public/js/main.js`, `public/.htaccess`, `public/sitemap.xml` and `public/llms.txt`. A new static page needs no vite.config change.
- **`content/blog/*.md`** is dead legacy. Blog posts are hand-written HTML in `public/blog/`.
- Asset paths are always root-relative: `/css/style.css`, never `/public/css/...`, never `../`.

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

## Honest copy: who the company is

Position Xero is **founder-led** by Ronnie James Botes and Keegan Shane Haumann, but is **no longer only two people**. There is a person running paid ads, a sales team doing cold outreach and closing, and a second developer.

- Never write "just the two of us", "run by two people", "the two people running your account", "no account managers", "no handoffs", or that the founders personally do all the work. All of it used to be on the site and all of it is now false.
- The corrected position: day to day a client works with the person who actually runs their service, and a founder stays close to the account and joins meetings where they can. The surviving differentiator is that you deal with the person doing the work rather than a middleman relaying messages. Never write "always" about founder involvement.
- Never promise that "a founder" personally answers every enquiry. Keep the 24 hour promise, drop the claim about who. This includes hidden autoresponder fields in forms.
- Ronnie's background is web development and SEO. Keegan's is full-stack development, and other developers also do build work.
- **Only the two co-founders may be named, pictured or described.** Never add other employees.
- **Never publish a headcount**, in any wording. The real number is not authorised for the site and this repo is public.
- No invented client results, case studies, testimonials or client counts. No `LocalBusiness`, `PostalAddress`, `GeoCoordinates`, `OpeningHoursSpecification`, `Review` or `AggregateRating` schema.

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
- Honest read times: real word count divided by 225.
- Phone number is **+27 66 241 2155** sitewide.
- The nav carries eight links since `/careers/` was added. Spacing tightens at 1200px, phone digits drop at 1120px, the hamburger takes over at 1024px. Adding a ninth link means re-measuring.

## The free audit intake overlay

Clicking any link to `/free-audit` opens a full-screen eight-step intake, built in `public/css/style.css` (section 15) and appended to `public/js/main.js` as one IIFE. The CTAs stay real anchors: the click is only intercepted on an unmodified primary click, so modified clicks, crawlers and no-JS visitors still reach the `/free-audit` page.

**It does not run on the homepage, `/works` or `/cognexa`**, because those are Vite entries loading `/src/js/main.js` rather than `/js/main.js`. Their CTA navigates to `/free-audit` instead. Fixing that means extracting the overlay to its own file and loading it on those three pages too.

Submissions post to FormSubmit exactly as `public/contact.html` does, landing on `/thank-you`, with a `source` field so the two lead streams can be told apart.

## Staged blog posts

A scheduled post lives in `public/blog/` carrying `<meta name="robots" content="noindex, follow" />` and is deliberately **absent** from `public/blog/index.html`, `public/sitemap.xml` and `public/llms.txt`, so Google never sees it before its date. Going live means removing the noindex, stamping the dates, and adding it to those three files.

Currently staged: `google-ads-cost-south-africa` (15 Sept), `how-to-rank-in-google-ai-overviews` (22 Sept), `conversion-tracking-for-lead-generation` (29 Sept). Do not publish one early or "tidy up" a staged post by adding it to the sitemap.

## Careers

`/careers/` plus three role pages and a noindex `/careers/thank-you`. Role pages carry `JobPosting` schema with no `baseSalary` and no address object, which keeps a worldwide-remote posting inside the honest-schema policy. Roles are framed as ongoing recruitment, never as a first hire, because paid media, closing and development already run here.

**Stale job postings are a Google Jobs violation.** When a role is filled, remove its page, its `sitemap.xml` entry and its `llms.txt` line, and delist it from the hub.
