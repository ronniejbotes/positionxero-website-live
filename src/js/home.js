import '../styles/home.css';



/**
 * The front pages (/, /packages, /work), direction C, 12 November 2026.
 * Everything here is optional: the pages read and work without it.
 *   - GA4 lead events on every WhatsApp and phone link (unchanged)
 *   - the monthly / yearly switch
 *   - the package shop: flip through the four packages, choose one
 *   - the work showreel and the screen recordings (play only in view)
 *   - the homepage hero: code typing out into an example site
 *   - the phone menu, and blocks easing in as they arrive
 */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

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

/* ---------- numbers that roll when they change ---------- */
function roll(el, text) {
  // text is always our own markup (a price, or a number with a <small> unit)
  if (el.innerHTML === text) return;
  if (reduced.matches || !el.animate) { el.innerHTML = text; return; }
  const down = el.dataset.dir === 'down';
  el.animate(
    [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${down ? '' : '-'}40%)`, opacity: 0 }],
    { duration: 160, easing: 'cubic-bezier(.4,0,1,1)' }
  ).onfinish = () => {
    el.innerHTML = text;
    el.animate(
      [{ transform: `translateY(${down ? '-' : ''}40%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }],
      { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' }
    );
  };
}

/* ---------- billing switch ---------- */
const toggles = document.querySelectorAll('[data-billing-toggle]');
function setBilling(mode) {
  toggles.forEach((t) => t.querySelectorAll('[data-billing]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.billing === mode));
  }));
  document.querySelectorAll('.shop [data-monthly]').forEach((el) => {
    const text = el.dataset[mode];
    if (el.classList.contains('pk__amount')) {
      el.dataset.dir = mode === 'yearly' ? 'up' : 'down';
      roll(el, text);
    } else {
      el.textContent = text;
    }
  });
  document.querySelectorAll('.shop a[data-wa-monthly]').forEach((a) => {
    a.href = mode === 'yearly' ? a.dataset.waYearly : a.dataset.waMonthly;
  });
}
toggles.forEach((t) => t.addEventListener('click', (event) => {
  const b = event.target.closest('[data-billing]');
  if (b) setBilling(b.dataset.billing);
}));

/* ---------- the package shop ----------
   A rail of four "products" and one stage. Without the script every
   package is shown, one under the other. With it, one shows at a time:
   the rail, the arrows, a swipe or the arrow keys flip between them,
   and the specs roll from one package's numbers to the next. */
