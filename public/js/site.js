/* Position Xero: every static page in public/ (12 November 2026).
   Everything here is optional: the pages read and work without it.
   - GA4 lead events on every WhatsApp and phone link (the same code and
     data attributes as src/js/home.js on the front pages)
   - the header: the wordmark and the buttons never touch
   - the phone menu
   - the email address, written out only in the browser
   Bump ?v= on every page's <script> when this file changes. */
(function () {
  /* ---------- GA4: one event per WhatsApp or phone tap ----------
     GA4 itself is added at build time by vite.config.js. Each link carries
     its package and location. The "Looking for something more?" button
     also sends its own event (data-lead-event). */
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href*="wa.me/"], a[href^="tel:"]');
    if (!link || typeof gtag !== 'function') return;
    var section = link.closest('section[id]');
    var location = link.dataset.leadLocation || (section ? section.id : 'page');
    gtag('event', 'generate_lead', {
      method: link.href.indexOf('tel:') === 0 ? 'phone' : 'whatsapp',
      package: link.dataset.leadPackage || 'none',
      location: location
    });
    if (link.dataset.leadEvent) gtag('event', link.dataset.leadEvent, { location: location });
  });

  /* ---------- header: if the wordmark and the buttons would touch, the
     WhatsApp label goes first (the icon stays), then the wordmark ---------- */
  var bar = document.querySelector('.site-header__bar');
  if (bar) {
    var logo = bar.querySelector('.logo');
    var actions = bar.querySelector('.site-header__actions');
    var nav = bar.querySelector('.nav');
    var word = logo.querySelector('.logo__word');
    var clash = function () {
      var wr = word && word.offsetParent ? word.getBoundingClientRect().right : 0;
      var l = Math.max(logo.getBoundingClientRect().right, wr);
      var right = (nav && nav.offsetParent ? nav : actions).getBoundingClientRect().left;
      var spill = actions.getBoundingClientRect().right > bar.getBoundingClientRect().right - parseFloat(getComputedStyle(bar).paddingRight) + 1;
      return l + 12 > right || spill;
    };
    var fit = function () {
      bar.classList.remove('is-tight', 'is-tighter');
      if (clash()) bar.classList.add('is-tight');
      if (clash()) bar.classList.add('is-tighter');
    };
    fit();
    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  /* ---------- phone menu ---------- */
  var menu = document.querySelector('.menu');
  if (menu) {
    menu.addEventListener('click', function (event) {
      if (event.target.closest('.menu__panel a')) menu.open = false;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  }

  /* ---------- email: kept out of the HTML so scrapers do not collect it ---------- */
  document.querySelectorAll('[data-em-u]').forEach(function (a) {
    var addr = a.getAttribute('data-em-u') + '@' + a.getAttribute('data-em-d');
    a.setAttribute('href', 'mailto:' + addr);
    a.textContent = addr;
  });
})();
