/* Position Xero light/dark switch (12 November 2026), the pattern from
   Otaku TCG (otaku-tcg-theme: assets/otcg-theme-mode.js).
   The inline head script (snippets/theme-head.html) sets <html data-theme>
   before CSS paints. This file wires up every [data-theme-toggle] button
   and remembers the choice in localStorage ("px-theme"), wrapped in
   try/catch for private windows. Dark is the default (the owner's pick).
   Load it on every page: <script src="/js/theme.js?v=..." defer></script>.
   Bump ?v= on every page when this file changes. */
(function () {
  var KEY = 'px-theme';
  var root = document.documentElement;

  function store(mode) {
    try { window.localStorage.setItem(KEY, mode); } catch (e) { /* the choice still applies to this page */ }
  }

  function current() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function sync(mode) {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
      var state = buttons[i].querySelector('[data-theme-toggle-state]');
      if (state) state.textContent = mode === 'dark' ? state.getAttribute('data-on') : state.getAttribute('data-off');
    }
  }

  function apply(mode) {
    root.setAttribute('data-theme', mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && meta.getAttribute('data-' + mode)) meta.setAttribute('content', meta.getAttribute('data-' + mode));
    sync(mode);
    document.dispatchEvent(new CustomEvent('px:theme-change', { detail: { mode: mode } }));
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
    if (!button) return;
    event.preventDefault();
    var next = current() === 'dark' ? 'light' : 'dark';
    store(next);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) root.classList.add('theme-switching');
    apply(next);
    window.setTimeout(function () { root.classList.remove('theme-switching'); }, 350);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { sync(current()); });
  else sync(current());
})();
