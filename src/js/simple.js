import '../styles/simple.css';

/**
 * Homepage, "less is more" preview (17 November 2026). The page reads and
 * works without this file. It only adds:
 *   - GA4 lead events on every WhatsApp and phone tap (same events as before)
 *   - a hairline under the header once the page scrolls
 *   - the phone menu closing on a link tap, Escape or a tap outside
 */

/* GA4: one event per WhatsApp or phone tap. GA4 itself is added at build
   time by vite.config.js. */
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

const header = document.querySelector('.site-header');
if (header) {
  const sync = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  sync();
  window.addEventListener('scroll', sync, { passive: true });
}

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

/* Hero art follows the mouse (owner, 17 Nov 2026: "make the hero section
   item react more to the mouse"). Desktop with a real mouse only, and not
   for reduced motion. The pointer anywhere over the hero sets --mx and
   --my (-1 to 1), eased each frame; the CSS tilts the window toward it,
   slides the white orbit the other way and the pixel bits furthest, so
   the layers part like depth. Hovering the window itself grows it a touch. */
const art = document.querySelector('.hero__art');
const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
const still = window.matchMedia('(prefers-reduced-motion: reduce)');
if (art && fine.matches && !still.matches) {
  const hero = document.querySelector('.hero');
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const step = () => {
    cx += (tx - cx) * 0.09;
    cy += (ty - cy) * 0.09;
    art.style.setProperty('--mx', cx.toFixed(4));
    art.style.setProperty('--my', cy.toFixed(4));
    raf = Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005 ? requestAnimationFrame(step) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
  hero.addEventListener('pointermove', (event) => {
    const r = art.getBoundingClientRect();
    // measured from the art's own centre, so the window turns to face the pointer
    const nx = (event.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
    const ny = (event.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
    tx = Math.max(-1, Math.min(1, nx));
    ty = Math.max(-1, Math.min(1, ny));
    kick();
  });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  art.addEventListener('pointerenter', () => art.classList.add('is-hover'));
  art.addEventListener('pointerleave', () => art.classList.remove('is-hover'));
}