document.querySelectorAll('.shop').forEach((shop) => {
  const tabs = [...shop.querySelectorAll('.rail__btn')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  if (!tabs.length || panels.some((p) => !p)) return;
  const dots = [...shop.querySelectorAll('.shop__dots i')];
  const stage = shop.querySelector('.shop__stage');
  // the illustration of "your result" grows with the package: tier 1 to 4
  const grow = shop.querySelector('.grow');
  let current = Math.max(0, tabs.findIndex((t) => t.dataset.default === 'true'));

  const specValues = (panel) => [...panel.querySelectorAll('.spec__num span')].map((s) => s.innerHTML);

  function show(index, { focus = false } = {}) {
    index = (index + tabs.length) % tabs.length;
    const prev = current;
    const dir = index >= prev ? 1 : -1;
    // the incoming panel keeps the outgoing one's spec numbers for a moment,
    // then rolls them to its own, so the difference between packages shows
    const before = specValues(panels[prev]);
    tabs.forEach((t, i) => {
      const on = i === index;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[i].classList.toggle('is-active', on);
      panels[i].inert = !on;
      panels[i].style.setProperty('--from', `${(i < index ? -1 : 1) * 40}px`);
    });
    dots.forEach((d, i) => d.classList.toggle('is-on', i === index));
    if (grow) grow.dataset.tier = String(index + 1);
    current = index;
    if (index !== prev && !reduced.matches) {
      const spans = [...panels[index].querySelectorAll('.spec__num span')];
      const after = spans.map((s) => s.innerHTML);
      spans.forEach((s, i) => {
        if (before[i] === undefined || before[i] === after[i]) return;
        s.innerHTML = before[i];
        s.dataset.dir = dir > 0 ? 'up' : 'down';
        setTimeout(() => roll(s, after[i]), 120 + i * 70);
      });
    }
    if (focus) tabs[index].focus();
  }

  // One shared element: choosing a package glides the chosen card from its
  // old place to the new one (motion.css names it for a view transition).
  // A swipe keeps its own drag (motion.js), so it switches as before; so do
  // browsers without view transitions, and reduced motion.
  const rec = shop.querySelector('.rail__rec');
  let vtId = 0;
  const name = (on) => {
    tabs.forEach((t) => { t.style.viewTransitionName = ''; });
    if (rec) rec.style.viewTransitionName = on ? 'pk-rec' : '';
    if (on) tabs[current].style.viewTransitionName = 'pk-pick';
  };
  function go(index, opts) {
    const next = (index + tabs.length) % tabs.length;
    if (next === current || reduced.matches || !document.startViewTransition) { show(next, opts); return; }
    const id = ++vtId;
    name(true);
    const vt = document.startViewTransition(() => { show(next, opts); name(true); });
    vt.finished.finally(() => { if (id === vtId) name(false); });
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => go(i));
    t.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (e.key in keys) { e.preventDefault(); go(current + keys[e.key], { focus: true }); }
      if (e.key === 'Home') { e.preventDefault(); go(0, { focus: true }); }
      if (e.key === 'End') { e.preventDefault(); go(tabs.length - 1, { focus: true }); }
    });
  });
  shop.querySelector('.arrow-btn--prev')?.addEventListener('click', () => go(current - 1));
  shop.querySelector('.arrow-btn--next')?.addEventListener('click', () => go(current + 1));

  // swipe on the stage (touch and pen; a mouse drag selects text as usual)
  let sx = 0, sy = 0, tracking = false;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    tracking = true; sx = e.clientX; sy = e.clientY;
  });
  stage.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) show(current + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { tracking = false; });

  // a link straight to one package (/packages#plans-growth) opens it
  const hashIndex = panels.findIndex((p) => location.hash === `#${p.id}`);
  if (hashIndex >= 0) current = hashIndex;

  shop.classList.add('is-ready');
  show(current);
});

/* ---------- "What's in it": open on wider screens, closed on phones ---------- */
if (window.matchMedia('(max-width: 639px)').matches) {
  document.querySelectorAll('.pk__side[open]').forEach((d) => { d.open = false; });
}

/* ---------- screen recordings: play only while on screen ----------
   Every <video data-inview> is muted, inline and preload="none". It plays
   while at least a third of it is on screen and the visitor has not paused
   it, and stops the moment it leaves. Reduced motion: posters only. */
const stagePaused = new WeakSet();
const videoIO = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const v = entry.target;
    v._inView = entry.isIntersecting;
    syncVideo(v);
  });
}, { threshold: 0.33 }) : null;

function syncVideo(v) {
  const stage = v.closest('.stage');
  const blocked = reduced.matches || (stage && stagePaused.has(stage)) || document.hidden;
  if (v._inView && !blocked) {
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  } else if (!v.paused) {
    v.pause();
  }
}
function watchVideos(root = document) {
  root.querySelectorAll('video[data-inview]').forEach((v) => {
    if (v._watched) return;
    v._watched = true;
    if (videoIO) videoIO.observe(v);
  });
}
watchVideos();
document.addEventListener('visibilitychange', () => {
  document.querySelectorAll('video[data-inview]').forEach(syncVideo);
});
document.querySelectorAll('.stage__pause').forEach((btn) => {
  const stage = btn.closest('.stage');
  if (reduced.matches) { btn.hidden = true; return; }
  btn.addEventListener('click', () => {
    const paused = !stagePaused.has(stage);
    if (paused) stagePaused.add(stage); else stagePaused.delete(stage);
    btn.setAttribute('aria-pressed', String(paused));
    btn.setAttribute('aria-label', paused ? 'Play the recordings' : 'Pause the recordings');
    stage.querySelectorAll('video').forEach(syncVideo);
  });
});

