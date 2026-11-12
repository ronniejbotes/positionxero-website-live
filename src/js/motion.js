import '../styles/motion.css';

/**
 * Motion for the front pages (/, /work, /packages), 12 November 2026.
 * The owner asked for the site to feel alive the way Vital Socks and
 * Otaku TCG do. One idea per section:
 *   - hero: the code builds the site, then the same page as a search result
 *     (timed off home.js's typing), and on desktop the layers part a little
 *     with the mouse
 *   - the tape: a moving band, faster while you scroll, paused off screen
 *   - Sites we've built: a carousel of the real recordings
 *   - How it works: pinned on big screens, the steps advance as you scroll
 *   - promises: "7 days" and "12 months" rise into place once (CSS only)
 *   - packages: drag the package on a phone; the result illustration adds
 *     its parts one after another
 *   - /work: the smaller cards play their recording on hover
 *
 * Every word is in the HTML and readable without this file. It only adds
 * classes, custom properties and transform/opacity changes; reduced motion
 * gets no autoplay, no tape, no pinning and no counting.
 */

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const motionOK = () => !reduced.matches;
// search engines and full-page capture tools use a very tall viewport: no hiding, no counting
const tallRenderer = window.innerHeight >= 1600;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- one passive scroll listener, one frame, many readers ---------- */
const frameFns = new Set();
let queued = false;
let lastY = window.scrollY;
function frame() {
  queued = false;
  const y = window.scrollY;
  const v = y - lastY;
  lastY = y;
  frameFns.forEach((fn) => fn(y, v));
}
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
window.addEventListener('scroll', queue, { passive: true });

/* ============================================================
   HERO
   ============================================================ */
function hero() {
  const snip = document.querySelector('.snip');
  if (snip && root.classList.contains('anim')) {
    // the search result arrives just after the site goes live; home.js
    // sets that moment on .site__live as --r once it has measured the code
    const time = () => {
      const live = document.querySelector('.site__live');
      const r = live ? parseFloat(live.style.getPropertyValue('--r')) : NaN;
      if (Number.isFinite(r)) snip.style.setProperty('--r3', `${r + 380}ms`);
      return Number.isFinite(r);
    };
    if (!time()) {
      const mo = new MutationObserver(() => { if (time()) mo.disconnect(); });
      mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // the hero's light (motion.css) drifts only while the hero is on screen
  const heroEl = document.querySelector('.hero');
  if (heroEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => heroEl.classList.toggle('is-off', !entry.isIntersecting)).observe(heroEl);
  }

  // desktop with a mouse: the code, the site and the result part a few pixels
  const build = heroEl && heroEl.querySelector('.build');
  if (!build || !motionOK()) return;
  let raf = 0;
  let px = 0;
  let py = 0;
  heroEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || window.innerWidth < 1100) return;
    const b = heroEl.getBoundingClientRect();
    px = clamp(((e.clientX - b.left) / b.width) * 2 - 1, -1, 1);
    py = clamp(((e.clientY - b.top) / b.height) * 2 - 1, -1, 1);
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        build.style.setProperty('--px', px.toFixed(3));
        build.style.setProperty('--py', py.toFixed(3));
      });
    }
  });
  heroEl.addEventListener('pointerleave', () => {
    build.style.setProperty('--px', '0');
    build.style.setProperty('--py', '0');
  });
}

/* ============================================================
   THE TAPE
   CSS runs the loop. Here: a pause button, a pause while off screen,
   and (with motion) a little extra speed in the direction you scroll,
   easing back to its own pace, as on Vital Socks.
   ============================================================ */
