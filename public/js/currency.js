/* ZAR | USD package prices (owner, 22 November 2026: "Have it be like a
   toggleable thing where people can choose either US or ZAR, and the USD
   prices must be the rand prices divided by 10").

   The rand price in the HTML is the only source. Every element marked
   [data-price] holds one of our package prices in rand; in USD mode each
   "R1,299" in it becomes "$129.90" (rand / 10, two decimals), and back.
   The conversion is exact both ways (whole rands, so cents are always a
   multiple of ten), so it never needs to remember the old text: when
   special.js or the /packages monthly/yearly switch rewrites a price, this
   file converts the new text too. On 1 February 2027 (T-91) the new rand
   prices in the HTML change the dollar prices with them.

   The default currency is chosen before the first paint by the inline
   script in each page's <head> (snippets/currency-head.html), which sets
   html.px-cur plus html.px-usd or html.px-zar. A visitor's own choice is
   kept in localStorage ("px-currency") and wins over detection.
   Without JavaScript the page shows rand and no switch, as before.

   WhatsApp links: the price in a wa.me message follows the currency shown,
   so a visitor who saw $49.90 sends "$49.90 a month", not R499. */
(function () {
  'use strict';
  var KEY = 'px-currency';
  var root = document.documentElement;
  var RAND = /(^|[^A-Za-z0-9])R(\d[\d,]*\d|\d)(?!\d)/g;
  var USD = /\$(\d{1,3}(?:,\d{3})*|\d+)\.(\d\d)(?!\d)/g;

  function current() { return root.classList.contains('px-usd') ? 'usd' : 'zar'; }
  function group(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  // R499 -> $49.90 (whole cents: rand x 10)
  function randToUsd(rand) {
    var cents = rand * 10;
    return '$' + group(Math.floor(cents / 100)) + '.' + ('0' + (cents % 100)).slice(-2);
  }
  // $49.90 -> R499; anything that is not a whole rand stays as it is
  function usdToRand(dollars, cents) {
    var total = dollars * 100 + cents;
    return total % 10 ? null : 'R' + group(total / 10);
  }

  function text(s, cur) {
    if (!s) return s;
    if ((cur || current()) === 'usd') {
      return s.replace(RAND, function (m, pre, n) { return pre + randToUsd(parseInt(n.replace(/,/g, ''), 10)); });
    }
    return s.replace(USD, function (m, d, c) {
      var r = usdToRand(parseInt(d.replace(/,/g, ''), 10), parseInt(c, 10));
      return r === null ? m : r;
    });
  }

  // wa.me/...?text=...: convert the price in the message, keep the encoding
  // the HTML uses (every character but letters, digits and -_.~ escaped)
  function enc(s) {
    return encodeURIComponent(s).replace(/[!'()*]/g, function (ch) {
      return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
    });
  }
  function wa(href, cur) {
    if (!href || href.indexOf('wa.me/') < 0) return href;
    var i = href.indexOf('text=');
    if (i < 0) return href;
    var j = href.indexOf('&', i);
    var raw = j < 0 ? href.slice(i + 5) : href.slice(i + 5, j);
    var msg;
    try { msg = decodeURIComponent(raw); } catch (e) { return href; }
    var out = text(msg, cur);
    if (out === msg) return href;
    return href.slice(0, i + 5) + enc(out) + (j < 0 ? '' : href.slice(j));
  }

  function convert(el, cur) {
    var walker = document.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */, null, false);
    var node, next;
    while ((node = walker.nextNode())) {
      next = text(node.nodeValue, cur);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  }

  var observer = window.MutationObserver ? new MutationObserver(function (records) {
    var cur = current(), done = [];
    for (var i = 0; i < records.length; i++) {
      var t = records[i].target;
      var el = t.nodeType === 1 ? t : t.parentNode;
      el = el && el.closest ? el.closest('[data-price]') : null;
      if (el && done.indexOf(el) < 0) { done.push(el); convert(el, cur); }
    }
  }) : null;

  var watched = [];
  function apply(cur) {
    root.classList.toggle('px-usd', cur === 'usd');
    root.classList.toggle('px-zar', cur !== 'usd');
    var i, els = document.querySelectorAll('[data-price]');
    for (i = 0; i < els.length; i++) {
      convert(els[i], cur);
      if (observer && watched.indexOf(els[i]) < 0) {
        watched.push(els[i]);
        observer.observe(els[i], { childList: true, characterData: true, subtree: true });
      }
    }
    var links = document.querySelectorAll('a[href*="wa.me/"]');
    for (i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href'), n = wa(h, cur);
      if (n !== h) links[i].setAttribute('href', n);
    }
    var opts = document.querySelectorAll('[data-cur-toggle] [data-cur]');
    for (i = 0; i < opts.length; i++) opts[i].setAttribute('aria-pressed', String(opts[i].getAttribute('data-cur') === cur));
    root.classList.add('px-cur-on');
  }

  function set(cur, remember) {
    cur = cur === 'usd' ? 'usd' : 'zar';
    if (remember) { try { localStorage.setItem(KEY, cur); } catch (e) {} }
    apply(cur);
  }

  document.addEventListener('click', function (event) {
    var t = event.target;
    var opt = t.closest && t.closest('[data-cur-toggle] [data-cur]');
    if (opt) { set(opt.getAttribute('data-cur'), true); return; }
    // the /packages monthly/yearly switch rewrites WhatsApp links: make sure
    // the one being followed carries the price in the currency on screen
    var link = t.closest && t.closest('a[href*="wa.me/"]');
    if (link) {
      var h = link.getAttribute('href'), n = wa(h, current());
      if (n !== h) link.setAttribute('href', n);
    }
  }, true);

  // left / right arrows move between the two options, like a radio group
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    var opt = event.target.closest && event.target.closest('[data-cur-toggle] [data-cur]');
    if (!opt) return;
    var all = opt.parentNode.querySelectorAll('[data-cur]');
    var k = Array.prototype.indexOf.call(all, opt);
    var other = all[(k + (event.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
    if (!other) return;
    event.preventDefault();
    other.focus();
    set(other.getAttribute('data-cur'), true);
  });

  // a choice made in another tab follows here
  window.addEventListener('storage', function (event) {
    if (event.key === KEY && (event.newValue === 'usd' || event.newValue === 'zar')) apply(event.newValue);
  });

  window.pxCurrency = { get: current, set: set, text: text, wa: wa };
  if (!root.classList.contains('px-cur')) root.classList.add('px-cur', 'px-zar');
  apply(current());
})();
