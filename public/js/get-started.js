/* Position Xero: /get-started, the onboarding form (18 November 2026).
   Everything here is optional: without it every section shows, each package
   section carries its own label, and the form still posts to FormSubmit.
   - ?package=minimum|standard|growth|full-house picks the package
   - package sections show for the chosen package and up ([data-min-level])
   - small follow-up questions show only when they apply ([data-when],
     [data-when-not], "name=value|value")
   - anything hidden is disabled, so it never blocks the form or lands in the
     email as an empty row; empty optional fields are left out at send time
   - the mailbox count follows the package
   - FormSubmit takes 10 MB of files per submission, all inputs together:
     the total is shown and checked before sending
   - the email subject carries the business name and package
   Bump ?v= on public/get-started.html when this file changes. */
(function () {
  var form = document.getElementById('gsForm');
  if (!form) return;

  var LEVELS = { 'Minimum': 1, 'Standard': 2, 'Growth': 3, 'Full House': 4 };
  var SLUGS = { 'minimum': 'Minimum', 'standard': 'Standard', 'growth': 'Growth', 'full-house': 'Full House', 'fullhouse': 'Full House' };
  var MAILBOXES = { 'Minimum': 1, 'Standard': 2, 'Growth': 3, 'Full House': 5 };
  var FILE_LIMIT = 10 * 1000 * 1000; /* FormSubmit: 10MB for all files together; decimal, to stay under it */

  var subject = form.querySelector('input[name="_subject"]');
  var mailboxes = form.querySelector('[data-mailboxes]');
  var fileStatus = form.querySelector('[data-files-status]');
  var permission = form.querySelector('[data-permission]');
  var submit = form.querySelector('button[type="submit"]');
  var sending = form.querySelector('[data-sending]');
  var submitText = submit ? submit.textContent : '';

  function checked(name) {
    var out = [];
    var inputs = form.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < inputs.length; i++) if (inputs[i].checked) out.push(inputs[i].value);
    return out;
  }

  function pkg() { return checked('Package')[0] || ''; }

  function matches(rule) {
    var at = rule.indexOf('=');
    var values = rule.slice(at + 1).split('|');
    var picked = checked(rule.slice(0, at));
    for (var i = 0; i < picked.length; i++) if (values.indexOf(picked[i]) !== -1) return true;
    return false;
  }

  function setOn(el, on) {
    el.classList.toggle('is-on', on);
    el.hidden = !on;
  }

  /* ?package= preselects the package */
  try {
    var wanted = (new URLSearchParams(window.location.search).get('package') || '').toLowerCase().replace(/[\s_+]+/g, '-');
    var name = SLUGS[wanted];
    if (name && !pkg()) {
      var radio = form.querySelector('input[name="Package"][value="' + name + '"]');
      if (radio) radio.checked = true;
    }
  } catch (e) { /* no URLSearchParams: the visitor picks it */ }

  function update() {
    var level = LEVELS[pkg()] || 0;
    var i, els;

    els = form.querySelectorAll('[data-min-level]');
    for (i = 0; i < els.length; i++) setOn(els[i], level >= parseInt(els[i].getAttribute('data-min-level'), 10));
    els = form.querySelectorAll('[data-when]');
    for (i = 0; i < els.length; i++) setOn(els[i], matches(els[i].getAttribute('data-when')));
    els = form.querySelectorAll('[data-when-not]');
    for (i = 0; i < els.length; i++) setOn(els[i], !matches(els[i].getAttribute('data-when-not')));

    /* hidden means disabled: never required, never sent */
    var controls = form.querySelectorAll('input, textarea, select');
    for (i = 0; i < controls.length; i++) {
      var c = controls[i];
      if (c.type === 'hidden' || c.hasAttribute('data-gs-emptied')) continue;
      c.disabled = !!c.closest('[hidden]');
    }

    if (mailboxes) {
      var p = pkg();
      if (p) {
        var n = MAILBOXES[p];
        mailboxes.textContent = 'Your ' + p + ' package includes ' + n + (n === 1 ? ' mailbox' : ' mailboxes') + '.';
      } else {
        mailboxes.textContent = mailboxes.getAttribute('data-default');
      }
    }
    checkFiles();
  }

  function mb(bytes) {
    if (bytes < 100000) return Math.max(1, Math.round(bytes / 1000)) + ' KB';
    return (bytes / 1000000).toFixed(1).replace(/\.0$/, '') + ' MB';
  }

  var lastFile = null;
  function checkFiles() {
    var inputs = form.querySelectorAll('input[type="file"]');
    var total = 0, count = 0, i;
    for (i = 0; i < inputs.length; i++) {
      inputs[i].setCustomValidity('');
      if (inputs[i].disabled || !inputs[i].files) continue;
      for (var f = 0; f < inputs[i].files.length; f++) { total += inputs[i].files[f].size; count++; }
    }
    if (permission) permission.required = count > 0;
    if (!fileStatus) return true;
    if (!count) {
      fileStatus.textContent = fileStatus.getAttribute('data-default');
      return true;
    }
    if (total > FILE_LIMIT) {
      var msg = 'Your files add up to ' + mb(total) + ', and the form takes 10 MB at most. Take one out, then send it on WhatsApp or share a link.';
      fileStatus.textContent = msg;
      var target = lastFile && !lastFile.disabled ? lastFile : null;
      for (i = 0; !target && i < inputs.length; i++) if (!inputs[i].disabled && inputs[i].files && inputs[i].files.length) target = inputs[i];
      if (target) target.setCustomValidity(msg);
      return false;
    }
    fileStatus.textContent = (count === 1 ? '1 file' : count + ' files') + ', ' + mb(total) + ' of 10 MB.';
    return true;
  }

  /* colour pickers: shown only with JS, they fill the text box beside them */
  var swatches = form.querySelectorAll('[data-swatch-for]');
  for (var s = 0; s < swatches.length; s++) {
    (function (swatch) {
      var text = document.getElementById(swatch.getAttribute('data-swatch-for'));
      if (!text) return;
      swatch.hidden = false;
      swatch.addEventListener('input', function () { text.value = swatch.value.toUpperCase(); });
      text.addEventListener('change', function () {
        var v = text.value.trim();
        if (/^#?[0-9a-f]{6}$/i.test(v)) swatch.value = (v.charAt(0) === '#' ? v : '#' + v).toLowerCase();
      });
    })(swatches[s]);
  }

  form.addEventListener('change', function (event) {
    if (event.target.type === 'file') lastFile = event.target;
    update();
  });

  form.addEventListener('submit', function (event) {
    if (!checkFiles()) {
      event.preventDefault();
      if (lastFile) lastFile.reportValidity();
      return;
    }
    var business = form.querySelector('input[name="Business name"]');
    var biz = business ? business.value.trim() : '';
    var p = pkg();
    if (subject && biz) subject.value = 'New client details: ' + biz + (p ? ' (' + p + ')' : '');

    /* leave empty optional fields out of the email */
    var controls = form.querySelectorAll('input, textarea, select');
    for (var i = 0; i < controls.length; i++) {
      var c = controls[i];
      if (c.disabled || !c.name || c.name.charAt(0) === '_' || c.type === 'hidden') continue;
      var empty = c.type === 'file' ? !(c.files && c.files.length)
        : (c.type === 'checkbox' || c.type === 'radio') ? false
        : !String(c.value).trim();
      if (empty) { c.disabled = true; c.setAttribute('data-gs-emptied', ''); }
    }
    if (submit) { submit.disabled = true; submit.textContent = 'Sending your details…'; }
    if (sending) sending.hidden = false;
  });

  /* coming back with the back button: put everything back as it was */
  window.addEventListener('pageshow', function () {
    var emptied = form.querySelectorAll('[data-gs-emptied]');
    for (var i = 0; i < emptied.length; i++) { emptied[i].disabled = false; emptied[i].removeAttribute('data-gs-emptied'); }
    if (submit) { submit.disabled = false; submit.textContent = submitText; }
    if (sending) sending.hidden = true;
    update();
  });

  update();
})();