function tapes() {
  document.querySelectorAll('[data-mq]').forEach((mq) => {
    const track = mq.querySelector('.mq__track');
    const btn = mq.querySelector('.mq__pause');
    mq.classList.add('is-ready');
    if (btn) {
      btn.addEventListener('click', () => {
        const paused = mq.classList.toggle('is-paused');
        btn.setAttribute('aria-pressed', String(paused));
        btn.setAttribute('aria-label', paused ? 'Play the moving band' : 'Pause the moving band');
      });
    }
    if (!motionOK() || !track || !track.getAnimations) return;
    let visible = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        mq.classList.toggle('is-off', !visible);
      }).observe(mq);
    }
    let rate = 1;
    let dir = 1;
    let boost = 0;
    let loop = 0;
    const setRate = (r) => {
      const a = track.getAnimations()[0];
      if (!a) return;
      if (a.updatePlaybackRate) a.updatePlaybackRate(r); else a.playbackRate = r;
    };
    // the boost fades away by itself; the rate follows it smoothly
    const tick = () => {
      loop = 0;
      boost = boost * 0.9 < 0.01 ? 0 : boost * 0.9;
      const want = dir * (1 + boost);
      rate += (want - rate) * 0.14;
      if (Math.abs(want - rate) < 0.01) rate = want;
      setRate(rate);
      if (boost > 0 || rate !== want) loop = requestAnimationFrame(tick);
    };
    frameFns.add((y, v) => {
      if (!visible || mq.classList.contains('is-paused') || !v) return;
      dir = v > 0 ? 1 : -1;
      boost = Math.max(boost, Math.min(3, Math.abs(v) / 14));
      if (!loop) loop = requestAnimationFrame(tick);
    });
  });
}

/* ============================================================
   REVEALS: groups come in one column after another
   (home.js reveals each .rv; this only sets the delay per column)
   ============================================================ */
function staggers() {
  const groups = [...document.querySelectorAll('[data-stagger]')];
  if (!groups.length) return;
  const set = () => groups.forEach((group) => {
    const items = [...group.children].filter((el) => el.classList.contains('rv'));
    if (!items.length) return;
    const top = items[0].offsetTop;
    const cols = Math.max(1, items.filter((el) => Math.abs(el.offsetTop - top) < 4).length);
    items.forEach((el, i) => el.style.setProperty('--rv-d', `${(i % cols) * 120}ms`));
  });
  set();
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(set, 200); });
}

/* ============================================================
   CAROUSEL: Sites we've built
   ============================================================ */
