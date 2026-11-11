import '../styles/home.css';

/**
 * The package pages (/, /packages, /premium), 12 November 2026.
 * Everything here is small and optional: the pages read and work without it.
 *   - Monthly / yearly switch on the package cards
 *   - the phone menu closes after a tap, on Escape or a tap outside
 *   - a GA4 generate_lead event on every WhatsApp and phone link
 *   - the premium builder: running "from" totals and the WhatsApp message
 *   - the glass X, a small WebGL shader loaded after the page has settled
 */

/* ---------- GA4: one event per WhatsApp or phone tap ----------
   GA4 itself is added at build time by vite.config.js. The premium links
   carry their package in data-lead-package. */
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href*="wa.me/"], a[href^="tel:"]');
  if (!link || typeof gtag !== 'function') return;
  const section = link.closest('section[id]');
  gtag('event', 'generate_lead', {
    method: link.href.startsWith('tel:') ? 'phone' : 'whatsapp',
    package: link.dataset.leadPackage || 'none',
    location: link.dataset.leadLocation || (section ? section.id : 'page')
  });
});

/* ---------- billing switch ---------- */
const toggles = document.querySelectorAll('[data-billing-toggle]');
function setBilling(mode) {
  toggles.forEach((t) => t.querySelectorAll('[data-billing]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.billing === mode));
  }));
  document.querySelectorAll('.plan [data-monthly]').forEach((el) => {
    el.textContent = el.dataset[mode];
  });
  document.querySelectorAll('.plan a[data-wa-monthly]').forEach((a) => {
    a.href = mode === 'yearly' ? a.dataset.waYearly : a.dataset.waMonthly;
  });
}
toggles.forEach((t) => t.addEventListener('click', (event) => {
  const b = event.target.closest('[data-billing]');
  if (b) setBilling(b.dataset.billing);
}));

/* ---------- phone menu ---------- */
const menu = document.querySelector('.menu');
if (menu) {
  menu.addEventListener('click', (event) => {
    if (event.target.closest('.menu__panel a')) menu.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
}

/* ---------- premium builder ---------- */
const form = document.querySelector('[data-builder]');
if (form) {
  const rands = (n) => 'R' + n.toLocaleString('en-US');
  const dollars = (n) => '$' + n.toLocaleString('en-US');
  const list = document.querySelector('[data-summary-list]');
  const onceRow = document.querySelector('[data-total-once]');
  const monthRow = document.querySelector('[data-total-monthly]');
  const usdRow = document.querySelector('[data-total-usd]');
  const briefRow = document.querySelector('[data-total-brief]');
  const stickyTotal = document.querySelector('[data-sticky-total]');
  const waLinks = document.querySelectorAll('[data-premium-wa]');

  const update = () => {
    const picked = [...form.querySelectorAll('input:checked')].filter((i) => !i.dataset.skip);
    let once = 0;
    let monthly = 0;
    const usd = [];
    const brief = [];
    const lines = [];
    list.textContent = '';
    for (const input of picked) {
      const name = input.dataset.name;
      let price = '';
      if (input.dataset.once) { once += Number(input.dataset.once); price = `from ${rands(Number(input.dataset.once))} once-off`; }
      if (input.dataset.monthly) { monthly += Number(input.dataset.monthly); price = `from ${rands(Number(input.dataset.monthly))} a month`; }
      if (input.dataset.usd) { usd.push(`${name} management from ${dollars(Number(input.dataset.usd))} a month, plus ad spend`); price = `from ${dollars(Number(input.dataset.usd))} a month`; }
      if (input.dataset.brief) { brief.push(name); price = 'priced on your brief'; }
      const li = document.createElement('li');
      const a = document.createElement('span');
      const b = document.createElement('span');
      a.textContent = name;
      b.textContent = price;
      li.append(a, b);
      list.append(li);
      lines.push(price ? `${name} (${price})` : name);
    }
    if (!picked.length) {
      const li = document.createElement('li');
      li.className = 'summary__empty';
      li.textContent = 'Nothing picked yet.';
      list.append(li);
    }
    onceRow.hidden = !once;
    monthRow.hidden = !monthly;
    onceRow.querySelector('[data-total-once-value]').textContent = rands(once);
    monthRow.querySelector('[data-total-monthly-value]').textContent = rands(monthly);
    usdRow.hidden = !usd.length;
    usdRow.textContent = usd.length ? `Plus ${usd.join('; ')}.` : '';
    briefRow.hidden = !brief.length;
    briefRow.textContent = brief.length ? `Priced on your brief: ${brief.join(', ')}.` : '';

    // the bar keeps to two short lines on a phone
    const rows = [];
    if (once) rows.push(`From ${rands(once)} once-off`);
    if (monthly) rows.push(`${rows.length ? '+' : 'From'} ${rands(monthly)} a month`);
    if (usd.length) {
      if (rows.length) rows[rows.length - 1] += ' + ads';
      else rows.push('Ads: from $' + Math.min(...picked.filter((i) => i.dataset.usd).map((i) => Number(i.dataset.usd))) + ' a month');
    }
    if (!rows.length && brief.length) rows.push('Priced on your brief');
    if (!rows.length) rows.push('Pick your options');
    stickyTotal.textContent = '';
    rows.forEach((r) => {
      const span = document.createElement('span');
      span.textContent = r;
      stickyTotal.append(span);
    });

    const message = lines.length
      ? `Hi Position Xero, I'd like a premium package with: ${lines.join('; ')}. Can we talk about my brief?`
      : "Hi Position Xero, I'd like to talk about a premium package.";
    const href = `https://wa.me/27662412155?text=${encodeURIComponent(message)}`;
    waLinks.forEach((a) => { a.href = href; });
  };
  form.addEventListener('change', update);
  form.addEventListener('submit', (event) => event.preventDefault());
  update();
}

/* ---------- the glass X ----------
   Loaded only after the page has painted and gone quiet, so it never
   competes with the first screen. The SVG outline stays if WebGL is
   missing or anything fails. */
const canvas = document.querySelector('[data-glass-canvas]');
const markEl = document.querySelector('[data-glass-mark]');
if (canvas && markEl) {
  const start = () => import('./glass-mark.js')
    .then(({ startGlassMark }) => startGlassMark(canvas, markEl))
    .catch(() => {});
  const idle = () => ('requestIdleCallback' in window
    ? window.requestIdleCallback(start, { timeout: 2000 })
    : setTimeout(start, 600));
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}