/* ---------- the homepage showreel: one site at a time ---------- */
document.querySelectorAll('[data-reel]').forEach((reel) => {
  const tabs = [...reel.querySelectorAll('.reel__tab')];
  const stage = reel.querySelector('.stage');
  const desk = stage.querySelector('.device--desk .device__screen');
  const phone = stage.querySelector('.device--phone .device__screen');
  const url = stage.querySelector('.device__url');
  const name = reel.querySelector('.reel__name');
  const text = reel.querySelector('.reel__text');
  const open = reel.querySelector('.reel__open');
  let current = 0;
  let timer = 0;

  function media(slot, src, poster, alt) {
    // a recording when we have one, otherwise the still
    if (src && src.mp4) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'none';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.dataset.inview = '';
      if (poster) v.poster = poster;
      v.setAttribute('aria-label', alt);
      if (src.webm) { const s = document.createElement('source'); s.src = src.webm; s.type = 'video/webm'; v.append(s); }
      const s2 = document.createElement('source'); s2.src = src.mp4; s2.type = 'video/mp4'; v.append(s2);
      return v;
    }
    const img = document.createElement('img');
    img.src = poster; img.alt = alt; img.decoding = 'async';
    return img;
  }

  function select(i, { auto = false } = {}) {
    i = (i + tabs.length) % tabs.length;
    const t = tabs[i];
    tabs.forEach((x, k) => {
      x.setAttribute('aria-selected', String(k === i));
      x.tabIndex = k === i ? 0 : -1;
      x.style.setProperty('--p', 0);
    });
    current = i;
    const d = t.dataset;
    const swap = () => {
      desk.replaceChildren(media(desk, d.deskMp4 ? { mp4: d.deskMp4, webm: d.deskWebm } : null, d.deskPoster, `${d.name} website on a desktop screen, built by Position Xero`));
      phone.replaceChildren(media(phone, d.phoneMp4 ? { mp4: d.phoneMp4, webm: d.phoneWebm } : null, d.phonePoster, `${d.name} website on a phone, built by Position Xero`));
      url.textContent = d.host;
      name.textContent = d.name;
      text.textContent = d.text;
      open.href = d.href;
      open.querySelector('.visually-hidden').textContent = ` (${d.name})`;
      watchVideos(stage);
      const v = desk.querySelector('video');
      clearTimeout(timer);
      if (v) {
        v.addEventListener('timeupdate', () => {
          if (v.duration) t.style.setProperty('--p', (v.currentTime / v.duration).toFixed(3));
        });
        v.addEventListener('ended', () => select(current + 1, { auto: true }));
      } else if (!reduced.matches) {
        timer = setTimeout(() => { if (!stagePaused.has(stage)) select(current + 1, { auto: true }); }, 7000);
      }
      stage.classList.remove('is-swapping');
    };
    if (reduced.matches) { swap(); return; }
    stage.classList.add('is-swapping');
    setTimeout(swap, auto ? 380 : 260);
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); select(current + 1); tabs[current].focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); select(current - 1); tabs[current].focus(); }
    });
  });
  // the first site's media is already in the HTML; hook it up
  const first = desk.querySelector('video');
  if (first) {
    first.addEventListener('timeupdate', () => { if (first.duration) tabs[0].style.setProperty('--p', (first.currentTime / first.duration).toFixed(3)); });
    first.addEventListener('ended', () => select(1, { auto: true }));
  }
});

/* ---------- homepage hero: five lines of code type out and become a site ----------
   Only with html.anim (set in the head for visitors who have not asked for
   less motion); without it every part of the hero is in its finished state.
   Each line types at one character every 15 ms, and the matching part of
   the example site appears the moment its line ends. It starts once the
   monospace font is in, so every line is measured in the right width, and
   never waits longer than 1.2 s. */
