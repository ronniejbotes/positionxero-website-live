import '../styles/home.css';

/**
 * The front pages (/, /packages, /work), second pass, 12 November 2026.
 * Everything here is small and optional: the pages read and work without it.
 *   - GA4 lead events on every WhatsApp and phone link
 *   - the monthly / yearly switch on the packages
 *   - the desktop / phone switch on the work previews
 *   - the phone menu closes after a tap, on Escape or a tap outside
 *   - blocks below the first screen ease in as they arrive
 */

/* ---------- GA4: one event per WhatsApp or phone tap ----------
   GA4 itself is added at build time by vite.config.js. Each link carries
   its package and location. The "Looking for something more?" button also
   sends its own event, looking_for_more_click (owner, 12 Nov 2026: to see
   over time how often the packages were not what a visitor wanted). */
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href*="wa.me/"], a[href^="tel:"]');
  if (!link || typeof gtag !== 'function') return;
  const section = link.closest('section[id]');
  const location = link.dataset.leadLocation || (section ? section.id : 'page');
  gtag('event', 'generate_lead', {
    method: link.href.startsWith('tel:') ? 'phone' : 'whatsapp',
    package: link.dataset.leadPackage || 'none',
    location
  });
  if (link.dataset.leadEvent) gtag('event', link.dataset.leadEvent, { location });
});

/* ---------- billing switch ---------- */
const toggles = document.querySelectorAll('[data-billing-toggle]');
function setBilling(mode) {
  toggles.forEach((t) => t.querySelectorAll('[data-billing]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.billing === mode));
  }));
  document.querySelectorAll('.pk-col [data-monthly]').forEach((el) => {
    el.textContent = el.dataset[mode];
  });
  document.querySelectorAll('.pk-col a[data-wa-monthly]').forEach((a) => {
    a.href = mode === 'yearly' ? a.dataset.waYearly : a.dataset.waMonthly;
  });
}
toggles.forEach((t) => t.addEventListener('click', (event) => {
  const b = event.target.closest('[data-billing]');
  if (b) setBilling(b.dataset.billing);
}));

/* ---------- desktop / phone switch ----------
   Phones open on the phone view, wider screens on the desktop view; the
   CSS does the same before this runs, so nothing jumps. */
const small = window.matchMedia('(max-width: 767px)');
document.querySelectorAll('[data-view-scope]').forEach((scope) => {
  const group = scope.id ? document.querySelector(`[data-view-for="${scope.id}"]`) : null;
  const buttons = group ? [...group.querySelectorAll('[data-show]')] : [];
  const set = (view) => {
    scope.dataset.view = view;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.show === view)));
  };
  set(small.matches ? 'phone' : 'desktop');
  buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.show)));
});

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

/* ---------- reveal ----------
   Blocks are only hidden once this script is running (the rv-on class),
   so a page whose script fails still shows everything. */
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  document.documentElement.classList.add('rv-on');
  document.querySelectorAll('.rv').forEach((el) => io.observe(el));
}
