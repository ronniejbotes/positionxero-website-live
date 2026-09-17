# Position Xero website

**This repo is the live site: `ronniejbotes/positionxero-website-live`.** positionxero.com deploys from `main`, automatically, in about 90 seconds.

It was called `alche-copy-website` until 2026-09-08, which is why a full day of work went into the wrong repo and had to be rebuilt here. The wrong one is `Keegshaumann/positionxero-website`: an older parallel copy, different design, deploys nowhere. Do not work in it.

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

## Numbers: no figure goes live without a source and a date

**Every number a visitor can read needs a link to the source it came from and the date that source was checked.** That covers percentages, counts, prices, durations, benchmark ranges, population and market figures, and the soft ones such as "most", "typically", "on average" and "up to". If a figure cannot be traced to a source you opened yourself, rewrite the sentence without it, or cut it. Never keep a number because it sounds right. The one exception is the business's own facts, which are covered by the last bullet below.

The whole pitch of this business is that it is the honest agency, so one checkable error costs more than any of these pages earn. AI-assisted drafting produces confident, specific, invented figures constantly. Assume they are in the draft and go looking.

- The source link sits in the same paragraph as the figure, not in a list at the foot of the page.
- Any page carrying a table of figures also carries a visible "Figures checked \<month year\>" line.
- Where the only available source is a vendor selling the thing being measured, say so in the sentence. Do not launder it into "industry benchmarks show".
- A figure in the visible text almost always appears again inside that page's JSON-LD, and sometimes in `llms.txt` and `pricing.md` as well. Change every copy in one go or the page contradicts itself.
- **Never publish a number of leads, a ranking position, or a date for page one.** A lead target is agreed with the client at kickoff, described as a target, and reported against. It is never printed on a sales page.
- **The business's own facts are the exception, and they are never cut for want of a link.** Prices, the response-time promise, turnaround commitments and the steps of our own process have no external source and never will. They are sourced by a dated written confirmation from Ronnie or Keegan, recorded in the plan folder beside the register. If one of those figures has no confirmation yet, ask for it and leave the figure alone. Do not strip the prices off the site because nothing outside the business can vouch for them.

An inventory of the figures published on the site, one row per line of source with its file and line number, is kept outside this repo at `SEO Program/plans/positionxero/number-register.md`. Built 2026-09-17 against commit `77bed45` across all 65 files that carry visible copy: 1,390 lines holding 3,258 figure instances in the first pass over 62 files, plus 4 figures found by hand in the 3 files that pass missed. 29 lines have any genuine source link within six lines. The register is a floor rather than a complete census: its extractor matched digits carrying a unit plus a fixed list of soft quantifiers, so bare counts and numbers written as words are under-counted. Work through that register rather than hunting page by page, and add anything it missed as you go.

## Three things the animated pages leave out on purpose

These used to be HTML comments inside `index.html` and `works.html`. They were removed on 2026-09-17 because a comment is not private: anyone who views the page source reads it, and so does every AI crawler. The instructions themselves still stand, so they live here instead.

1. **Step 03 of the homepage process section ships no time-to-live figure, deliberately.** The site contradicts itself on this, `/about` says 5 business days and `/ads`, `/lead-gen` and `/how-we-work` say 10, and nobody has picked one. Do not put a number back into that step until the figure is settled everywhere at once. That is task T-12 in the SEO plan.
2. **The `works-item__result` values on the homepage and the `works-item__sub` lines on `/works` describe scope, not measured outcomes.** They are outcome nouns ("Online quotes", "AI systems") on purpose. Do not swap them for numbers, dates or results unless the number is real, the client has agreed in writing to it being published, and it is recorded in the plan folder. "2021 / CLIENT SINCE" is the only figure in that block taken from real data, and it is itself unconfirmed.
3. **`/works` is under a written-permission hold.** Four businesses are named there. Until Ronnie confirms in writing which of them agreed to be named, no claim on that page is edited or added to, and no client name goes anywhere else on the site. That is T-02.

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
- **The homepage News panel names three real posts.** Each `news-hud__item` links to a published post under `/blog/` and shows that post's own `datePublished` from its JSON-LD, formatted `YYYY MM.DD`. When a new post goes live, put it at the top and drop the oldest. Never a date that is not in the post's schema, never a link to `/blog/` itself, and never a staged post.
- The nav carries eight links since `/careers/` was added. Spacing tightens at 1200px, phone digits drop at 1120px, the hamburger takes over at 1024px. Adding a ninth link means re-measuring.

