/**
 * Shared header wiring: hamburger / side menu / sound toggle.
 * Used by every page.
 */

export function initHeader() {
  const burger = document.querySelector('.hamburger');
  const backdrop = document.querySelector('.side-menu__backdrop');

  const setOpen = (open) => {
    document.body.setAttribute('data-menu-open', String(open));
    burger?.setAttribute('aria-expanded', String(open));
    burger?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  burger?.addEventListener('click', () => {
    setOpen(document.body.getAttribute('data-menu-open') !== 'true');
  });
  backdrop?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  document.querySelectorAll('.side-menu__nav a').forEach((a) =>
    a.addEventListener('click', () => setOpen(false))
  );

  // Sound toggle is visual-only in this rebuild (no audio track shipped).
  const sound = document.querySelector('.sound-toggle');
  sound?.addEventListener('click', () => {
    const muted = sound.getAttribute('data-muted') !== 'true';
    sound.setAttribute('data-muted', String(muted));
    sound.setAttribute('aria-pressed', String(!muted));
  });
}

/**
 * Header retract on the top page (28 October 2026 phone audit).
 *
 * The scene asks for the header to step aside on the Cognexa peel and on
 * everything after it (HudVisibility calls setHeaderRetract). That request
 * used to be absolute: from the end of the Cognexa runway to the bottom of
 * the page the header sat at translateY(-100%). On a 390px phone that is
 * about 18,000px, the whole ledger, the outro and the footer, and scrolling
 * back up 2,000px never brought it back. Now the request only holds while
 * the reader is moving down. Any upward scroll brings the header back, and
 * the next downward scroll in that stretch tucks it away again, which is
 * what every other page does (public/js/immersive.js).
 *
 * Direction is judged on travel summed since the last change of direction,
 * not on the distance moved in one frame, so a slow drag up (a few px a
 * frame) still counts. Focus inside the header always shows it.
 */
const RETRACT_TRAVEL = 8; // px of travel one way before the header reacts
const retract = { zone: false, down: true, travel: 0, lastY: 0, applied: null };

function applyRetract() {
  const header = document.querySelector('.header');
  const focused = !!header && header.contains(document.activeElement);
  const menuOpen = document.body.getAttribute('data-menu-open') === 'true';
  const hidden = retract.zone && retract.down && !focused && !menuOpen;
  if (hidden === retract.applied) return;
  retract.applied = hidden;
  document.body.setAttribute('data-header-hidden', String(hidden));
}

export function setHeaderRetract(on) {
  retract.zone = !!on;
  applyRetract();
}

export function initHeaderRetract() {
  retract.lastY = Math.max(0, window.scrollY);
  let ticking = false;
  const read = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY);
    const dy = y - retract.lastY;
    retract.lastY = y;
    if (!dy) return;
    retract.travel = (dy > 0) === (retract.travel >= 0) ? retract.travel + dy : dy;
    if (retract.travel >= RETRACT_TRAVEL) retract.down = true;
    else if (retract.travel <= -RETRACT_TRAVEL) retract.down = false;
    applyRetract();
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(read);
  }, { passive: true });
  document.addEventListener('focusin', applyRetract);
}
