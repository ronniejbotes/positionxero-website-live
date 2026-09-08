/* Position Xero: main.js */

// Cloth-warp grid effect, used on the hero AND every dark "grid" section.
(function () {
  // Respect reduced-motion preferences: skip the animation entirely (static
  // CSS grids stay in place as the fallback).
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Geometry / physics (shared)
  const STEPS    = 16;  // polyline segments per line (more = smoother curve)
  const SIGMA    = 200; // px, radius of cloth depression
  const STRENGTH = 90;  // px, max inward pull at dead-centre
  const SPRING   = 0.055;

  // Attach a warping grid to `host`. opts: { canvas?, cell, color }
  function initWarpGrid(host, opts) {
    const CELL  = opts.cell  || 64;
    const color = opts.color || 'rgba(0,0,0,0.055)';

    // Use the supplied canvas (hero) or inject one behind the section content.
    let canvas = opts.canvas;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'warp-grid';
      canvas.setAttribute('aria-hidden', 'true');
      host.insertBefore(canvas, host.firstChild);
      host.classList.add('has-warp-grid'); // hides the static CSS grid via CSS
    }
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0;
    let rawX = -9999, rawY = -9999;  // actual mouse position (relative to host)
    let smX  = -9999, smY  = -9999;  // spring-eased position
    let velX = 0, velY = 0;

    function resize() { W = canvas.width = host.offsetWidth; H = canvas.height = host.offsetHeight; }

    host.addEventListener('mousemove', e => {
      const r = host.getBoundingClientRect();
      rawX = e.clientX - r.left;
      rawY = e.clientY - r.top;
    });
    host.addEventListener('mouseleave', () => { rawX = -9999; rawY = -9999; });

    // Gaussian pull toward cursor: strongest at centre, zero at infinity.
    function warp(px, py) {
      const dx = px - smX, dy = py - smY, d2 = dx * dx + dy * dy;
      const pull = STRENGTH * Math.exp(-d2 / (2 * SIGMA * SIGMA));
      const dist = Math.sqrt(d2) || 1;
      return { x: px - (dx / dist) * pull, y: py - (dy / dist) * pull };
    }

    function drawWarpedLine(x0, y0, x1, y1) {
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS, px = x0 + (x1 - x0) * t, py = y0 + (y1 - y0) * t, w = warp(px, py);
        i === 0 ? ctx.moveTo(w.x, w.y) : ctx.lineTo(w.x, w.y);
      }
      ctx.stroke();
    }

    function draw() {
      // Critically-damped spring toward raw mouse (the "fabric sinking" lag).
      const dx = rawX - smX, dy = rawY - smY;
      velX += dx * SPRING; velY += dy * SPRING;
      velX *= 0.78; velY *= 0.78;
      smX += velX; smY += velY;

      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      const cols = Math.ceil(W / CELL) + 1, rows = Math.ceil(H / CELL) + 1;
      for (let r = 0; r <= rows; r++) drawWarpedLine(0, r * CELL, W, r * CELL);
      for (let c = 0; c <= cols; c++) drawWarpedLine(c * CELL, 0, c * CELL, H);

      if (running) rafId = requestAnimationFrame(draw);
    }

    let rafId = null, running = false;
    function start() { if (!running) { running = true; rafId = requestAnimationFrame(draw); } }
    function stop()  { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    resize();
    window.addEventListener('resize', resize);

    // Only animate while the section is on-screen (saves CPU/battery).
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? start() : stop())), { threshold: 0 }).observe(host);
    } else { start(); }
  }

  // Homepage hero: existing canvas, light section so dark lines.
  const heroCanvas = document.getElementById('heroGrid');
  if (heroCanvas) {
    const hero = heroCanvas.closest('.hero');
    if (hero) initWarpGrid(hero, { canvas: heroCanvas, cell: 68, color: 'rgba(0,0,0,0.055)' });
  }

  // Every dark "grid" section: inject a canvas, light lines, hide static grid.
  [['.stats-section', 64], ['.cta-banner', 48], ['.page-header', 72], ['.article-header', 72], ['.calc-section', 64]]
    .forEach(([sel, cell]) => {
      document.querySelectorAll(sel).forEach(host => {
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
        initWarpGrid(host, { cell, color: 'rgba(255,255,255,0.06)' });
      });
    });
})();

// Mobile nav
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
if (hamburger && mobileMenu) {
  const setMenu = (open) => {
    hamburger.classList.toggle('active', open);
    mobileMenu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  hamburger.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  // Escape closes the menu and returns focus to the toggle.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) { setMenu(false); hamburger.focus(); }
  });
}

// Sticky nav
const nav = document.getElementById('nav');
if (nav) window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

// Fade-in on scroll (guarded so browsers without IntersectionObserver still show content)
if ('IntersectionObserver' in window) {
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); fadeObserver.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));
} else {
  document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// FAQ accordion (with aria-expanded sync for screen readers)
const faqButtons = document.querySelectorAll('.faq-question');
function syncFaqAria() {
  faqButtons.forEach(b => {
    const it = b.closest('.faq-item');
    b.setAttribute('aria-expanded', it && it.classList.contains('open') ? 'true' : 'false');
  });
}
faqButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
    syncFaqAria();
  });
});
syncFaqAria();