const root = document.documentElement;
if (root.classList.contains('anim') && document.querySelector('.editor')) {
  const cps = 15, gap = 70;
  let t = 150;
  const ends = [];
  document.querySelectorAll('.editor .ln').forEach((ln) => {
    const n = ln.querySelector('.t').textContent.length;
    ln.style.setProperty('--n', n);
    ln.style.setProperty('--d', t + 'ms');
    t += n * cps;
    ends.push(t);
    t += gap;
  });
  const slots = document.querySelectorAll('.site .slot');
  slots.forEach((slot, i) => { if (ends[i] != null) slot.style.setProperty('--r', ends[i] + 'ms'); });
  const last = ends[ends.length - 1];
  if (slots.length) slots[slots.length - 1].style.setProperty('--r2', last + 'ms');
  const live = document.querySelector('.site__live');
  if (live) live.style.setProperty('--r', (last + 80) + 'ms');
  // the site settles once its last part is in (motion.css)
  const site = document.querySelector('.hero .site');
  if (site) site.style.setProperty('--settle', (last + 140) + 'ms');
  let started = false;
  const start = () => { if (started) return; started = true; requestAnimationFrame(() => root.classList.add('play')); };
  if (document.fonts && document.fonts.load) document.fonts.load('400 12px "Martian Mono"').then(start, start);
  else start();
  setTimeout(start, 1200);
}

/* ---------- header: the wordmark and the buttons never touch ----------
   At any width and any text size: if they would, the WhatsApp label goes
   first (the icon stays), then the wordmark (the X stays). */
const bar = document.querySelector('.site-header__bar');
if (bar) {
  const logo = bar.querySelector('.logo');
  const actions = bar.querySelector('.site-header__actions');
  const nav = bar.querySelector('.nav');
  const word = logo.querySelector('.logo__word');
  const clash = () => {
    // the wordmark text itself, not its box (the text can overflow the box)
    const wr = word && word.offsetParent ? word.getBoundingClientRect().right : 0;
    const l = Math.max(logo.getBoundingClientRect().right, wr);
    const right = (nav && nav.offsetParent ? nav : actions).getBoundingClientRect().left;
    const spill = actions.getBoundingClientRect().right > bar.getBoundingClientRect().right - parseFloat(getComputedStyle(bar).paddingRight) + 1;
    return l + 12 > right || spill;
  };
  const fit = () => {
    bar.classList.remove('is-tight', 'is-tighter');
    if (clash()) bar.classList.add('is-tight');
    if (clash()) bar.classList.add('is-tighter');
  };
  fit();
  window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
}

/* ---------- one main action per view ----------
   The header's WhatsApp button stays an outline while another action
   button (hero, package, closing call) is on screen, and takes the action
   colour when none is (home.css). A package panel that is not showing
   does not count; the "Looking for something more?" button is an outline
   itself, so it does not count either. */
const headGo = document.querySelector('.site-header .btn--go');
if (headGo) {
  const others = [...document.querySelectorAll('main .btn--go')].filter((b) => !b.closest('.more'));
  if (!others.length || !('IntersectionObserver' in window)) {
    headGo.classList.add('is-loud');
  } else {
    const seen = new Set();
    const sync = () => {
      const any = [...seen].some((b) => !b.closest('.pk:not(.is-active)'));
      headGo.classList.toggle('is-loud', !any);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
      sync();
    }, { rootMargin: '-80px 0px 0px 0px' });
    others.forEach((b) => io.observe(b));
    document.querySelectorAll('.shop__panels').forEach((p) => {
      new MutationObserver(sync).observe(p, { attributes: true, subtree: true, attributeFilter: ['class'] });
    });
  }
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
   so a page whose script fails, a visitor without JavaScript and a crawler
   that does not run it all see every word. Renderers with a very tall
   viewport (how search engines and full-page capture tools lay a page out)
   get no reveal at all, and printing shows everything. */
const revealAll = () => document.querySelectorAll('.rv').forEach((el) => el.classList.add('is-in'));
window.addEventListener('beforeprint', revealAll);
if ('IntersectionObserver' in window && !reduced.matches && window.innerHeight < 1600) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.rv').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
    else io.observe(el);
  });
  document.documentElement.classList.add('rv-on');
}