## The free audit intake overlay

Clicking any link to `/free-audit` opens a full-screen eight-step intake, built in `public/css/style.css` (section 15) and appended to `public/js/main.js` as one IIFE. The CTAs stay real anchors: the click is only intercepted on an unmodified primary click, so modified clicks, crawlers and no-JS visitors still reach the `/free-audit` page.

**It does not run on the homepage, `/works` or `/cognexa`**, because those are Vite entries loading `/src/js/main.js` rather than `/js/main.js`. Their CTA navigates to `/free-audit` instead. Fixing that means extracting the overlay to its own file and loading it on those three pages too.

Submissions post to FormSubmit exactly as `public/contact.html` does, landing on `/thank-you`, with a `source` field so the two lead streams can be told apart.

## Staged blog posts

A scheduled post lives in `public/blog/` carrying `<meta name="robots" content="noindex, follow" />` and is deliberately **absent** from `public/blog/index.html`, `public/sitemap.xml` and `public/llms.txt`, so Google never sees it before its date. Going live means removing the noindex, stamping the dates, and adding it to those three files.

Currently staged: `google-ads-cost-south-africa` (15 Sept), `how-to-rank-in-google-ai-overviews` (22 Sept), `conversion-tracking-for-lead-generation` (29 Sept). Do not publish one early or "tidy up" a staged post by adding it to the sitemap.

**All three are deliberately held as at 2026-09-17. Do not publish any of them, and do not read a passed date as permission.** Checked the same day: all three carry `noindex, follow`, none appears in `sitemap.xml`, `blog/index.html` or `llms.txt`, and all three answer 200 on the live site with the noindex intact. Staging is working exactly as it should.

- `google-ads-cost-south-africa`. **Its 15 September date has passed and it is still held.** Two things have to happen before it goes live, in this order. First its figures get checked: the number register lists 42 rows on it, none with a source nearby, and the file contains no outbound link at all, which makes it the most exposed of the three. Second, Ronnie confirms the date was meant to hold rather than slip (question 6 in the SEO plan). Nobody has said the post is wrong. It carries rand costs and South African market figures with nothing behind them, and the rule three sections up applies to a staged post exactly as it applies to a live one.
- `how-to-rank-in-google-ai-overviews`, 22 September. **Not yet reached.** The register lists 26 rows on it, 23 of them with no source nearby, and the ones that matter are attributed to Seer Interactive by name with no link to Seer anywhere in the file: the April 2026 analysis of 53 brands (+120% and 38%), and the February 2026 study of 541,213 LLM responses (53.1% and 10.6%). Those need the actual Seer pages linked beside them, or they come out. The single outbound link the file has today points at a ppc.land article, not at Seer.
- `conversion-tracking-for-lead-generation`, 29 September. **Not yet reached.** It is the best-sourced of the three, with thirteen outbound links: eleven to Google Ads documentation, one to WebKit and one to the California Penal Code. It still needs a read-through before it ships.

When one does go live, follow the go-live steps above and stamp the real date, not the staged one, if the date has moved.

## Careers

`/careers/` plus three role pages and a noindex `/careers/thank-you`. Role pages carry `JobPosting` schema with no `baseSalary` and no address object, which keeps a worldwide-remote posting inside the honest-schema policy. Roles are framed as ongoing recruitment, never as a first hire, because paid media, closing and development already run here.

**Stale job postings are a Google Jobs violation.** When a role is filled, remove its page, its `sitemap.xml` entry and its `llms.txt` line, and delist it from the hub.
