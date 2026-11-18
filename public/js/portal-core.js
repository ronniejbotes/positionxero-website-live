/* Position Xero: Website Plan portal, shared helpers.
 *
 * Loaded before portal-start.js, portal-app.js and portal-admin.js. Plain
 * script, no build step, no dependencies. Every bit of text a visitor or a
 * client typed reaches the page through textContent (see PX.el), never
 * through innerHTML, so nothing they enter can run as markup.
 */
(function () {
  'use strict';

  var API = '/api/portal.php';

  function ApiError(message, data, status) {
    this.message = message;
    this.data = data || {};
    this.status = status || 0;
  }
  ApiError.prototype = Object.create(Error.prototype);

  /* GET when there is no body, POST JSON when there is one. */
  function api(action, body, opts) {
    opts = opts || {};
    var init = { credentials: 'same-origin', headers: { 'X-PX-Portal': '1', Accept: 'application/json' } };
    var url = API + '?a=' + encodeURIComponent(action);
    if (opts.query) {
      Object.keys(opts.query).forEach(function (k) { url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(opts.query[k]); });
    }
    if (body !== undefined && body !== null) {
      init.method = 'POST';
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(url, init).then(function (res) {
      return res.json().catch(function () { return { ok: false, error: 'The server sent an unreadable answer.' }; }).then(function (data) {
        if (!res.ok || !data.ok) {
          if (data && data.signed_out && opts.onSignedOut !== false && PX.onSignedOut) { PX.onSignedOut(); }
          throw new ApiError((data && data.error) || 'Something went wrong.', data, res.status);
        }
        return data;
      });
    }, function () {
      throw new ApiError('No connection. Check your internet and try again.');
    });
  }

  /* Multipart upload with progress. kind: logo | photo | brand | change */
  function upload(kind, files, onProgress) {
    return new Promise(function (resolve, reject) {
      var fd = new FormData();
      fd.append('kind', kind);
      Array.prototype.forEach.call(files, function (f) { fd.append('files[]', f, f.name); });
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API + '?a=upload');
      xhr.setRequestHeader('X-PX-Portal', '1');
      xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) { onProgress(e.loaded / e.total); } };
      xhr.onload = function () {
        var data;
        try { data = JSON.parse(xhr.responseText); } catch (e) { data = { ok: false, error: xhr.status === 413 ? 'Those files are too big to send in one go.' : 'Upload failed.' }; }
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) { resolve(data); } else { reject(new ApiError(data.error || 'Upload failed.', data, xhr.status)); }
      };
      xhr.onerror = function () { reject(new ApiError('Upload failed. Check your connection.')); };
      xhr.send(fd);
    });
  }

  /* el('div', {class: 'x', text: 'hi', onclick: fn}, [children]) */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'text') { node.textContent = v; }
      else if (k === 'class') { node.className = v; }
      else if (k.indexOf('on') === 0 && typeof v === 'function') { node.addEventListener(k.slice(2), v); }
      else if (k === 'dataset') { Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; }); }
      else if (v === true) { node.setAttribute(k, ''); }
      else { node.setAttribute(k, v); }
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) { return; }
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } return node; }

  var toastTimer;
  function toast(message, warn) {
    var t = document.querySelector('.px-toast');
    if (!t) {
      t = el('div', { class: 'px-toast', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.classList.toggle('is-warn', !!warn);
    requestAnimationFrame(function () { t.classList.add('is-on'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 4200);
  }

  function money(n) {
    var v = Number(n) || 0;
    return 'R' + v.toLocaleString('en-ZA', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ /g, ',').replace(/\s/g, ',');
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function date(s, withTime) {
    if (!s) { return ''; }
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) { return String(s); }
    var out = Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1].slice(0, 3) + ' ' + m[1];
    if (withTime && m[4]) { out += ', ' + m[4] + ':' + m[5]; }
    return out;
  }
  function monthLabel(key) {
    var m = String(key || '').match(/^(\d{4})-(\d{2})$/);
    return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : key;
  }

  /* Marks fields from a { name: message } map. Inputs are found by name. */
  function showErrors(form, fields) {
    clearErrors(form);
    var first = null;
    Object.keys(fields || {}).forEach(function (name) {
      var msg = fields[name];
      if (!msg) { return; }
      var input = form.querySelector('[name="' + name + '"]');
      if (!input) { return; }
      var group = input.closest('.form-group') || input.parentNode;
      group.classList.add('px-invalid');
      var err = el('span', { class: 'px-field-error', text: msg });
      err.dataset.pxError = '1';
      group.appendChild(err);
      if (!first) { first = input; }
    });
    if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  function clearErrors(form) {
    form.querySelectorAll('.px-invalid').forEach(function (g) { g.classList.remove('px-invalid'); });
    form.querySelectorAll('[data-px-error]').forEach(function (e) { e.remove(); });
  }

  function formData(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (f) {
      if (!f.name || f.disabled) { return; }
      if (f.type === 'checkbox') { out[f.name] = f.checked; }
      else if (f.type === 'radio') { if (f.checked) { out[f.name] = f.value; } }
      else { out[f.name] = f.value; }
    });
    return out;
  }

  /* Reads "#ref=X&k=Y" style values, then removes them from the address bar
     so a token never sits in history or gets copied with the link. */
  function takeHashParams() {
    var h = location.hash.replace(/^#/, '');
    if (!h || h.indexOf('=') === -1) { return {}; }
    var out = {};
    h.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i > 0) { out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1)); }
    });
    history.replaceState(null, '', location.pathname + location.search);
    return out;
  }

  function busy(btn, on, label) {
    if (!btn) { return; }
    if (on) {
      btn.dataset.label = btn.dataset.label || btn.textContent;
      btn.disabled = true;
      clear(btn).appendChild(el('span', { class: 'px-spin px-spin-sm', 'aria-hidden': 'true' }));
      btn.appendChild(document.createTextNode(' ' + (label || 'Working')));
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || btn.textContent;
    }
  }

  function demoBanner(mode) {
    if (mode !== 'demo' || document.querySelector('.px-demo-banner')) { return; }
    document.body.appendChild(el('div', { class: 'px-demo-banner', text: 'Demo mode: no real debit orders' }));
  }

  var STATUS = {
    received: ['Received', ''],
    in_progress: ['In progress', 'is-progress'],
    done: ['Done', 'is-done'],
    declined: ['Not done', 'is-warn'],
    scheduled: ['Scheduled', ''],
    paid: ['Paid', 'is-done'],
    failed: ['Failed', 'is-warn'],
    reversed: ['Reversed', 'is-warn'],
    draft: ['Draft', ''],
    submitted: ['Sent', 'is-done'],
    unlocked: ['Open for edits', 'is-progress'],
    active: ['Active', 'is-done'],
    pending_mandate: ['Debit order not signed', 'is-warn'],
    mandate_declined: ['Debit order declined', 'is-warn'],
    cancel_requested: ['Cancellation asked', 'is-warn'],
    cancelled: ['Cancelled', 'is-warn'],
    signed: ['Signed', 'is-done'],
    sent: ['Waiting for signature', 'is-progress'],
    error: ['Error', 'is-warn']
  };
  function statusPill(key) {
    var s = STATUS[key] || [String(key || '').replace(/_/g, ' '), ''];
    return el('span', { class: 'px-status ' + s[1], text: s[0] });
  }

  var STAGES = [
    { key: 'brief', label: 'Brief', note: 'You send us your logo, photos and details' },
    { key: 'building', label: 'Building', note: 'We build your site from the brief' },
    { key: 'review', label: 'Review', note: 'You check the preview and approve it' },
    { key: 'launching', label: 'Launch', note: 'We connect your domain and go live' },
    { key: 'live', label: 'Live', note: 'We look after it every month' }
  ];

  function fileSize(n) {
    if (n < 1024 * 1024) { return Math.max(1, Math.round(n / 1024)) + ' KB'; }
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  window.PX = {
    api: api,
    upload: upload,
    el: el,
    clear: clear,
    toast: toast,
    money: money,
    date: date,
    monthLabel: monthLabel,
    showErrors: showErrors,
    clearErrors: clearErrors,
    formData: formData,
    takeHashParams: takeHashParams,
    busy: busy,
    demoBanner: demoBanner,
    statusPill: statusPill,
    STAGES: STAGES,
    fileSize: fileSize,
    fileUrl: function (id, inline) { return API + '?a=file&id=' + encodeURIComponent(id) + (inline ? '&inline=1' : ''); },
    onSignedOut: null
  };
})();
