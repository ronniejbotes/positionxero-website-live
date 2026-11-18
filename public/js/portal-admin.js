/* Position Xero: Website Plan admin (/portal/admin).
 *
 * The team's side of the portal: the work queue, every client, and per
 * client the stage, preview and live links, the brief and its files,
 * requests, the monthly care log, debits and debit orders. Moving a client's
 * stage sends the client the matching email, so the portal does the talking.
 */
(function () {
  'use strict';
  var PX = window.PX;
  if (!PX || document.body.dataset.pxPage !== 'admin') { return; }
  var el = PX.el;
  var root = document.getElementById('pxRoot');
  var signOutBtn = document.getElementById('pxSignOut');
  var STAGE_LABEL = { brief: 'Waiting for brief', building: 'Building', review: 'Client reviewing', launching: 'Ready to launch', live: 'Live' };
  var TYPE_LABEL = { change: 'Change', problem: 'Problem', note: 'Note', revision: 'Preview changes', cancel: 'Cancellation' };
  var CARE = [['security', 'Security'], ['backup', 'Backups'], ['seo', 'SEO'], ['analytics', 'Analytics'], ['maintenance', 'Maintenance'], ['uptime', 'Uptime'], ['change', 'Change'], ['note', 'Note']];

  function panel(children, cls) { return el('div', { class: 'px-panel' + (cls ? ' ' + cls : '') }, children); }
  function button(label, cls, onclick) { var b = el('button', { type: 'button', class: cls || 'btn-primary', text: label }); if (onclick) { b.addEventListener('click', onclick); } return b; }
  function head(text, aside) { return el('div', { class: 'px-panel-head' }, [el('h3', { text: text }), aside || null]); }
  function select(name, options, value, id) {
    return el('select', { class: 'form-select', name: name, id: id || null }, options.map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === value ? true : null }); }));
  }
  function field(label, control, cls) {
    if (control.id === '') { control.id = 'a_' + Math.random().toString(36).slice(2, 8); }
    return el('div', { class: 'form-group' + (cls ? ' ' + cls : '') }, [el('label', { class: 'form-label', for: control.id, text: label }), control]);
  }
  function setUrl(ref) { history.replaceState(null, '', location.pathname + (ref ? '?client=' + encodeURIComponent(ref) : '')); }
  function fail(err) { PX.toast(err.message, true); }

  /* ---------------- Auth ---------------- */
  function signIn(message) {
    signOutBtn.classList.add('px-hidden');
    var form = el('form', { novalidate: true }, [
      el('h2', { class: 'u-mb-8', text: 'Team sign-in' }),
      message ? el('div', { class: 'px-alert', text: message }) : null,
      el('div', { class: 'form-group u-mt-20' }, [el('label', { class: 'form-label', for: 'adPw', text: 'Admin password' }), el('input', { class: 'form-input', id: 'adPw', name: 'password', type: 'password', autocomplete: 'current-password' })]),
      el('button', { type: 'submit', class: 'btn-primary px-btn-block', text: 'Sign in →' })
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      PX.api('admin_login', { password: form.password.value }, { onSignedOut: false }).then(function () { boot(); }).catch(function (err) { PX.showErrors(form, { password: err.message }); });
    });
    PX.clear(root).appendChild(el('div', { class: 'px-auth' }, [panel([form])]));
    form.password.focus();
  }

  /* ---------------- Overview ---------------- */
  function overview() {
    setUrl(null);
    PX.api('admin_overview').then(function (d) {
      PX.demoBanner(d.mode);
      var active = d.clients.filter(function (c) { return c.status === 'active' || c.status === 'cancel_requested'; });
      var pending = d.clients.filter(function (c) { return c.status === 'pending_mandate'; });
      var toBuild = d.clients.filter(function (c) { return c.stage === 'building'; });
      var toLaunch = d.clients.filter(function (c) { return c.stage === 'launching'; });
      var stat = function (label, value, note) { return el('div', { class: 'px-stat' }, [el('span', { class: 'px-mono', text: label }), el('span', { class: 'px-stat-value', text: value }), note ? el('p', { text: note }) : null]); };

      PX.clear(root);
      root.appendChild(el('div', { class: 'px-admin-grid' }, [
        stat('Active plans', String(active.length), PX.money(d.mrr) + ' a month'),
        stat('Open requests', String(d.queue.length), d.queue.filter(function (r) { return r.type === 'problem'; }).length + ' problems'),
        stat('To build', String(toBuild.length), toLaunch.length + ' approved, to launch'),
        stat('Not signed', String(pending.length), 'Started sign-up, no mandate')
      ]));

      var queue = el('table', { class: 'comparison-table px-table-click' }, [
        el('thead', {}, [el('tr', {}, ['Type', 'Client', 'Title', 'Received', 'Status'].map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', {}, d.queue.map(function (r) {
          return el('tr', { onclick: function () { client(r.ref); } }, [
            el('td', { text: TYPE_LABEL[r.type] || r.type }), el('td', { text: r.business_name }), el('td', { text: r.title }),
            el('td', { text: PX.date(r.created_at, true) }), el('td', {}, [PX.statusPill(r.status)])
          ]);
        }))
      ]);
      root.appendChild(panel([head('Work queue', el('span', { class: 'px-mono', text: 'Problems first, then oldest' })), d.queue.length ? el('div', { class: 'table-wrap' }, [queue]) : el('p', { text: 'Nothing waiting.' })]));

      var clients = el('table', { class: 'comparison-table px-table-click' }, [
        el('thead', {}, [el('tr', {}, ['Client', 'Ref', 'Stage', 'Brief', 'Plan', 'Open', 'Joined'].map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', {}, d.clients.map(function (c) {
          return el('tr', { onclick: function () { client(c.ref); } }, [
            el('td', { text: c.business_name }), el('td', { text: c.ref }), el('td', { text: STAGE_LABEL[c.stage] || c.stage }),
            el('td', {}, [PX.statusPill(c.brief_status || 'draft')]), el('td', {}, [PX.statusPill(c.status)]),
            el('td', { text: String(c.open_requests) }), el('td', { text: PX.date(c.created_at) })
          ]);
        }))
      ]);
      root.appendChild(panel([head('Clients'), d.clients.length ? el('div', { class: 'table-wrap' }, [clients]) : el('p', { text: 'No sign-ups yet.' })]));
      root.appendChild(el('div', { class: 'px-btn-row u-mt-24' }, [button('Email outbox', 'btn-outline', outbox)]));
    }).catch(fail);
  }

  /* ---------------- Outbox ---------------- */
  function outbox() {
    PX.api('admin_outbox').then(function (d) {
      PX.clear(root);
      root.appendChild(el('div', { class: 'px-btn-row u-mb-24' }, [button('← Back', 'btn-outline', overview)]));
      var box = panel([head('Email outbox', el('span', { class: 'px-mono', text: 'Mail mode: ' + d.mode })),
        el('p', { class: 'u-mb-20', text: d.mode === 'log' ? 'Mail mode is "log", so nothing is sent. Every email the portal would have sent is kept here.' : 'Only messages that failed to send are kept here.' })]);
      if (!d.messages.length) { box.appendChild(el('p', { text: 'Empty.' })); }
      d.messages.forEach(function (m) {
        box.appendChild(el('div', { class: 'px-mail' }, [el('div', { class: 'px-req-meta', text: PX.date(m.at, true) + ' · to ' + m.to }), el('h4', { class: 'px-mt-12', text: m.subject }), el('pre', { text: m.text })]));
      });
      root.appendChild(box);
    }).catch(fail);
  }

  /* ---------------- Client ---------------- */
  function client(ref) {
    setUrl(ref);
    PX.api('admin_client', null, { query: { ref: ref } }).then(function (d) {
      var c = d.client;
      var reload = function () { client(ref); };
      PX.clear(root);
      root.appendChild(el('div', { class: 'px-btn-row u-mb-24' }, [button('← All clients', 'btn-outline', overview)]));

      var info = el('dl', { class: 'px-kv' });
      [['Contact', c.first_name + ' ' + c.last_name], ['Email', c.email], ['Mobile', c.mobile],
        ['Account holder', c.entity_type === 'company' ? (c.registered_name || '') + ' ' + (c.reg_number || '') : 'Personal'],
        ['Plan', PX.money(c.amount) + ' a month, debit on the ' + Number(c.debit_day)], ['Next debit', c.next_debit_date ? PX.date(c.next_debit_date) : 'None'],
        ['Portal login', c.has_account ? 'Yes, last in ' + (c.last_login_at ? PX.date(c.last_login_at, true) : 'never') : 'Not created yet'],
        ['Changes this month', d.quota.used + ' of ' + d.quota.allowed + ' used']
      ].forEach(function (r) { info.appendChild(el('dt', { text: r[0] })); info.appendChild(el('dd', { text: r[1] })); });
      root.appendChild(panel([head(c.business_name + ' · ' + c.ref, PX.statusPill(c.status)), info]));

      // Stage and links
      var stageForm = el('form', { class: 'px-admin-form', novalidate: true }, [
        field('Stage', select('stage', Object.keys(STAGE_LABEL).map(function (k) { return [k, STAGE_LABEL[k]]; }), c.stage, 'adStage')),
        field('Plan status', select('status', [['active', 'Active'], ['pending_mandate', 'Debit order not signed'], ['mandate_declined', 'Debit order declined'], ['cancel_requested', 'Cancellation asked'], ['cancelled', 'Cancelled']], c.status, 'adStatus')),
        field('Preview link', el('input', { class: 'form-input', name: 'preview_url', id: 'adPreview', value: c.preview_url || '', placeholder: 'https://' })),
        field('Live link', el('input', { class: 'form-input', name: 'live_url', id: 'adLive', value: c.live_url || '', placeholder: 'https://' })),
        field('Internal notes (never shown to the client)', el('textarea', { class: 'form-textarea px-textarea-sm', name: 'internal_notes', id: 'adNotes' }, [c.internal_notes || '']), 'px-span-2'),
        el('div', { class: 'px-span-2' }, [
          el('p', { class: 'px-hint u-mb-12', text: 'Moving to "Client reviewing" emails the preview link. Moving to "Live" emails the launch note. Other moves are silent.' }),
          el('button', { type: 'submit', class: 'btn-primary', text: 'Save' })
        ])
      ]);
      stageForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = PX.formData(stageForm);
        body.ref = ref;
        PX.api('admin_client_update', body).then(function () { PX.toast('Saved.'); reload(); }).catch(fail);
      });
      root.appendChild(panel([head('Stage and links'), stageForm]));

      // Brief
      var briefBox = panel([head('Brief', PX.statusPill(d.brief.status))]);
      var briefActions = el('div', { class: 'px-btn-row u-mb-24' }, [
        el('a', { class: 'btn-outline px-btn-sm', href: '/api/portal.php?a=admin_zip&ref=' + encodeURIComponent(ref), text: 'Download brief and files (.zip)' }),
        d.brief.status === 'submitted' ? button('Open it for client edits', 'btn-outline px-btn-sm', function () {
          PX.api('admin_brief_unlock', { ref: ref }).then(function () { PX.toast('Brief opened for edits.'); reload(); }).catch(fail);
        }) : null
      ]);
      briefBox.appendChild(briefActions);
      if (!d.brief.sections.length) { briefBox.appendChild(el('p', { text: 'Nothing filled in yet.' })); }
      d.brief.sections.forEach(function (s) {
        var dl = el('dl', { class: 'px-summary' });
        s.rows.forEach(function (r) { dl.appendChild(el('dt', { text: r.label })); dl.appendChild(el('dd', { text: r.value })); });
        briefBox.appendChild(el('div', { class: 'px-summary-section' }, [el('h4', { text: s.title }), dl]));
      });
      var briefFiles = d.files.filter(function (f) { return f.request_id === null && f.kind !== 'change'; });
      if (briefFiles.length) {
        var grid = el('div', { class: 'px-files' });
        briefFiles.forEach(function (f) {
          grid.appendChild(el('div', { class: 'px-file' }, [
            el('div', { class: 'px-file-thumb' }, [f.is_image ? el('img', { src: PX.fileUrl(f.id, true), alt: '', loading: 'lazy' }) : el('b', { text: (f.name.split('.').pop() || 'file').slice(0, 4) })]),
            el('a', { class: 'px-file-name', href: PX.fileUrl(f.id), title: f.kind + ': ' + f.name, text: f.kind + ' · ' + f.name })
          ]));
        });
        briefBox.appendChild(el('div', { class: 'u-mt-24' }, [el('h4', { class: 'px-mono u-mb-8', text: 'Files' }), grid]));
      }
      root.appendChild(briefBox);

      // Requests
      var reqBox = panel([head('Requests', el('span', { class: 'px-mono', text: d.requests.length + ' in total' }))]);
      var ul = el('ul', { class: 'px-requests' });
      d.requests.forEach(function (r) {
        var f = el('form', { class: 'px-inline-form px-mt-12', novalidate: true }, [
          select('status', [['received', 'Received'], ['in_progress', 'In progress'], ['done', 'Done'], ['declined', 'Not doing']], r.status),
          el('input', { class: 'form-input', name: 'team_note', value: r.team_note || '', placeholder: 'Note to the client (shown in the portal and the email)', 'aria-label': 'Note to the client' }),
          el('button', { type: 'submit', class: 'btn-outline px-btn-sm', text: 'Update' })
        ]);
        f.classList.add('px-request-form');
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var body = PX.formData(f);
          body.id = r.id;
          PX.api('admin_request_update', body).then(function () { PX.toast('Updated. The client sees it now.'); reload(); }).catch(fail);
        });
        ul.appendChild(el('li', {}, [
          el('div', { class: 'px-req-top' }, [el('div', {}, [el('h4', { text: r.title }), el('div', { class: 'px-req-meta', text: [TYPE_LABEL[r.type] || r.type, PX.date(r.created_at, true), r.page ? 'Page: ' + r.page : null, r.counts ? 'Counts' : 'Free'].filter(Boolean).join(' · ') })]), PX.statusPill(r.status)]),
          el('div', { class: 'px-req-body', text: r.details }),
          r.files.length ? el('div', { class: 'px-req-meta' }, r.files.map(function (x) { return el('a', { class: 'px-text-link', href: PX.fileUrl(x.id), text: x.name + '  ' }); })) : null,
          f
        ]));
      });
      reqBox.appendChild(d.requests.length ? ul : el('p', { text: 'None yet.' }));
      root.appendChild(reqBox);

      // Care log
      var month = new Date().toISOString().slice(0, 7);
      var careForm = el('form', { class: 'px-inline-form', novalidate: true }, [
        el('input', { class: 'form-input', type: 'month', name: 'month', value: month, 'aria-label': 'Month' }),
        select('category', CARE, 'maintenance'),
        el('input', { class: 'form-input', name: 'text', placeholder: 'What was done, in plain words', 'aria-label': 'What was done' }),
        el('input', { class: 'form-input', name: 'metric_label', placeholder: 'Figure label', 'aria-label': 'Figure label, for example Visitors' }),
        el('input', { class: 'form-input', name: 'metric_value', placeholder: 'Figure', 'aria-label': 'Figure' }),
        el('button', { type: 'submit', class: 'btn-primary px-btn-sm', text: 'Add' })
      ]);
      careForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = PX.formData(careForm);
        body.ref = ref;
        PX.api('admin_care_add', body).then(function () { PX.toast('Logged.'); reload(); }).catch(fail);
      });
      var careBox = panel([head('Monthly care log'), el('p', { class: 'px-hint u-mb-12', text: 'What you log here is the client\'s monthly report in the portal. Use a figure only when it is a real number from their Analytics or Search Console.' }), careForm]);
      var months = {};
      d.care.forEach(function (it) { (months[it.month_key] = months[it.month_key] || []).push(it); });
      Object.keys(months).sort().reverse().forEach(function (m) {
        var list = el('ul', { class: 'px-care' });
        months[m].forEach(function (it) {
          list.appendChild(el('li', {}, [
            el('span', { class: 'px-mono', text: it.category }),
            el('span', { text: it.text + (it.metric_value ? ' (' + (it.metric_label || '') + ': ' + it.metric_value + ')' : '') }),
            button('Remove', 'px-link', function () { PX.api('admin_care_delete', { id: it.id }).then(reload).catch(fail); })
          ]));
        });
        careBox.appendChild(el('div', { class: 'u-mt-24' }, [
          el('div', { class: 'px-panel-head' }, [el('h4', { text: PX.monthLabel(m) }), button('Email this report to the client', 'btn-outline px-btn-sm', function (e) {
            var btn = e.currentTarget;
            PX.busy(btn, true, 'Sending');
            PX.api('admin_send_report', { ref: ref, month: m }).then(function () { PX.toast('Report emailed.'); reload(); }).catch(function (err) { PX.busy(btn, false); fail(err); });
          })]),
          list
        ]));
      });
      root.appendChild(careBox);

      // Debits
      var payForm = el('form', { class: 'px-inline-form', novalidate: true }, [
        el('input', { class: 'form-input', type: 'date', name: 'date', value: c.next_debit_date || '', 'aria-label': 'Debit date' }),
        select('status', [['paid', 'Paid'], ['failed', 'Failed'], ['scheduled', 'Scheduled'], ['reversed', 'Reversed']], 'paid'),
        el('input', { class: 'form-input', name: 'note', placeholder: 'Note', 'aria-label': 'Note' }),
        el('input', { class: 'form-input', name: 'amount', value: String(c.amount), inputmode: 'decimal', 'aria-label': 'Amount in rand' }),
        el('span'),
        el('button', { type: 'submit', class: 'btn-primary px-btn-sm', text: 'Record' })
      ]);
      payForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = PX.formData(payForm);
        body.ref = ref;
        PX.api('admin_payment_add', body).then(function () { PX.toast('Recorded.'); reload(); }).catch(fail);
      });
      var payTable = el('table', { class: 'comparison-table' }, [
        el('thead', {}, [el('tr', {}, ['Date', 'Amount', 'Status', 'Note', 'Set to'].map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', {}, d.payments.map(function (p) {
          var s = select('status', [['scheduled', 'Scheduled'], ['paid', 'Paid'], ['failed', 'Failed'], ['reversed', 'Reversed']], p.status);
          s.addEventListener('change', function () { PX.api('admin_payment_update', { id: p.id, status: s.value }).then(reload).catch(fail); });
          return el('tr', {}, [el('td', { text: PX.date(p.pay_date) }), el('td', { text: PX.money(p.amount_cents / 100) }), el('td', {}, [PX.statusPill(p.status)]), el('td', { text: p.note || '' }), el('td', {}, [s])]);
        }))
      ]);
      root.appendChild(panel([head('Debits'), el('p', { class: 'px-hint u-mb-12', text: 'Record each month\'s result from the Netcash debit order report.' }), payForm, d.payments.length ? el('div', { class: 'table-wrap u-mt-20' }, [payTable]) : null]));

      // Mandates
      var mTable = el('table', { class: 'comparison-table' }, [
        el('thead', {}, [el('tr', {}, ['Started', 'Purpose', 'Contract ref', 'Status', 'Bank', 'Netcash ref', 'PDF'].map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', {}, d.mandates.map(function (m) {
          return el('tr', {}, [el('td', { text: PX.date(m.created_at, true) }), el('td', { text: m.purpose }), el('td', { text: m.agreement_ref }), el('td', {}, [PX.statusPill(m.status)]),
            el('td', { text: m.bank_summary || m.reason || '' }), el('td', { text: m.netcash_ref || '' }), el('td', {}, [m.pdf_link ? el('a', { class: 'px-text-link', href: m.pdf_link, target: '_blank', rel: 'noopener', text: 'Mandate' }) : null])]);
        }))
      ]);
      root.appendChild(panel([head('Debit orders'), d.mandates.length ? el('div', { class: 'table-wrap' }, [mTable]) : el('p', { text: 'None.' })]));

      // Activity
      var tl = el('ol', { class: 'px-timeline' });
      d.events.forEach(function (ev) { tl.appendChild(el('li', {}, [el('time', { text: PX.date(ev.created_at, true) }), ev.message])); });
      root.appendChild(panel([head('Activity'), tl]));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }).catch(fail);
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    PX.api('admin_me').then(function (res) {
      PX.demoBanner(res.mode);
      if (!res.admin) { signIn(res.enabled ? null : 'Admin sign-in is off until admin.password_hash is set in px-portal-config.php.'); return; }
      signOutBtn.classList.remove('px-hidden');
      var ref = new URLSearchParams(location.search).get('client');
      if (ref) { client(ref); } else { overview(); }
    }).catch(fail);
  }
  PX.onSignedOut = function () { signIn('Your session ended. Sign in again.'); };
  signOutBtn.addEventListener('click', function () { PX.api('admin_logout', {}).then(function () { signIn('Signed out.'); }); });
  boot();
})();