// Animated counters
function animateCounter(el) {
  const raw    = el.dataset.target;
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const target = parseFloat(raw);
  const isFloat = raw.includes('.');
  const dur = 2200, start = performance.now();
  (function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + (isFloat ? (target * eased).toFixed(1) : Math.round(target * eased)) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}
const counterObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && !e.target.dataset.animated) {
      e.target.dataset.animated = '1';
      animateCounter(e.target);
    }
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-target]').forEach(el => counterObs.observe(el));

// Cost-of-missed-leads calculator
(function () {
  const slider = document.getElementById('calcValue');
  if (!slider) return;
  const out     = document.getElementById('calcValueOut');
  const yearEl  = document.getElementById('calcYear');
  const monthEl = document.getElementById('calcMonth');

  // Leads/month and close rate are user inputs, not assumptions we assert.
  const leadsEl = document.getElementById('calcLeads');
  const closeEl = document.getElementById('calcClose');
  const leadsOut = document.getElementById('calcLeadsOut');
  const closeOut = document.getElementById('calcCloseOut');
  const custEl   = document.getElementById('calcCustomers');
  if (!leadsEl || !closeEl || !leadsOut || !closeOut || !custEl) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fmt = n => Math.round(n).toLocaleString('en-US');

  let animId = null, shownYear = 0;
  function animateYear(target) {
    if (reduce) { shownYear = target; yearEl.textContent = fmt(target); return; }
    cancelAnimationFrame(animId);
    const start = shownYear, t0 = performance.now(), dur = 550;
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);        // easeOutCubic
      shownYear = start + (target - start) * e;
      yearEl.textContent = fmt(shownYear);
      if (p < 1) animId = requestAnimationFrame(step);
    }
    animId = requestAnimationFrame(step);
  }

  function update(animate) {
    const value   = +slider.value;
    const leads   = +leadsEl.value;
    const close   = +closeEl.value / 100;
    const cpm     = leads * close;          // new customers / month
    const monthly = cpm * value;
    const yearly  = monthly * 12;
    out.textContent      = '$' + fmt(value);
    leadsOut.textContent = fmt(leads);
    closeOut.textContent = closeEl.value + '%';
    custEl.textContent   = (Math.round(cpm * 10) / 10).toLocaleString('en-US');
    monthEl.textContent  = '$' + fmt(monthly);
    if (animate) { animateYear(yearly); }
    else { shownYear = yearly; yearEl.textContent = fmt(yearly); }
  }

  [slider, leadsEl, closeEl].forEach(el => el.addEventListener('input', () => update(true)));
  update(false); // set initial values without animating

  // Count up from zero the first time the calculator scrolls into view.
  const calc = slider.closest('.calc');
  if (calc && 'IntersectionObserver' in window && !reduce) {
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(e => { if (e.isIntersecting) { shownYear = 0; update(true); o.disconnect(); } });
    }, { threshold: 0.35 });
    obs.observe(calc);
  }
})();

// Email links are assembled client-side to keep the address out of the static HTML (spam-scraper hygiene).
(function () {
  var links = document.querySelectorAll('[data-em-u]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    var addr = a.getAttribute('data-em-u') + '@' + a.getAttribute('data-em-d');
    a.setAttribute('href', 'mailto:' + addr);
    a.textContent = addr;
  }
})();

// Lead value calculator (/blog/how-much-are-leads-worth). Self-contained; no-ops elsewhere.
(function () {
  const val = document.getElementById('lvValue');
  if (!val) return;
  const close  = document.getElementById('lvClose');
  const margin = document.getElementById('lvMargin');
  const valOut = document.getElementById('lvValueOut');
  const closeOut = document.getElementById('lvCloseOut');
  const marginOut = document.getElementById('lvMarginOut');
  const profitEl = document.getElementById('lvProfit');
  const revEl = document.getElementById('lvRevenue');
  const cplEl = document.getElementById('lvMaxCpl');
  if (!close || !margin || !valOut || !closeOut || !marginOut || !profitEl || !revEl || !cplEl) return;

  const ACQUISITION_SHARE = 0.30; // documented in the copy above the calculator
  const fmt = n => Math.round(n).toLocaleString('en-US');

  function update() {
    const v = +val.value, c = +close.value / 100, m = +margin.value / 100;
    const revenuePerLead = v * c;
    const profitPerLead  = v * m * c;
    valOut.textContent    = '$' + fmt(v);
    closeOut.textContent  = close.value + '%';
    marginOut.textContent = margin.value + '%';
    profitEl.textContent  = fmt(profitPerLead);
    revEl.textContent     = '$' + fmt(revenuePerLead);
    cplEl.textContent     = '$' + fmt(profitPerLead * ACQUISITION_SHARE);
  }
  [val, close, margin].forEach(el => el.addEventListener('input', update));
  update();
})();

/* =====================================================================
 * Book Free Audit: full screen, one question at a time intake overlay.
 * Added 2026-09-08. Styles live at the end of public/css/style.css
 * under the matching banner.
 *
 * Self contained: every identifier below is inside this IIFE, so
 * nothing here can collide with the top level hamburger, mobileMenu,
 * nav, faqButtons, animateCounter or counterObs declared earlier in
 * this file, and nothing is added to window.
 *
 * Every "Book Free Audit" link on the site points at /free-audit and
 * stays a real anchor, so the page remains crawlable and the funnel
 * still works with JavaScript off. This intercepts the click and opens
 * an overlay instead. The overlay markup is built here on first use:
 * the nav and footer are duplicated across every page in public/ and
 * are not edited for this.
 *
 * The submission is a plain cross origin form POST to FormSubmit,
 * exactly like the form in public/contact.html, landing on the existing
 * /thank-you page. Lead capture beats cleverness, so there is no fetch
 * and no XHR.
 *
 * The endpoint, _subject, _template, _captcha, _next, _autoresponse and
 * the honeypot below are copied verbatim from public/contact.html. If
 * that form is ever repointed, both files have to change together.
 * ================================================================== */
