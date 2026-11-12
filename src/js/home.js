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
const press = (buttons, view) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.show === view)));
const setters = [...document.querySelectorAll('[data-view-scope]')].map((scope) => {
  const group = scope.id ? document.querySelector(`[data-view-for="${scope.id}"]`) : null;
  const buttons = group ? [...group.querySelectorAll('[data-show]')] : [];
  const set = (view) => {
    scope.dataset.view = view;
    press(buttons, view);
  };
  set(small.matches ? 'phone' : 'desktop');
  buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.show)));
  return set;
});
/* /work also has one switch for every site at once */
document.querySelectorAll('[data-view-all]').forEach((group) => {
  const buttons = [...group.querySelectorAll('[data-show]')];
  press(buttons, small.matches ? 'phone' : 'desktop');
  buttons.forEach((b) => b.addEventListener('click', () => {
    press(buttons, b.dataset.show);
    setters.forEach((set) => set(b.dataset.show));
  }));
});

/* ---------- client-name tape: a pause button for touch and keyboard ---------- */
const tape = document.querySelector('.tape');
const pause = tape && tape.querySelector('.tape__pause');
if (pause) {
  pause.addEventListener('click', () => {
    const paused = tape.classList.toggle('is-paused');
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Play the moving names' : 'Pause the moving names');
  });
}

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
  // anything already on screen (a reload half way down, or a landing on
  // /packages#more) shows at once instead of flashing out and back in
  document.querySelectorAll('.rv').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
    else io.observe(el);
  });
  document.documentElement.classList.add('rv-on');
}