function carousel(car) {
  const track = car.querySelector('.car__track');
  const slides = [...track.children];
  if (slides.length < 2) return;
  const dots = [...car.querySelectorAll('.car__dot')];
  const prev = car.querySelector('.car__prev');
  const next = car.querySelector('.car__next');
  const pauseBtn = car.querySelector('.car__pause');
  const desk = slides.map((s) => s.querySelector('video[data-car-desk]'));
  let index = 0;
  let inView = false;
  let userPaused = false;
  let hovering = false;
  // once a visitor swipes, drags, taps an arrow or a dot, or uses the keys,
  // the carousel stays on the site they chose: its recording just repeats
  let steered = false;
  const steer = () => { steered = true; };

  car.classList.add('is-ready');

  const leftOf = (i) => slides[i].offsetLeft - slides[0].offsetLeft;
  // while a button-driven scroll runs, the sites it passes do not count
  let heading = -1;
  let headingTimer = 0;
  const go = (i, { smooth = true } = {}) => {
    i = (i + slides.length) % slides.length;
    heading = i;
    clearTimeout(headingTimer);
    headingTimer = setTimeout(() => { heading = -1; }, 900);
    track.scrollTo({ left: leftOf(i), behavior: smooth && motionOK() ? 'smooth' : 'auto' });
    setActive(i);
  };

  function sync() {
    slides.forEach((slide, i) => {
      const on = i === index && inView && !userPaused && motionOK() && !document.hidden;
      slide.querySelectorAll('video').forEach((v) => {
        if (on) {
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    });
  }

  function setActive(i) {
    if (i === index && slides[i].classList.contains('is-active')) return;
    index = i;
    slides.forEach((s, k) => {
      const on = k === i;
      s.classList.toggle('is-active', on);
      s.inert = !on;
      if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    dots.forEach((d, k) => {
      if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      d.style.setProperty('--p', '0');
    });
    // each recording starts from its beginning when its site comes to the front
    const v = desk[i];
    if (v && v.readyState > 0) v.currentTime = 0;
    sync();
  }

  // the site in front follows the scroll position (swipe, drag, arrows, keys)
  let settle = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(settle);
    settle = requestAnimationFrame(() => {
      const x = track.scrollLeft;
      let best = 0;
      slides.forEach((s, k) => { if (Math.abs(leftOf(k) - x) < Math.abs(leftOf(best) - x)) best = k; });
      if (heading >= 0) { if (best === heading) heading = -1; return; }
      if (best !== index) setActive(best);
    });
  }, { passive: true });

  prev.addEventListener('click', () => { steer(); go(index - 1); });
  next.addEventListener('click', () => { steer(); go(index + 1); });
  dots.forEach((d, k) => d.addEventListener('click', () => { steer(); go(k); }));
  car.addEventListener('keydown', (e) => {
    if (e.target.closest('a')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); steer(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); steer(); go(index - 1); }
  });
  track.addEventListener('pointerdown', steer);
  track.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) steer(); }, { passive: true });
  // a click on a site stepping back brings it to the front (those sites
  // are inert, so the click lands on the track itself)
  track.addEventListener('click', (e) => {
    if (e.target !== track) return;
    const k = slides.findIndex((s) => {
      const r = s.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right;
    });
    if (k >= 0 && k !== index) go(k);
  });

  // the dot of the site in front fills as its recording plays,
  // and the next site comes to the front when the recording ends
  desk.forEach((v, k) => {
    if (!v) return;
    v.addEventListener('timeupdate', () => {
      if (k === index && v.duration) dots[k].style.setProperty('--p', (v.currentTime / v.duration).toFixed(3));
    });
    v.addEventListener('ended', () => {
      if (k !== index) return;
      if (steered || hovering || userPaused || !inView) {
        v.currentTime = 0;
        sync();
      } else {
        go(index + 1);
      }
    });
  });

  if (pauseBtn) {
    if (!motionOK()) pauseBtn.hidden = true;
    pauseBtn.addEventListener('click', () => {
      userPaused = !userPaused;
      pauseBtn.setAttribute('aria-pressed', String(userPaused));
      pauseBtn.setAttribute('aria-label', userPaused ? 'Play the recordings' : 'Pause the recordings');
      sync();
    });
  }

  // while the mouse is over the carousel it stays on the same site
  car.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
  car.addEventListener('pointerleave', () => { hovering = false; });

  // drag with a mouse (touch and pens scroll natively)
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false, id: e.pointerId };
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      track.classList.add('is-drag');
      track.setPointerCapture(drag.id);
    }
    if (drag.moved) track.scrollLeft = drag.left - dx;
  });
  const endDrag = (e) => {
    if (!drag) return;
    const { moved, x } = drag;
    drag = null;
    if (!moved) return;
    const dx = e.clientX - x;
    // a short flick is enough to move on one site
    const target = Math.abs(dx) > 60 ? index + (dx < 0 ? 1 : -1) : index;
    track.classList.remove('is-drag');
    go(clamp(target, 0, slides.length - 1));
    // swallow the click that ends a drag, so it does not open a link
    const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
    track.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => track.removeEventListener('click', swallow, { capture: true }), 0);
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.35 }).observe(track);
  }
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('resize', () => track.scrollTo({ left: leftOf(index) }));

  slides[0].classList.remove('is-active');
  setActive(0);
}

/* ============================================================
   HOW IT WORKS: pinned on big screens (the layout is in motion.css,
   keyed on html.anim and the same media query). Here: which step is
   lit, and how far each step's rail has filled.
   ============================================================ */