(function () {
  'use strict';

  if (!document.body || !window.Element || !Element.prototype.closest) return;

  var ENDPOINT = 'https://formsubmit.co/hello@positionxero.com';
  var TOTAL = 8;
  var SUBMIT_LABEL = 'Book my free audit';

  /* Reference patterns: deliberately loose. A real address our regex
     rejects is a lost lead; a typo that slips through is an email we can
     still read. */
  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var RE_PHONE = /^\+?\d{9,15}$/;
  var RE_URL   = /^(https?:\/\/)?[^\s\/?#]+\.[^\s]{2,}$/i;

  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }

  /* The questions mirror contact.html's fields so both lead streams land
     in the same shape. Visible option labels are shortened; the
     submitted values are contact.html's exact strings. */
  var QUESTIONS = [
    {
      key: 'name', name: 'name', kind: 'text', type: 'text',
      q: 'What is your name?',
      ph: 'Jane Smith',
      autocomplete: 'name', maxlength: 100,
      required: 'Please add your name.',
      check: function (v) { return v.length >= 2; },
      invalid: 'Please add your name.'
    },
    {
      key: 'business', name: 'business', kind: 'text', type: 'text',
      q: 'What is your business called?',
      sub: 'Optional.',
      ph: 'Acme Roofing',
      autocomplete: 'organization', maxlength: 120
    },
    {
      key: 'email', name: 'email', kind: 'text', type: 'email',
      q: 'What is your email address?',
      sub: 'This is where the audit lands.',
      ph: 'jane@company.com',
      autocomplete: 'email', maxlength: 254, plain: true,
      required: 'Please add your email address.',
      check: function (v) { return RE_EMAIL.test(v); },
      invalid: 'Enter a valid email address, like jane@company.com.'
    },
    {
      key: 'phone', name: 'phone', kind: 'text', type: 'tel',
      q: 'What is your phone number?',
      sub: 'So we can call to book the strategy session.',
      ph: '(555) 000-0000',
      autocomplete: 'tel', inputmode: 'tel', maxlength: 40,
      required: 'Please add a phone number.',
      check: function (v) { return RE_PHONE.test(v.replace(/[\s\-().]/g, '')); },
      invalid: 'Enter a number we can reach you on, like (555) 000-0000.'
    },
    {
      /* type="text" with inputmode="url", not type="url": a real url
         input rejects "yourcompany.com", which is how people type it.
         The value is sent exactly as typed, never normalised. */
      key: 'website', name: 'website', kind: 'text', type: 'text',
      q: 'What is your website?',
      sub: 'Optional. The site you want us to look at.',
      ph: 'yourcompany.com',
      autocomplete: 'url', inputmode: 'url', maxlength: 2000, plain: true,
      check: function (v) { return RE_URL.test(v); },
      invalid: 'That does not look like a web address. Try yourcompany.com.'
    },
    {
      key: 'service', name: 'service', kind: 'choice',
      q: 'Which service are you most interested in?',
      sub: 'Pick the closest one.',
      required: 'Pick the closest one to carry on.',
      options: [
        { label: 'Google Ads Management',         value: 'Google Ads Management' },
        { label: 'Meta Ads Management',           value: 'Meta Ads Management' },
        { label: 'Lead Generation',               value: 'Lead Generation' },
        { label: 'SEO / AI SEO',                  value: 'SEO / AI SEO' },
        { label: 'Website / Landing Page Design', value: 'Website / Landing Page Design' },
        { label: 'Full Package',                  value: 'Full Package (Multiple Services)' },
        { label: 'Not sure yet',                  value: 'Not sure, I need advice' }
      ]
    },
    {
      key: 'budget', name: 'budget', kind: 'choice',
      q: 'What is your monthly marketing budget?',
      sub: 'A range is enough. It sets what we recommend.',
      required: 'Pick a range to carry on.',
      options: [
        { label: 'Under $850',       value: 'Under $850/month' },
        { label: '$850 to $1,500',   value: '$850 - $1,500/month' },
        { label: '$1,500 to $2,500', value: '$1,500 - $2,500/month' },
        { label: '$2,500 to $7,500', value: '$2,500 - $7,500/month' },
        { label: 'Over $7,500',      value: 'Over $7,500/month' }
      ]
    },
    {
      key: 'message', name: 'message', kind: 'textarea',
      q: 'Anything else we should know?',
      sub: 'Optional. What you have tried, what is not working, any deadline.',
      ph: 'Tell us what you are dealing with',
      maxlength: 2000
    }
  ];

  /* Pages whose subject is unambiguous pre-answer step 6. /ads is left
     alone on purpose: it covers both Google and Meta, so a guess there
     would be wrong. */
  var SERVICE_BY_PATH = {
    '/seo': 'SEO / AI SEO',
    '/seo-south-africa': 'SEO / AI SEO',
    '/google-ads-south-africa': 'Google Ads Management',
    '/meta-ads-south-africa': 'Meta Ads Management',
    '/lead-gen': 'Lead Generation',
    '/lead-generation-dallas': 'Lead Generation',
    '/lead-generation-south-africa': 'Lead Generation',
    '/web-design': 'Website / Landing Page Design',
    '/web-design-south-africa': 'Website / Landing Page Design'
  };

  /* ---- State ---------------------------------------------------------- */
  var root = null, form = null, bar = null, status = null, submitBtn = null;
  var stepEls = [];
  var current = 0;
  var isOpen = false, sending = false;
  /* History: histToken is the id of the entry this overlay pushed, null
     when it holds none. histPending marks a history.back() we asked for
     and have not seen land yet. Both are needed: a bare boolean lets a
     close that races a reopen fire two traversals and take the visitor
     off the page. */
  var histToken = null, histPending = false;
  var lastFocus = null;
  var savedScrollY = 0;
  var focusTimer = null, hideTimer = null, autoTimer = null, watchdog = null;
  var inerted = [];

  /* ---- Helpers -------------------------------------------------------- */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalisePath(p) {
    if (!p) return '';
    if (p.charAt(0) !== '/') p = '/' + p;
    p = p.replace(/\.html$/i, '');
    p = p.replace(/\/+$/, '');
    return p === '' ? '/' : p;
  }

  function isAuditPath(p) { return normalisePath(p) === '/free-audit'; }

  function focusSafely(el) {
    if (!el || typeof el.focus !== 'function') return;
    /* preventScroll keeps the overlay's own scroller still: without it
       the question jumps on every step change. The options signature
       throws in old Safari, hence the fallback. */
    try { el.focus({ preventScroll: true }); } catch (err) { try { el.focus(); } catch (e2) {} }
  }

  /* offsetParent is null for every position: fixed element, so it is the
     wrong visibility test here. Client rects plus a visibility check is
     right for both the focus trap and focus restoration. */
  function isVisible(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return !cs || cs.visibility !== 'hidden';
  }

  /* ---- Build ---------------------------------------------------------- */
  function stepHtml(q, i) {
    var n = i + 1;
    var base = 'pxq-' + q.key;
    var errId = 'pxq-err-' + q.key;
    var last = (n === TOTAL);
    var h = [];

    h.push('<section class="pxq-step" data-step="' + n + '">');
    h.push('<div class="pxq-meta">');
    h.push('<button type="button" class="pxq-back">Back</button>');
    h.push('<p class="pxq-count" aria-hidden="true">' + n + ' of ' + TOTAL + '</p>');
    h.push('</div>');
    h.push('<p class="pxq-num" aria-hidden="true">' + (n < 10 ? '0' + n : n) + '</p>');

    if (q.kind === 'choice') {
      h.push('<p class="pxq-q" id="' + base + '-q">' + esc(q.q) + '</p>');
    } else {
      h.push('<label class="pxq-q" for="' + base + '">' + esc(q.q) + '</label>');
    }
    if (q.sub) h.push('<p class="pxq-sub">' + esc(q.sub) + '</p>');

    if (q.kind === 'choice') {
      h.push('<div class="pxq-options" role="radiogroup" aria-labelledby="' + base +
             '-q" aria-describedby="' + errId + '"' +
             (q.required ? ' aria-required="true"' : '') + '>');
      for (var j = 0; j < q.options.length; j++) {
        var oid = base + '-' + j;
        h.push('<div class="pxq-opt">');
        h.push('<input class="pxq-opt-input" type="radio" id="' + oid + '" name="' +
               q.name + '" value="' + esc(q.options[j].value) + '">');
        h.push('<label class="pxq-option" for="' + oid + '">' +
               '<span class="pxq-opt-dot" aria-hidden="true"></span>' +
               '<span class="pxq-opt-text">' + esc(q.options[j].label) + '</span></label>');
        h.push('</div>');
      }
      h.push('</div>');
    } else if (q.kind === 'textarea') {
      h.push('<textarea class="pxq-input pxq-textarea" id="' + base + '" name="' + q.name +
             '" rows="4" maxlength="' + q.maxlength + '" placeholder="' + esc(q.ph) +
             '" aria-describedby="' + errId + '"></textarea>');
    } else {
      /* Never the native required attribute. Seven steps are display
         none at any moment, and Chrome refuses to submit a form
         containing an invalid control it cannot focus ("An invalid form
         control with name='' is not focusable"), which loses the lead
         silently. The form also carries novalidate as a second defence. */
      h.push('<input class="pxq-input" id="' + base + '" name="' + q.name +
             '" type="' + q.type + '"' +
             (q.autocomplete ? ' autocomplete="' + q.autocomplete + '"' : '') +
             (q.inputmode ? ' inputmode="' + q.inputmode + '"' : '') +
             (q.maxlength ? ' maxlength="' + q.maxlength + '"' : '') +
             (q.plain ? ' autocapitalize="off" autocorrect="off" spellcheck="false"' : '') +
             (q.required ? ' aria-required="true"' : '') +
             ' enterkeyhint="next" placeholder="' + esc(q.ph) +
             '" aria-describedby="' + errId + '">');
    }

    h.push('<p class="pxq-error" id="' + errId + '" role="alert" tabindex="-1"></p>');

    h.push('<div class="pxq-actions">');
    if (last) {
      /* No name attribute: a disabled submit button's name and value
         pair is dropped from the payload, and with no name there is
         nothing to drop. */
      h.push('<button type="submit" class="btn-primary pxq-submit">' + SUBMIT_LABEL + '</button>');
      h.push('<span class="pxq-hint">Press <kbd>Cmd</kbd> or ' +
             '<kbd>Ctrl</kbd> + <kbd>Enter</kbd> to send</span>');
    } else {
      h.push('<button type="button" class="btn-primary pxq-next">Next</button>');
      h.push('<span class="pxq-hint">Press <kbd>Enter</kbd></span>');
    }
    h.push('</div>');
    h.push('</section>');
    return h.join('');
  }

  function build() {
    if (root) return;
    var existing = document.getElementById('pxq-overlay');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    root = document.createElement('div');
    root.id = 'pxq-overlay';
    root.className = 'pxq';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'pxq-title');
    root.setAttribute('aria-describedby', 'pxq-intro');
    root.setAttribute('tabindex', '-1');
    root.hidden = true;

    var h = [];
    h.push('<div class="pxq-progress" aria-hidden="true"><span class="pxq-bar"></span></div>');
    h.push('<div class="pxq-shell">');
    h.push('<div class="pxq-chrome">');
    /* The nav logo, verbatim, so the overlay chrome reads as the same
       masthead the visitor just clicked in. .gradient-text is the
       existing component in section 3 of the stylesheet. */
    h.push('<p class="pxq-brand">Position <span class="gradient-text">Xero</span></p>');
    h.push('<button type="button" class="pxq-close" aria-label="Close">' +
           '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false">' +
           '<line x1="6" y1="6" x2="18" y2="18"></line>' +
           '<line x1="18" y1="6" x2="6" y2="18"></line></svg></button>');
    h.push('</div>');
    h.push('<form id="pxq-form" class="pxq-form" method="POST" action="' + ENDPOINT + '" novalidate>');
    h.push('<h2 id="pxq-title" class="pxq-sr">Book your free audit</h2>');
    h.push('<p id="pxq-intro" class="pxq-sr">Eight quick questions. Press Escape to close.</p>');
    h.push('<p class="pxq-sr" id="pxq-status" aria-live="polite"></p>');

    /* FormSubmit configuration, copied from public/contact.html. */
    h.push('<input type="hidden" name="_subject" value="New free-audit lead from positionxero.com">');
    h.push('<input type="hidden" name="_template" value="table">');
    h.push('<input type="hidden" name="_captcha" value="false">');
    h.push('<input type="hidden" name="_next" value="https://www.positionxero.com/thank-you">');
    h.push('<input type="hidden" name="_autoresponse" value="Thanks for requesting your free audit from Position Xero. We&#39;ve received your details and we will reach out within 24 hours to schedule your call. The Position Xero Team">');
    h.push('<input type="text" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">');
    /* Non underscore fields land in the lead table, so the owner can
       tell the overlay stream from contact.html's form. */
    h.push('<input type="hidden" name="source" value="Free audit overlay">');
    h.push('<input type="hidden" name="page" id="pxq-page" value="">');

    for (var i = 0; i < QUESTIONS.length; i++) h.push(stepHtml(QUESTIONS[i], i));

    h.push('</form>');
    h.push('</div>');
    root.innerHTML = h.join('');
    document.body.appendChild(root);

    form = root.querySelector('#pxq-form');
    bar = root.querySelector('.pxq-bar');
    status = root.querySelector('#pxq-status');
    submitBtn = root.querySelector('.pxq-submit');
    stepEls = [];
    var found = root.querySelectorAll('.pxq-step');
    for (var s = 0; s < found.length; s++) stepEls.push(found[s]);

    wire();
  }

  /* ---- Steps ---------------------------------------------------------- */
  function setProgress(f) {
    if (bar) bar.style.transform = 'scaleX(' + f + ')';
  }

  function stepFraction(i) {
    /* Denominator is 9, not 8: 100% is reserved for a sent form. A bar
       that reads full while a question is still unanswered is a lie. */
    return (i + 1) / (TOTAL + 1);
  }

  function cancelAuto() {
    if (autoTimer) { window.clearTimeout(autoTimer); autoTimer = null; }
  }

  function clearError(i) {
    var step = stepEls[i];
    if (!step) return;
    var node = step.querySelector('.pxq-error');
    if (node) node.textContent = '';
    var field = step.querySelector('.pxq-input');
    if (field) field.removeAttribute('aria-invalid');
    /* The group carries the invalid state, not the seven radios inside
       it: one announcement instead of seven, and it is what drives the
       alert coloured card borders in the stylesheet. */
    var group = step.querySelector('.pxq-options');
    if (group) group.removeAttribute('aria-invalid');
  }

  function clearErrors() {
    for (var i = 0; i < stepEls.length; i++) clearError(i);
  }

  function setError(i, msg) {
    var step = stepEls[i];
    var node = step.querySelector('.pxq-error');
    if (node) node.textContent = msg;
    var field = step.querySelector('.pxq-input');
    if (field) field.setAttribute('aria-invalid', 'true');
    var group = step.querySelector('.pxq-options');
    if (group) group.setAttribute('aria-invalid', 'true');
  }

  function focusStep() {
    var step = stepEls[current];
    if (!step) return;
    focusSafely(
      step.querySelector('.pxq-opt-input:checked') ||
      step.querySelector('input:not([type="hidden"]), textarea') ||
      step.querySelector('.pxq-next, .pxq-submit')
    );
  }

  function showStep(i) {
    cancelAuto();
    current = i;
    for (var s = 0; s < stepEls.length; s++) {
      /* The display none to block swap in this same synchronous block is
         what replays the entry animation. Nothing else is needed. */
      if (s === i) stepEls[s].classList.add('is-active');
      else stepEls[s].classList.remove('is-active');
    }
    clearErrors();
    var back = stepEls[i].querySelector('.pxq-back');
    if (back) back.disabled = (i === 0);
    if (status) status.textContent = 'Question ' + (i + 1) + ' of ' + TOTAL;
    setProgress(stepFraction(i));
    if (focusTimer) window.clearTimeout(focusTimer);
    /* 60ms: focusing an element that was display none one tick ago is
       unreliable in Safari, and the delay lets the polite counter land
       before the question is announced. */
    focusTimer = window.setTimeout(function () {
      focusTimer = null;
      focusStep();
    }, 60);
  }

  function validateStep(i) {
    var q = QUESTIONS[i];
    var step = stepEls[i];
    if (q.kind === 'choice') {
      if (q.required && !step.querySelector('.pxq-opt-input:checked')) {
        setError(i, q.required);
        return false;
      }
      clearError(i);
      return true;
    }
    var field = step.querySelector('.pxq-input');
    var v = trim(field ? field.value : '');
    if (!v) {
      if (q.required) { setError(i, q.required); return false; }
    } else if (q.check && !q.check(v)) {
      setError(i, q.invalid);
      return false;
    }
    clearError(i);
    return true;
  }

  function focusInvalid(i) {
    var step = stepEls[i];
    focusSafely(step.querySelector('.pxq-input') ||
                step.querySelector('.pxq-opt-input:checked') ||
                step.querySelector('.pxq-opt-input'));
  }

  function next() {
    if (sending) return;
    cancelAuto();
    if (!validateStep(current)) { focusInvalid(current); return; }
    if (current < TOTAL - 1) showStep(current + 1);
  }

  function back() {
    if (sending) return;
    cancelAuto();
    if (current > 0) showStep(current - 1);
  }

  /* ---- Submit --------------------------------------------------------- */
  function doSubmit() {
    if (sending || !submitBtn || submitBtn.disabled) return;
    /* Route through the real submit event so the handler below is the
       only place that knows how to send. form.submit() would bypass it. */
    if (form.requestSubmit) form.requestSubmit(submitBtn);
    else submitBtn.click();
  }

  function stopSending(restoreProgress) {
    if (watchdog) { window.clearTimeout(watchdog); watchdog = null; }
    sending = false;
    if (root) root.classList.remove('is-sending');
    if (form) form.removeAttribute('aria-busy');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = SUBMIT_LABEL;
    }
    if (restoreProgress) setProgress(stepFraction(TOTAL - 1));
  }

  function onSendTimeout() {
    watchdog = null;
    stopSending(true);
    var node = stepEls[TOTAL - 1].querySelector('.pxq-error');
    if (node) {
      /* Address assembled here rather than sitting in the source,
         matching the scraper hygiene the [data-em-u] block above uses. */
      node.textContent = 'That did not go through. Check your connection and try again, or email ' +
        ('hello' + '@' + 'positionxero.com') + '.';
      focusSafely(node);
    }
  }

  /* ---- History --------------------------------------------------------
     One entry is pushed while the overlay is open so the browser Back
     button closes it instead of leaving the site. The URL is
     deliberately unchanged: pointing it at /free-audit would land a
     refresh on the standalone funnel, which is a different flow.

     Each entry carries a unique token, and close() steps back only when
     the current entry is provably the one this overlay pushed. Two
     guards, not one, because a close immediately followed by a reopen
     can otherwise queue a second traversal and walk the visitor off the
     page. Losing the Back closes behaviour in that rare window is a fair
     price for never losing the page. */
  function histPush() {
    if (histToken || histPending) return;
    var t = 'pxq' + Date.now() + '.' + Math.random();
    try {
      history.pushState({ pxq: 1, t: t }, '', location.href);
      histToken = t;
    } catch (err) {
      /* Some browsers throw on an opaque origin (file://, sandboxed
         iframes). Without an entry we simply do not manage history:
         Back then leaves the page, which is the pre-overlay behaviour
         anyway. */
      histToken = null;
    }
  }

  function histPop(fromPop) {
    if (fromPop) { histToken = null; return; }   /* the entry is already gone */
    if (!histToken) return;
    var st = history.state;
    var mine = !!st && st.pxq === 1 && st.t === histToken;
    histToken = null;
    if (!mine) return;       /* something else moved: leave history alone */
    histPending = true;
    try { history.back(); } catch (err) { histPending = false; }
  }

  /* ---- Open and close ------------------------------------------------- */
  function lock() {
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    if (sbw > 0) document.documentElement.style.setProperty('--pxq-sbw', sbw + 'px');
    document.documentElement.classList.add('pxq-locked');
    document.body.classList.add('pxq-locked');
  }

  function unlock() {
    document.documentElement.classList.remove('pxq-locked');
    document.body.classList.remove('pxq-locked');
    document.documentElement.style.removeProperty('--pxq-sbw');
  }

  function hideBackground() {
    inerted = [];
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (el === root) continue;
      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'STYLE') continue;
      inerted.push([el, el.getAttribute('aria-hidden'), el.hasAttribute('inert')]);
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
    }
  }

  function restoreBackground() {
    for (var i = 0; i < inerted.length; i++) {
      var el = inerted[i][0], aria = inerted[i][1], hadInert = inerted[i][2];
      if (aria === null) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', aria);
      if (!hadInert) el.removeAttribute('inert');
    }
    inerted = [];
  }

  function preselect(link) {
    var wanted = (link && link.getAttribute('data-pxq-service')) ||
                 SERVICE_BY_PATH[normalisePath(location.pathname)];
    if (!wanted || !form) return;
    /* Never clobber a pick the user already made in an earlier session
       of the overlay. */
    if (form.querySelector('input[name="service"]:checked')) return;
    var radios = form.querySelectorAll('input[name="service"]');
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].value === wanted) { radios[i].checked = true; return; }
    }
  }

  /* public/css/style.css and public/js/main.js are separate files with
     separate caches, so a visitor can hold a fresh main.js against a
     stale style.css for as long as the old stylesheet is cached.
     Without the overlay rules, position would still be static: the
     questions would land as an unstyled block below the footer and the
     call to action would look broken. Check one rule that only the new
     CSS sets, and if it is missing let the anchor navigate to
     /free-audit instead. The value is readable while the overlay is
     still hidden, because position is not a layout dependent property. */
  function isStyled() {
    if (!root || !window.getComputedStyle) return false;
    var cs = window.getComputedStyle(root);
    return !!cs && cs.position === 'fixed';
  }

  /* Returns false when the overlay cannot be shown, so the caller can
     leave the click alone and let the browser follow the link. */
  function open(link) {
    if (isOpen) return true;

    try { build(); } catch (err) { return false; }
    if (!isStyled()) return false;

    isOpen = true;

    /* A quick reopen must not be hidden by the previous close's fade. */
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }

    var active = document.activeElement;
    lastFocus = (active && active !== document.body) ? active : (link || null);

    /* The call to action also lives inside the mobile menu on every
       page. setMenu is a local in the mobile nav block above and is not
       exported, so drive the hamburger instead. Guarded on .open first,
       because clicking a closed hamburger would open the menu. */
    var mm = document.getElementById('mobileMenu');
    if (mm && mm.classList.contains('open')) {
      var hb = document.getElementById('hamburger');
      if (hb) hb.click();
    }

    preselect(link);
    var pageField = document.getElementById('pxq-page');
    if (pageField) pageField.value = location.href;

    savedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    lock();
    hideBackground();

    histPush();

    root.hidden = false;
    showStep(0);

    /* Snap the bar to empty with the transition off, so it always grows
       from zero even when a previous session left it part filled. */
    if (bar) {
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(0)';
      void bar.offsetWidth;
      bar.style.transition = '';
    }

    void root.offsetWidth;              /* flush, or the backdrop starts opaque */
    root.classList.add('is-open');
    window.requestAnimationFrame(function () {
      if (isOpen) setProgress(stepFraction(current));
    });

    focusSafely(root);                  /* the 60ms step focus refines this */
    return true;
  }

  function close(fromPop) {
    if (!isOpen) return;
    isOpen = false;

    /* A pending step focus firing after the close would yank focus back
       into a hidden dialog and strand keyboard users. */
    if (focusTimer) { window.clearTimeout(focusTimer); focusTimer = null; }
    cancelAuto();
    stopSending(false);

    root.classList.remove('is-open');

    /* Restore inertness now, not after the fade, so the focus restore
       below can actually land. */
    restoreBackground();
    unlock();

    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (Math.abs(y - savedScrollY) > 1) {
      /* html { scroll-behavior: smooth } is global in section 2, so the
         restore has to say behavior: 'auto' or it animates. */
      try { window.scrollTo({ top: savedScrollY, left: 0, behavior: 'auto' }); }
      catch (err) { window.scrollTo(0, savedScrollY); }
    }

    if (hideTimer) window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(function () {
      hideTimer = null;
      if (isOpen) return;              /* reopened during the fade */
      root.hidden = true;
      setProgress(0);
    }, 320);

    clearErrors();

    /* The trigger is very often the call to action inside the mobile
       menu, which is display none by now, so focusing it would put focus
       nowhere. Fall back to the nav call to action on desktop and the
       hamburger on mobile, where the nav links themselves are hidden. */
    var target = null;
    var candidates = [lastFocus, document.querySelector('.nav-cta'), document.getElementById('hamburger')];
    for (var c = 0; c < candidates.length; c++) {
      var el = candidates[c];
      if (el && document.contains(el) && isVisible(el)) { target = el; break; }
    }
    focusSafely(target || document.body);
    lastFocus = null;

    histPop(fromPop);
  }

  /* ---- Wiring --------------------------------------------------------- */
  function wire() {
    /* Chrome and Firefox fire a real click event when a radio is
       selected with the arrow keys, so "bind auto advance to click, not
       change" is not enough on its own: arrowing through the options
       would advance the step on the first press and make them impossible
       to browse. This flag records what the last interaction actually
       was. Arrow keys browse; Space, a tap and a mouse click commit. */
    var kbdNav = false;

    var closeBtn = root.querySelector('.pxq-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { close(false); });

    /* A short beat between the card lighting up and the step changing,
       so the pick registers. The pause is feedback rather than motion,
       so it is not shortened under prefers-reduced-motion. */
    function commitChoice() {
      if (sending) return;
      cancelAuto();
      autoTimer = window.setTimeout(function () {
        autoTimer = null;
        next();
      }, 320);
    }

    function clearKbdNav() { kbdNav = false; }
    form.addEventListener('pointerdown', clearKbdNav, true);
    form.addEventListener('mousedown', clearKbdNav, true);  /* pre pointer-events fallback */
    form.addEventListener('touchstart', clearKbdNav, true);

    form.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('.pxq-next')) { next(); return; }
      if (t.closest('.pxq-back')) { back(); return; }
      /* Auto advance hangs off click rather than change, so a tap, a
         mouse click, a label click and Space on an unchecked radio all
         commit. Arrow keys also fire click in Chrome and Firefox, so
         kbdNav is what actually separates browsing from committing. */
      if (t.classList && t.classList.contains('pxq-opt-input')) {
        if (sending) return;
        clearError(current);
        cancelAuto();
        if (kbdNav) { kbdNav = false; return; }   /* arrow browsing, not a pick */
        commitChoice();
      }
    });

    form.addEventListener('keydown', function (e) {
      var k = e.key, c = e.keyCode, t = e.target;
      kbdNav = (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight' ||
                c === 37 || c === 38 || c === 39 || c === 40);

      /* Space on a radio that is ALREADY checked fires no click: the
         browser only runs a radio's activation behaviour when the state
         changes, so arrowing to a card and then pressing Space would do
         nothing. An unchecked radio still takes the click path above. */
      if ((k === ' ' || k === 'Spacebar' || c === 32) &&
          t && t.classList && t.classList.contains('pxq-opt-input') && t.checked) {
        e.preventDefault();
        kbdNav = false;
        clearError(current);
        commitChoice();
        return;
      }

      if (k !== 'Enter' && c !== 13) return;
      /* Focus on a button: bail out and let the browser activate it.
         Doing both would advance two steps. */
      if (t && t.tagName === 'BUTTON') return;
      /* A bare Enter in the last step's textarea inserts a newline. Only
         Cmd or Ctrl plus Enter sends, which is what the hint says. */
      if (t && t.tagName === 'TEXTAREA' && !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      if (sending) return;
      if (current === TOTAL - 1) doSubmit();
      else next();
    });

    form.addEventListener('submit', function (e) {
      if (sending) { e.preventDefault(); return; }

      /* Re-check every step, not only the last: a user can walk back and
         empty a required field before sending. */
      for (var i = 0; i < TOTAL; i++) {
        if (!validateStep(i)) {
          e.preventDefault();
          if (i !== current) showStep(i);
          validateStep(i);            /* showStep clears errors, so restate it */
          focusInvalid(i);
          return;
        }
      }

      sending = true;
      setProgress(1);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending';
      root.classList.add('is-sending');
      form.setAttribute('aria-busy', 'true');
      /* Offline, or a blocked POST, leaves the user staring at a dead
         Sending button. If the navigation has not happened in 12
         seconds, hand the form back with a way out. */
      watchdog = window.setTimeout(onSendTimeout, 12000);
      /* No preventDefault: the real cross origin POST and the navigation
         to /thank-you proceed from here. */
    });

    /* Escape lives on document so it still works when focus has drifted
       to body. It always closes, from any step, including mid send. The
       mobile nav block above binds its own Escape, but it is guarded on
       .mobile-menu.open and open() has already closed the menu, so only
       one of the two ever acts. */
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) close(false);
    });

    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' && e.keyCode !== 9) return;
      var all = root.querySelectorAll(
        'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), ' +
        'input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), ' +
        '[tabindex]:not([tabindex="-1"])'
      );
      var visible = [];
      for (var i = 0; i < all.length; i++) if (isVisible(all[i])) visible.push(all[i]);
      if (!visible.length) return;
      var first = visible[0], last = visible[visible.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        focusSafely(last);
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        focusSafely(first);
      }
    });
  }

  /* ---- Call to action interception ------------------------------------ */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    /* Any modifier means the user wants a new tab, a new window or a
       save. Middle clicks fire auxclick, not click, in every current
       browser, so nothing is bound for them; e.button is the safety net. */
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target;
    if (!t || !t.closest) return;
    var a = t.closest('a[href]');
    if (!a) return;
    if (a.hasAttribute('download') || a.hasAttribute('data-pxq-skip')) return;
    var target = (a.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return;
    if (a.host && a.host !== location.host) return;
    if (!isAuditPath(a.pathname)) return;
    /* /free-audit is the standalone funnel and does not load this file,
       but keep the guard so the overlay can never stack on top of it. */
    if (isAuditPath(location.pathname)) return;
    /* preventDefault only once the overlay is actually up. If it could
       not open, the click stays a plain link to the standalone funnel. */
    if (open(a)) e.preventDefault();
  });

  window.addEventListener('popstate', function () {
    /* A traversal this code asked for in close() is not a Back press by
       the visitor, so it must not be treated as one. Without this, a
       close that lands after a reopen would shut the overlay the user
       just opened. */
    var ours = histPending;
    histPending = false;
    if (ours) return;
    if (isOpen) close(true);
  });

  /* The page is going away, which for a submit means the POST is on its
     way to FormSubmit. Let the watchdog go: firing an error into a page
     that is already unloading helps nobody. */
  window.addEventListener('pagehide', function () {
    if (watchdog) { window.clearTimeout(watchdog); watchdog = null; }
  });

  /* bfcache: leaving mid questionnaire and pressing Back can restore the
     page frozen with the overlay open and the scroll lock still applied.
     Snap straight back to the closed state. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    isOpen = false;
    histToken = null;
    histPending = false;
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
    if (focusTimer) { window.clearTimeout(focusTimer); focusTimer = null; }
    cancelAuto();
    if (root) {
      stopSending(false);
      root.classList.remove('is-open');
      root.hidden = true;
      setProgress(0);
      clearErrors();
    } else {
      sending = false;
    }
    restoreBackground();
    unlock();
  });
})();
