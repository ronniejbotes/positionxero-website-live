/* Position Xero: /get-started-thanks, step 3 of the sign-up flow (19 November 2026).
   The form sends people here as ?package=minimum|standard|growth|full-house&billing=monthly|yearly
   (get-started.js sets FormSubmit's _next). With both, this shows one button to
   the matching Paystack page and folds the list away. Without JS, or with
   anything else in the URL, the full list of eight Paystack links stays as it is.
   Bump ?v= on public/get-started-thanks.html when this file changes. */
(function () {
  var box = document.querySelector('[data-pay]');
  if (!box) return;

  var NAMES = { 'minimum': 'Minimum', 'standard': 'Standard', 'growth': 'Growth', 'full-house': 'Full House' };
  var list = box.querySelector('[data-pay-list]');
  var pick = box.querySelector('[data-pay-pick]');
  var one = box.querySelector('[data-pay-one]');
  var button = box.querySelector('[data-pay-button]');
  var chosen = box.querySelector('[data-pay-chosen]');
  var other = box.querySelector('[data-pay-other]');
  var showAll = box.querySelector('[data-pay-show-all]');

  /* GA4: one event per tap on any Paystack link, guarded like the lead events in home.js */
  box.addEventListener('click', function (event) {
    var link = event.target.closest ? event.target.closest('a[href^="https://paystack."]') : null;
    if (!link || typeof gtag !== 'function') return;
    gtag('event', 'begin_checkout', {
      package: link.getAttribute('data-pay-package') || '',
      billing: link.getAttribute('data-pay-billing') || '',
      location: link === button ? 'get_started_thanks_button' : 'get_started_thanks_list'
    });
  });

  var params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
  var pkg = (params.get('package') || '').toLowerCase();
  var billing = (params.get('billing') || '').toLowerCase();
  if (!NAMES[pkg] || (billing !== 'monthly' && billing !== 'yearly') || !list || !one || !button) return;

  var match = list.querySelector('a[data-pay-package="' + pkg + '"][data-pay-billing="' + billing + '"]');
  if (!match) return;

  button.href = match.href;
  button.setAttribute('data-pay-package', pkg);
  button.setAttribute('data-pay-billing', billing);
  if (chosen) {
    chosen.textContent = 'Your package: ' + NAMES[pkg] + ', paid ' + billing + '.';
    chosen.hidden = false;
  }
  one.hidden = false;
  list.hidden = true;
  if (pick) pick.hidden = true;
  if (other) other.hidden = false;

  if (showAll) {
    showAll.addEventListener('click', function () {
      list.hidden = false;
      if (pick) pick.hidden = false;
      if (other) other.hidden = true;
      var first = list.querySelector('a');
      if (first) first.focus();
    });
  }
})();