function story() {
  const el = document.querySelector('[data-story]');
  const frameEl = el && el.querySelector('.story__frame');
  const list = el && el.querySelector('.journey');
  if (!frameEl || !list) return;
  const steps = list ? [...list.children] : [];
  const mq = window.matchMedia('(min-width: 1000px) and (min-height: 700px)');
  let on = false;
  let start = 0;
  let dist = 1;
  let current = -1;

  const measure = () => {
    on = mq.matches && motionOK() && root.classList.contains('anim') && steps.length === 3;
    if (!on) {
      delete list.dataset.step;
      steps.forEach((li) => li.style.removeProperty('--f'));
      current = -1;
      return;
    }
    const header = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 76;
    start = el.getBoundingClientRect().top + window.scrollY - header;
    dist = Math.max(1, el.offsetHeight - frameEl.offsetHeight);
    update(window.scrollY);
  };
  const update = (y) => {
    if (!on) return;
    // the last step gets a little longer to sit, then the page moves on
    const p = clamp((y - start) / dist, 0, 1) * 3.25;
    const step = Math.min(2, Math.floor(p));
    if (step !== current) {
      current = step;
      list.dataset.step = String(step + 1);
    }
    steps.forEach((li, i) => li.style.setProperty('--f', clamp(p - i, 0, 1).toFixed(3)));
  };
  frameFns.add(update);
  measure();
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(measure, 150); });
  window.addEventListener('load', measure);
  if (mq.addEventListener) mq.addEventListener('change', measure);
}

/* ============================================================
   PACKAGES: on a phone the package follows your finger a little
   before home.js flips to the next one; the result illustration's
   cards give a small nudge when the package changes
   ============================================================ */
function shops() {
  if (!motionOK()) return;
  document.querySelectorAll('.shop').forEach((shop) => {
    const stage = shop.querySelector('.shop__stage');
    if (!stage) return;
    let sx = 0;
    let sy = 0;
    let lock = null;
    let panel = null;
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      sx = e.clientX; sy = e.clientY; lock = null;
      panel = shop.querySelector('.pk.is-active');
    });
    stage.addEventListener('pointermove', (e) => {
      if (!panel) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (lock === null && Math.hypot(dx, dy) > 8) lock = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (lock) {
        panel.classList.add('is-drag');
        panel.style.translate = `${Math.round(dx * 0.4)}px 0`;
      }
    });
    const end = () => {
      if (!panel) return;
      const p = panel;
      panel = null;
      p.classList.remove('is-drag');
      // home.js has already chosen (its pointerup runs first): if this panel
      // is leaving, let it fade where it is; if it stays, it springs back
      if (p.classList.contains('is-active')) p.style.translate = '';
      else setTimeout(() => { p.style.translate = ''; }, 500);
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    const grow = shop.querySelector('.grow');
    if (grow && grow.animate) {
      new MutationObserver(() => {
        grow.querySelectorAll('.grow__card').forEach((card, i) => {
          if (!card.offsetParent) return;
          card.animate(
            [{ transform: 'none' }, { transform: 'translateY(-4px) scale(1.012)' }, { transform: 'none' }],
            { duration: 520, delay: i * 70, easing: 'cubic-bezier(.2,.7,.2,1)' }
          );
        });
      }).observe(grow, { attributes: true, attributeFilter: ['data-tier'] });
    }
  });
}

/* ============================================================
   /work: the smaller cards play on hover with a mouse, and while on
   screen on a phone (with the pause button, as before)
   ============================================================ */
function hoverStages() {
  document.querySelectorAll('[data-hover-stage]').forEach((stage) => {
    const card = stage.closest('.case') || stage;
    const vids = [...stage.querySelectorAll('video')];
    const btn = stage.querySelector('.stage__pause');
    let hover = false;
    let inView = false;
    const sync = () => {
      const paused = btn && btn.getAttribute('aria-pressed') === 'true';
      const want = motionOK() && !document.hidden && !paused && (finePointer.matches ? hover : inView);
      stage.classList.toggle('is-playing', want);
      vids.forEach((v) => {
        if (want) {
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    };
    card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = true; sync(); } });
    card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hover = false; sync(); } });
    card.addEventListener('focusin', () => { hover = true; sync(); });
    card.addEventListener('focusout', () => { hover = false; sync(); });
    // home.js toggles the pause button first; then this follows it
    if (btn) btn.addEventListener('click', sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.33 }).observe(stage);
    }
    document.addEventListener('visibilitychange', sync);
  });
}

hero();
tapes();
staggers();
document.querySelectorAll('[data-car]').forEach(carousel);
story();
shops();
hoverStages();
