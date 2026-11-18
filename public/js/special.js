/* The special on the package prices (owner, 18 November 2026).
   The HTML says "Black Friday special" and "Ends 30 November.", which stay
   true to 30 November. By South African time (UTC+2 all year, so each change
   is at 22:00 UTC the evening before) every [data-special-label] and the
   end date in every [data-special-end] line (its text and its
   data-monthly / data-yearly copies, which the /packages toggle reads) become:
     1 to 31 December 2026   "Christmas special", "Ends 31 December."
     1 to 31 January 2027    "Janu-worry special", "Ends 31 January." (owner's wording)
   Owner, 18 Nov: the page never says the specials run to February; each
   month's special really does end on its stated date.
   T-91, 1 February 2027: the specials end and new sign-ups pay the higher
   prices. Remove this file, its <script> tags (index.html, packages.html,
   the cost calculator), every [data-special-label], [data-special-end]
   line and struck price, and their CSS. */
(function () {
  var now = Date.now();
  var label, end;
  if (now >= Date.UTC(2026, 11, 31, 22, 0, 0)) { label = 'Janu-worry special'; end = '31 January'; }
  else if (now >= Date.UTC(2026, 10, 30, 22, 0, 0)) { label = 'Christmas special'; end = '31 December'; }
  else return;
  var i, els = document.querySelectorAll('[data-special-label]');
  for (i = 0; i < els.length; i++) els[i].textContent = label;
  var lines = document.querySelectorAll('[data-special-end]'), attrs = ['data-monthly', 'data-yearly'];
  for (i = 0; i < lines.length; i++) {
    var el = lines[i];
    el.textContent = el.textContent.replace('30 November', end);
    for (var a = 0; a < attrs.length; a++) {
      var v = el.getAttribute(attrs[a]);
      if (v) el.setAttribute(attrs[a], v.replace('30 November', end));
    }
  }
})();
