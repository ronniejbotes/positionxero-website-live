/* Position Xero: the website cost calculator (/website-cost-calculator-south-africa).
   15 November 2026. Vanilla JavaScript, no libraries, nothing sent anywhere.

   Every price below is on the page too, in "The prices it uses", with its
   source link and the date it was read. Change a price here and there at
   the same time (and the FAQ and its JSON-LD if the figure appears there).
   Sources and the rendered vendor pages: SEO Program,
   plans/positionxero/w47-2026-11-15/SOURCES.md.
   Bump ?v= on the page's <script> when this file changes. */
(function () {
  'use strict';
  var form = document.getElementById('calc');
  var out = document.getElementById('result');
  if (!form || !out) return;

  /* ---------- prices, read 15 November 2026 ---------- */
  var USD = 16.85;                      // SARB, rand per US dollar, 13 Nov 2026
  var DOMAIN = [110, 197];              // .co.za a year: xneelo R110, Afrihost R197
  var EMAIL = [780, Math.round(84 * USD)]; // a mailbox a year: 1-grid R65 x 12; Microsoft 365 Business Basic US$7 x 12, before VAT
  var HOSTING = 1069;                   // 1-grid Small web hosting, paid yearly (100 mail accounts, a .co.za included)
  var HOURLY = [300, 1000];             // Procompare 2026: web design R300 to R1,000 an hour
  var BUILD = {                         // Procompare 2026 website development guide
    business: { range: [7500, 20000], name: 'a business website' },
    shop: { range: [13000, 25000], name: 'an online shop' },
    custom: { range: [38000, 88000], name: 'a custom website (more than 25 pages)' }
  };
  var WIX = { light: Math.round(204 * USD), core: Math.round(348 * USD) }; // US$17 and US$29 a month, yearly, before tax
  var PACKAGES = [                      // exactly as on /packages
    { name: 'Minimum', month: 490, year: 4900, mail: 1, hours: 0.5, changes: 'up to 30 minutes of changes', posts: 'no blog posts' },
    { name: 'Standard', month: 990, year: 9900, mail: 2, hours: 1, changes: 'up to 1 hour of changes', posts: 'on-site SEO and 2 blog posts' },
    { name: 'Growth', month: 1490, year: 14900, mail: 3, hours: 2, changes: 'up to 2 hours of changes', posts: '4 blog posts' },
    { name: 'Full House', month: 4990, year: 49900, mail: 5, hours: 4, changes: 'up to 4 hours of changes, done the same working day', posts: 'full SEO and 8 blog posts' }
  ];
  var WA = 'https://wa.me/27662412155?text=';
  var WA_MORE = WA + 'Hi%20there%2C%20I%20would%20like%20to%20enquire%20about%20getting%20some%20of%20your%20offerings.';

  /* ---------- helpers ---------- */
  function money(n) { return 'R' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function range(r) { return Math.round(r[0]) === Math.round(r[1]) ? money(r[0]) : money(r[0]) + ' to ' + money(r[1]); }
  function add() { var lo = 0, hi = 0; for (var i = 0; i < arguments.length; i++) { lo += arguments[i][0]; hi += arguments[i][1]; } return [lo, hi]; }
  function times(r, k) { return [r[0] * k, r[1] * k]; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(name, fallback, max) {
    var v = parseFloat(String(form.elements[name].value).replace(',', '.'));
    if (!isFinite(v) || v < 0) v = fallback;
    return Math.min(v, max);
  }
  function rateText(r) { return Math.round(r) === r ? money(r) : 'R' + r.toFixed(2); }
  function hoursText(h) { return h === 1 ? '1 hour' : (Math.round(h * 10) / 10) + ' hours'; }
  function plural(n, one, many) { return n === 1 ? one : many; }

  function read() {
    return {
      pages: form.elements.pages.value,            // '5' | '10' | '25' | 'more'
      shop: form.elements.shop.checked,
      book: form.elements.book.checked,
      domain: form.elements.domain.value,          // 'new' | 'have'
      mail: parseInt(form.elements.mail.value, 10) || 0,
      who: form.elements.who.value,                // 'diy' | 'designer' | 'package'
      build: num('build', 10, 2000),
      upkeep: num('upkeep', 1, 200),
      rate: num('rate', 300, 100000)
    };
  }

  /* ---------- route 1: build it yourself ---------- */
  function builders(s) {
    var list = [];
    // Google Sites: free, no shop
    list.push(s.shop
      ? { name: 'Google Sites', plan: 'has no online shop, so it is left out', cost: null }
      : { name: 'Google Sites', plan: s.book ? 'free, with a free Google Calendar booking page' : 'free, no paid plan', cost: [0, 0], freeDomain: false });
    // 1-grid Website Builder, regular yearly prices
    var g;
    if (s.shop || s.pages === 'more') g = { plan: s.shop ? 'Standard (10 products) or Premium (unlimited products)' : 'Standard (35 pages) or Premium (unlimited pages)', cost: [2689, 3769] };
    else if (s.pages === '25') g = { plan: 'Standard (up to 35 pages)', cost: [2689, 2689] };
    else g = { plan: 'Basic (up to 10 pages)', cost: [1393, 1393] };
    g.name = '1-grid Website Builder'; g.freeDomain = true;
    if (s.book) { g.plan += ', plus its booking add-on'; g.flag = 'Booking add-on not counted: a free trial, then a price 1-grid doesn\u2019t show on its plans page'; }
    list.push(g);
    // Wix, US dollars before tax
    list.push((s.shop || s.book)
      ? { name: 'Wix', plan: 'Core (US$348 a year, before tax)', cost: [WIX.core, WIX.core], freeDomain: false, about: true }
      : { name: 'Wix', plan: 'Light (US$204 a year, before tax)', cost: [WIX.light, WIX.light], freeDomain: false, about: true });
    // Squarespace, paid yearly
    var sq = { name: 'Squarespace', plan: 'Basic', cost: [3600, 3600], freeDomain: false };
    if (s.book) { sq.plan = 'Basic plus Scheduling Starter (R3,660 a year)'; sq.cost = [7260, 7260]; }
    if (s.shop) sq.flag = 'Basic takes a 2% fee on online store sales';
    list.push(sq);
    return list;
  }

  function diy(s) {
    var list = builders(s), ok = list.filter(function (b) { return b.cost; });
    var lo1 = Infinity, hi1 = 0, lo2 = Infinity, hi2 = 0;
    ok.forEach(function (b) {
      var d1 = (s.domain === 'new' && b.freeDomain) ? [0, 0] : DOMAIN;
      b.first = add(b.cost, d1);
      lo1 = Math.min(lo1, b.first[0]); hi1 = Math.max(hi1, b.first[1]);
      lo2 = Math.min(lo2, b.cost[0] + DOMAIN[0]); hi2 = Math.max(hi2, b.cost[1] + DOMAIN[1]);
    });
    var email = times(EMAIL, s.mail);
    var t1 = (s.build + s.upkeep * 12) * s.rate, t2 = s.upkeep * 12 * s.rate;
    return {
      list: list, email: email, time1: t1, time2: t2,
      first: add([lo1, hi1], email, [t1, t1]),
      after: add([lo2, hi2], email, [t2, t2])
    };
  }

  /* ---------- route 2: a freelancer or an agency, once-off ---------- */
  function designer(s) {
    var key = s.pages === 'more' ? 'custom' : (s.shop ? 'shop' : 'business');
    var dom = s.domain === 'new' ? [0, 0] : DOMAIN;
    var changes = times(HOURLY, s.upkeep * 12);
    return {
      key: key, build: BUILD[key].range, dom: dom, changes: changes,
      first: add(BUILD[key].range, [HOSTING, HOSTING], dom, changes),
      after: add([HOSTING, HOSTING], dom, changes)
    };
  }

  /* ---------- route 3: our packages ---------- */
  function packages(s) {
    var outside = [];
    if (s.pages !== '5') outside.push('more than 5 pages');
    if (s.shop) outside.push('an online shop');
    if (s.book) outside.push('online bookings');
    var fits = PACKAGES.map(function (p) {
      var why = [];
      if (outside.length) why.push('doesn\u2019t include ' + outside.join(' or '));
      if (s.mail > p.mail) why.push(p.mail + ' ' + plural(p.mail, 'mailbox', 'mailboxes') + ', you picked ' + s.mail);
      if (s.upkeep > p.hours) why.push(p.changes.replace(', done the same working day', '') + ' a month, you picked ' + hoursText(s.upkeep));
      return { p: p, ok: !why.length, why: why };
    });
    var best = null;
    for (var i = 0; i < fits.length; i++) if (fits[i].ok) { best = fits[i].p; break; }
    var res = { outside: outside, fits: fits, best: best };
    if (best) {
      res.first = add([best.year, best.month * 12], DOMAIN);
      res.after = res.first;
    }
    return res;
  }

  /* ---------- drawing ---------- */
  function line(what, amt, small, cls) {
    return '<li class="slip__line' + (cls ? ' ' + cls : '') + '"><span class="slip__what">' + what + '</span><span class="slip__amt">' + amt + '</span>' + (small ? '<span class="slip__desc">' + small + '</span>' : '') + '</li>';
  }
  function totals(first, after, time1, time2) {
    var own = function (label, t) { return t === undefined ? '' : '<div class="slip__row slip__row--own"><dt>' + label + '</dt><dd>' + money(t) + '</dd></div>'; };
    return '<dl class="slip__total"><div class="slip__row slip__row--big"><dt>First year</dt><dd>' + range(first) + '</dd></div>' +
      own('Of that, your own time (not money you pay out)', time1) +
      '<div class="slip__row"><dt>Every year after</dt><dd>' + range(after) + '</dd></div>' +
      own('Of that, your own time', time2) + '</dl>';
  }

  function slipDiy(s, d) {
    var h = '<p class="slip__k">Build it yourself</p><h3 class="slip__title" id="slip-title">Your first year, itemised</h3><ul class="slip__lines">';
    h += '<li class="slip__line"><span class="slip__what">Website builder plan, a year</span><span class="slip__amt"></span><span class="slip__desc">The cheapest plan on each builder that does what you picked</span></li>';
    h += '<li><ul class="slip__lines slip__sub">';
    d.list.forEach(function (b) {
      var amt = b.cost ? (b.about ? 'about ' : '') + range(b.cost) : 'n/a';
      h += line(esc(b.name), amt, esc(b.plan) + (b.flag ? '. <span class="slip__flag">' + esc(b.flag) + '</span>' : ''));
    });
    h += '</ul></li>';
    var paying = d.list.filter(function (b) { return b.cost && !(s.domain === 'new' && b.freeDomain); }).map(function (b) { return b.name; });
    var names = paying.length > 1 ? paying.slice(0, -1).join(', ') + ' and ' + paying[paying.length - 1] : paying.join('');
    h += line('Your domain, first year', s.domain === 'new' ? 'R0 to ' + money(DOMAIN[1]) : range(DOMAIN),
      s.domain === 'new' ? 'A .co.za is free for the first year with 1-grid\u2019s builder. On ' + names + ' you register it yourself: R110 to R197 a year. Wix\u2019s and Squarespace\u2019s free first-year domain can\u2019t be a .co.za.' : 'Renewing the domain you have: R110 to R197 a year for a .co.za.');
    h += line('Email on your domain', s.mail ? range(d.email) : 'R0', s.mail ? s.mail + ' ' + plural(s.mail, 'mailbox', 'mailboxes') + ' at R780 to about R1,415 a year each' : 'No mailboxes picked');
    h += line('Your time', money(d.time1), hoursText(s.build) + ' to build, plus ' + hoursText(s.upkeep) + ' a month of changes, at ' + rateText(s.rate) + ' an hour');
    h += '</ul>';
    h += totals(d.first, d.after, d.time1, d.time2);
    h += '<p class="slip__note">The low end is the cheapest builder for what you picked, the high end the dearest. From the second year we count the domain at R110 to R197 a year; a builder\u2019s own renewal price can differ.' + (s.shop ? ' For a sense of the work: Procompare\u2019s 2026 guide says a basic online shop on a platform such as Wix takes a professional at least 100 hours to set up.' : '') + '</p>';
    return h;
  }

  function slipDesigner(s, r) {
    var h = '<p class="slip__k">A freelancer or a web agency, once-off</p><h3 class="slip__title" id="slip-title">Your first year, itemised</h3><ul class="slip__lines">';
    h += line('Building ' + BUILD[r.key].name, range(r.build), 'Once-off, from Procompare\u2019s 2026 price guide: the price of setting the site up. Hosting and changes are added below; ask whether the quote includes writing the words.' + (s.book ? ' <span class="slip__flag">A booking system can push the quote up; Procompare doesn\u2019t price it on its own.</span>' : ''));
    h += line('Hosting with email, a year', money(HOSTING), 'For example 1-grid\u2019s Small plan paid yearly: one website, up to 100 mail accounts' + (s.domain === 'new' ? ' and a .co.za included' : ''));
    if (s.domain === 'have') h += line('Your domain', range(DOMAIN), 'Renewing the domain you have: R110 to R197 a year for a .co.za');
    h += line('Changes after launch', range(r.changes), hoursText(s.upkeep) + ' a month, paid at R300 to R1,000 an hour, Procompare\u2019s range for web designers');
    h += '</ul>';
    h += totals(r.first, r.after);
    h += '<p class="slip__note">Procompare\u2019s ranges don\u2019t separate freelancers from studios, and we couldn\u2019t find a South African source that does. Your own time to brief the designer and check the drafts isn\u2019t counted.</p>';
    return h;
  }

  function slipPackage(s, r) {
    var h = '<p class="slip__k">Built for you, on one of our monthly packages</p><h3 class="slip__title" id="slip-title">Your first year, itemised</h3>';
    if (!r.best) {
      var reason = r.outside.length ? 'Our packages don\u2019t include ' + r.outside.join(' or ') + '.' : 'You picked more than our biggest package covers (' + hoursText(s.upkeep) + ' of changes a month; Full House has up to 4 hours).';
      h += '<p class="slip__note">' + reason + ' That needs a quote, so there\u2019s no number to show here. Tell us what you need and we\u2019ll quote it, or compare the other two routes below.</p>';
      h += '<p class="cta-row"><a class="btn btn--go btn--lg" href="' + WA_MORE + '" target="_blank" rel="noopener" data-lead-location="calculator-looking-for-more" data-lead-package="looking_for_more" data-lead-event="looking_for_more_click">' + waIcon() + '<span>Ask us on WhatsApp</span></a></p>';
      return h;
    }
    var p = r.best;
    h += '<ul class="slip__lines">';
    h += line('Building the website', 'R0', 'No build fee: we build it in code, up to 5 pages, and write the words');
    h += line(p.name + ' package, 12 months', money(p.year) + ' to ' + money(p.month * 12), money(p.year) + ' paid yearly (pay for 10 months, get 12) or ' + money(p.month) + ' a month');
    h += line('Hosting, security updates, backups, SSL', 'included', '');
    h += line('Email on your domain', 'included', p.mail + ' ' + plural(p.mail, 'mailbox', 'mailboxes') + ' in ' + p.name + (s.mail ? ', you picked ' + s.mail : ''));
    h += line('Changes after launch', 'included', p.changes + ' a month in ' + p.name);
    h += line(s.domain === 'have' ? 'Your domain' : 'Your domain, at cost', range(DOMAIN), s.domain === 'have'
      ? 'Not in any package. You keep paying for the one you have, and moving it to us costs nothing extra; a .co.za is R110 to R197 a year at the two registrars we checked'
      : 'Not in any package. We register it for you at cost; a .co.za is R110 to R197 a year at the two registrars we checked');
    h += '</ul>';
    h += totals(r.first, r.after);
    h += '<p class="slip__note">The cheapest of our packages that covers your mailboxes and change time. Your time: a 15-minute call or a voice note, then checking the site on your phone. No contract: cancel with 30 days\u2019 notice. After 12 paid months the website files are yours.</p>';
    var msg = encodeURIComponent('Hi Position Xero, I\'m interested in the ' + p.name + ' package (' + money(p.month) + ' a month).').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    h += '<p class="cta-row"><a class="btn btn--go btn--lg" href="' + WA + msg + '" target="_blank" rel="noopener" data-lead-location="calculator" data-lead-package="' + esc(p.name) + '">' + waIcon() + '<span>Ask about ' + esc(p.name) + ' on WhatsApp</span></a></p>';
    return h;
  }

  function waIcon() {
    return '<svg class="i-wa" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.06 0 1.22.88 2.39 1 2.56.13.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.29Z"/></svg>';
  }

  function ways(s, d, r, p) {
    var rows = [
      { key: 'diy', name: 'Build it yourself, your time included', r: d.first },
      { key: 'designer', name: 'A freelancer or a web agency, once-off', r: r.first },
      { key: 'package', name: 'Built for you on one of our packages', r: p.best ? p.first : null }
    ];
    var max = 0;
    rows.forEach(function (x) { if (x.r) max = Math.max(max, x.r[1]); });
    var h = '<h3 class="ways__title">First year, three ways</h3><p class="ways__sub">For what you picked, on one scale</p><ul class="ways__rows">';
    rows.forEach(function (x) {
      var cls = 'ways__row' + (x.key === s.who ? ' is-chosen' : '');
      if (!x.r) { h += '<li class="' + cls + '"><span class="ways__name">' + x.name + '</span><span class="ways__val">needs a quote</span></li>'; return; }
      var a = max ? x.r[0] / max * 100 : 0, w = max ? Math.max((x.r[1] - x.r[0]) / max * 100, 1.2) : 0;
      if (a + w > 100) a = 100 - w;
      h += '<li class="' + cls + '"><span class="ways__name">' + x.name + '</span><span class="ways__val">' + range(x.r) + '</span>' +
        '<svg class="ways__bar" aria-hidden="true" focusable="false"><rect class="ways__track" width="100%" height="100%" rx="4" /><rect class="ways__fill" x="' + a.toFixed(2) + '%" width="' + w.toFixed(2) + '%" height="100%" rx="4" /></svg></li>';
    });
    h += '</ul><p class="ways__note">Each bar runs from the low end to the high end of that route. Pick a route under question 5 to see it itemised.</p>';
    return h;
  }

  function markPackages(p) {
    var box = out.querySelector('.pk');
    if (box) box.classList.toggle('is-none', !p.best);
    p.fits.forEach(function (f) {
      var li = out.querySelector('[data-pk="' + f.p.name + '"]');
      if (!li) return;
      var fit = li.querySelector('.pk__fit');
      li.classList.toggle('is-fit', f.ok);
      li.classList.toggle('is-best', !!p.best && p.best.name === f.p.name);
      fit.textContent = f.ok ? (p.best && p.best.name === f.p.name ? 'Covers what you picked, and the cheapest that does' : 'Covers what you picked') : 'Falls short: ' + f.why.join('; ');
    });
  }

  /* ---------- the URL keeps the answer, so it can be shared ---------- */
  var KEYS = ['pages', 'shop', 'book', 'domain', 'mail', 'who', 'build', 'upkeep', 'rate'];
  function toQuery(s) {
    var q = new URLSearchParams();
    KEYS.forEach(function (k) { q.set(k, typeof s[k] === 'boolean' ? (s[k] ? 1 : 0) : s[k]); });
    return q.toString();
  }
  function fromQuery() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    if (!q.has('pages')) return;
    KEYS.forEach(function (k) {
      if (!q.has(k)) return;
      var v = q.get(k), el = form.elements[k];
      if (!el) return;
      if (el.type === 'checkbox') el.checked = v === '1';
      else if (el.length && !el.tagName) { for (var i = 0; i < el.length; i++) el[i].checked = el[i].value === v; }
      else el.value = v;
    });
  }

  /* ---------- run ---------- */
  var slip = document.getElementById('slip');
  var waysBox = document.getElementById('ways');
  var live = document.getElementById('calc-live');
  var bar = document.getElementById('calc-bar');
  var barVal = document.getElementById('calc-bar-val');
  var shopHint = document.getElementById('shop-hint');
  var liveTimer;
  var touched = false;

  function run() {
    var s = read(), d = diy(s), r = designer(s), p = packages(s);
    slip.innerHTML = s.who === 'diy' ? slipDiy(s, d) : (s.who === 'designer' ? slipDesigner(s, r) : slipPackage(s, p));
    waysBox.innerHTML = ways(s, d, r, p);
    markPackages(p);
    var chosen = s.who === 'diy' ? d : (s.who === 'designer' ? r : p);
    var summary = chosen.first ? range(chosen.first) : 'needs a quote';
    if (barVal) barVal.textContent = summary;
    if (shopHint) shopHint.hidden = !s.shop;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      live.textContent = chosen.first ? 'First year ' + range(chosen.first) + '. Every year after ' + range(chosen.after) + '.' : 'Our packages don\u2019t cover what you picked; that needs a quote.';
    }, 700);
    if (touched && history.replaceState) {
      try { history.replaceState(null, '', location.pathname + '?' + toQuery(s) + location.hash); } catch (e) {}
    }
    presets();
  }

  function presets() {
    var v = String(form.elements.rate.value);
    form.querySelectorAll('[data-rate]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-rate') === v ? 'true' : 'false'); });
  }

  form.addEventListener('input', function () { touched = true; run(); });
  form.addEventListener('change', function () { touched = true; run(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  form.querySelectorAll('[data-rate]').forEach(function (b) {
    b.addEventListener('click', function () { form.elements.rate.value = b.getAttribute('data-rate'); touched = true; run(); });
  });

  /* copy buttons: the result link, the citation and the link snippet */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var src = b.getAttribute('data-copy');
    var text = src === 'url' ? location.href.split('#')[0] : (document.getElementById(src) || {}).textContent || '';
    var done = function () { var t = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = t; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text.trim()).then(done, function () {});
  });

  /* phones: the bar with the total shows while the questions are on screen and the answer isn't */
  if (bar && 'IntersectionObserver' in window) {
    var formIn = false, outIn = false;
    var sync = function () { bar.hidden = !(formIn && !outIn); };
    new IntersectionObserver(function (es) { es.forEach(function (x) { formIn = x.isIntersecting; }); sync(); }, { rootMargin: '0px 0px -30% 0px' }).observe(form);
    new IntersectionObserver(function (es) { es.forEach(function (x) { outIn = x.isIntersecting; }); sync(); }, { threshold: 0.01 }).observe(slip);
  }

  fromQuery();
  out.classList.add('is-live');
  run();
})();
