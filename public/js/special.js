/* The special label on the package prices (owner, 18 November 2026).
   The HTML says "Black Friday special", which stays true to 30 November.
   Every [data-special-label] then reads, by South African time (UTC+2 all
   year, so each change is at 22:00 UTC the evening before):
     1 to 31 December 2026   "Christmas special"
     1 to 31 January 2027    "Janu-worry special" (owner's wording)
   Date.UTC keeps it on SA time whatever the visitor's clock zone.
   T-91, 1 February 2027: the specials end and new sign-ups pay the higher
   prices. Remove this file, its <script> tags (index.html, packages.html,
   the cost calculator) and every [data-special-label], struck price and
   "from 1 February" line with it. */
(function () {
  var now = Date.now();
  var label = now >= Date.UTC(2026, 11, 31, 22, 0, 0) ? 'Janu-worry special'
    : now >= Date.UTC(2026, 10, 30, 22, 0, 0) ? 'Christmas special'
    : '';
  if (!label) return;
  var els = document.querySelectorAll('[data-special-label]');
  for (var i = 0; i < els.length; i++) els[i].textContent = label;
})();
