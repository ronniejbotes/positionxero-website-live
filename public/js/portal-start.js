/* Position Xero: Website Plan sign-up.
 *
 * Three pages share this file, picked by <body data-px-page>:
 *   start       /start/              the three-step sign-up
 *   start-done  /start/done          waits for the signed mandate, then the login
 *   start-demo  /start/demo-mandate  local stand-in for Netcash's mandate page
 */
(function () {
  'use strict';
  var PX = window.PX;
  if (!PX) { return; }
  var page = document.body.dataset.pxPage;
  var el = PX.el;

  function store(key, value) {
    try {
      if (value === undefined) { return JSON.parse(sessionStorage.getItem(key) || 'null'); }
      if (value === null) { sessionStorage.removeItem(key); } else { sessionStorage.setItem(key, JSON.stringify(value)); }
    } catch (e) { return null; }
    return null;
  }

  /* ================================================================ */
  /* /start/                                                           */
  /* ================================================================ */
  function startPage() {
    var form = document.getElementById('pxSignup');
    var steps = Array.prototype.slice.call(form.querySelectorAll('[data-step]'));
    var stepItems = document.querySelectorAll('#pxSteps li');
    var errorBox = document.getElementById('pxSignupError');
    var company = document.getElementById('pxCompany');
    var current = 1;
    var config = null;
    var STEP_OF = { first_name: 1, last_name: 1, business_name: 1, email: 1, mobile: 1, entity_type: 1, registered_name: 1, reg_number: 1, debit_day: 2, agree: 2 };

    function show(n) {
      current = n;
      steps.forEach(function (s) { s.classList.toggle('px-hidden', Number(s.dataset.step) !== n); });
      stepItems.forEach(function (li, i) {
        li.classList.toggle('is-current', i + 1 === n);
        li.classList.toggle('is-done', i + 1 < n);
      });
      if (n === 3) { renderReview(); }
      var heading = steps[n - 1].querySelector('h2');
      if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function data() { return PX.formData(form); }

    function validate(n) {
      var d = data();
      var f = {};
      if (n === 1) {
        if (!d.first_name.trim()) { f.first_name = 'Add your first name.'; }
        if (!d.last_name.trim()) { f.last_name = 'Add your surname.'; }
        if (!d.business_name.trim()) { f.business_name = 'Add your business name.'; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) { f.email = 'That email address does not look right.'; }
        var m = d.mobile.replace(/\D/g, '');
        if (!/^0\d{9}$/.test(m) && !/^27\d{9}$/.test(m)) { f.mobile = 'Use a South African mobile number, like 082 555 1234.'; }
        if (d.entity_type === 'company' && !/^\d{4}\/\d{6}\/\d{2}$/.test(d.reg_number.trim())) { f.reg_number = 'Use the CIPC format, like 2024/123456/07.'; }
      }
      if (n === 2) {
        if (!d.debit_day) { f.debit_day = 'Pick a debit date.'; }
        if (!d.agree) { f.agree = 'Tick the box to accept the terms.'; }
      }
      if (Object.keys(f).length) { PX.showErrors(form, f); return false; }
      PX.clearErrors(form);
      return true;
    }

    function dayInfo(value) {
      return (config && config.plan.debit_days || []).filter(function (x) { return x.value === value; })[0];
    }

    function updateAside() {
      var d = dayInfo(data().debit_day);
      document.getElementById('pxAsideDay').textContent = d ? 'The ' + d.label + ' of each month' : 'Pick in step 2';
      document.getElementById('pxAsideFirst').textContent = d ? PX.date(d.first_debit) : '';
    }

    function renderReview() {
      var d = data();
      var day = dayInfo(d.debit_day);
      var rows = [
        ['Name', d.first_name + ' ' + d.last_name],
        ['Business', d.business_name],
        ['Email', d.email],
        ['Mobile', d.mobile],
        ['Account holder', d.entity_type === 'company' ? (d.registered_name || d.business_name) + ' (' + d.reg_number + ')' : 'Personal account'],
        ['Amount', PX.money(config.plan.amount) + ' a month'],
        ['Debit date', day ? 'The ' + day.label : ''],
        ['First debit', day ? PX.date(day.first_debit) : '']
      ];
      var dl = PX.clear(document.getElementById('pxReview'));
      rows.forEach(function (r) { dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1] })); });
    }

    function saveDraft() {
      var d = data();
      delete d.agree;
      store('pxSignupDraft', d);
    }
    function restoreDraft() {
      var d = store('pxSignupDraft');
      if (!d) { return; }
      Object.keys(d).forEach(function (k) {
        var inputs = form.querySelectorAll('[name="' + k + '"]');
        inputs.forEach(function (i) {
          if (i.type === 'radio') { i.checked = i.value === d[k]; } else if (i.type !== 'checkbox') { i.value = d[k]; }
        });
      });
    }

    function toggleCompany() { company.classList.toggle('px-hidden', data().entity_type !== 'company'); }

    form.addEventListener('click', function (e) {
      var next = e.target.closest('[data-next]');
      var back = e.target.closest('[data-back]');
      if (next) { if (validate(current)) { saveDraft(); show(current + 1); } }
      if (back) { PX.clearErrors(form); show(current - 1); }
    });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'entity_type') { toggleCompany(); }
      if (e.target.name === 'debit_day') { updateAside(); }
      saveDraft();
    });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && current < 3) {
        e.preventDefault();
        if (validate(current)) { saveDraft(); show(current + 1); }
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('pxGo');
      errorBox.classList.add('px-hidden');
      PX.busy(btn, true, 'Starting your debit order');
      PX.api('signup', data()).then(function (res) {
        store('pxSignupDraft', null);
        location.href = res.redirect;
      }).catch(function (err) {
        PX.busy(btn, false);
        var fields = err.data && err.data.fields;
        if (fields) {
          var first = Object.keys(fields)[0];
          show(STEP_OF[first] || 1);
          PX.showErrors(form, fields);
          return;
        }
        PX.clear(errorBox).appendChild(document.createTextNode(err.message + ' '));
        if (err.data && err.data.sign_in) { errorBox.appendChild(el('a', { href: '/portal/', class: 'px-text-link', text: 'Sign in' })); }
        errorBox.classList.remove('px-hidden');
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    PX.api('config').then(function (c) {
      config = c;
      PX.demoBanner(c.mode);
      document.getElementById('pxPlanName').textContent = c.plan.name;
      document.getElementById('pxPlanPrice').textContent = PX.money(c.plan.amount);
      document.getElementById('pxAgreeAmount').textContent = PX.money(c.plan.amount);
      document.getElementById('pxPlanChanges').textContent = c.plan.changes_per_month;
      document.getElementById('pxTermsLink').href = c.plan.terms_url;
      if (c.mode === 'demo') { document.getElementById('pxGo').textContent = 'Continue to the demo mandate →'; }
      var wrap = document.getElementById('pxDays');
      c.plan.debit_days.forEach(function (d, i) {
        wrap.appendChild(el('label', { class: 'px-choice' }, [
          el('input', { type: 'radio', name: 'debit_day', value: d.value, checked: i === 0 ? true : null }),
          el('span', {}, ['The ' + d.label, el('small', { text: 'First debit ' + PX.date(d.first_debit) })])
        ]));
      });
      restoreDraft();
      toggleCompany();
      updateAside();
    }).catch(function (err) {
      PX.clear(errorBox).appendChild(document.createTextNode(err.message));
      errorBox.classList.remove('px-hidden');
      form.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    });
  }

  /* ================================================================ */
  /* /start/done                                                       */
  /* ================================================================ */
  function donePage() {
    var box = document.getElementById('pxDone');
    var params = PX.takeHashParams();
    var polls = 0;

    function state(icon, warn, title, text, actions) {
      PX.clear(box).appendChild(el('div', { class: 'px-state' }, [
        el('div', { class: 'px-state-icon' + (warn ? ' is-warn' : ''), 'aria-hidden': 'true', text: icon }),
        el('h2', { text: title }),
        el('p', { text: text }),
        actions ? el('div', { class: 'px-btn-row u-mt-24 px-center' }, actions) : null
      ]));
    }

    function accountForm(info) {
      var form = el('form', { novalidate: true }, [
        el('div', { class: 'px-state-icon', 'aria-hidden': 'true', text: '✓' }),
        el('h2', { class: 'u-mb-8', text: 'Debit order signed' }),
        el('p', { class: 'u-mb-24', text: 'Thanks ' + info.first_name + '. Your first debit of ' + PX.money(info.amount) + ' is on ' + PX.date(info.first_debit_date) + '. Now choose a password for your client portal.' }),
        el('div', { class: 'form-group' }, [
          el('label', { class: 'form-label', for: 'acctEmail', text: 'Email' }),
          el('input', { class: 'form-input', id: 'acctEmail', type: 'email', value: info.email, readonly: true, autocomplete: 'username' })
        ]),
        el('div', { class: 'form-group' }, [
          el('label', { class: 'form-label', for: 'acctPw', text: 'Password' }),
          el('input', { class: 'form-input', id: 'acctPw', name: 'password', type: 'password', autocomplete: 'new-password', minlength: '10', required: true }),
          el('span', { class: 'px-hint', text: 'At least 10 characters. A short sentence is easy to remember.' })
        ]),
        el('div', { class: 'form-group' }, [
          el('label', { class: 'form-label', for: 'acctPw2', text: 'Type it again' }),
          el('input', { class: 'form-input', id: 'acctPw2', name: 'password2', type: 'password', autocomplete: 'new-password', required: true })
        ]),
        el('button', { type: 'submit', class: 'btn-primary px-btn-block u-mt-20', text: 'Create my login →' })
      ]);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var pw = form.querySelector('[name=password]').value;
        var pw2 = form.querySelector('[name=password2]').value;
        if (pw.length < 10) { PX.showErrors(form, { password: 'Use at least 10 characters.' }); return; }
        if (pw !== pw2) { PX.showErrors(form, { password2: 'The two passwords do not match.' }); return; }
        var btn = form.querySelector('button[type=submit]');
        PX.busy(btn, true, 'Creating your login');
        PX.api('create_account', { password: pw }).then(function () {
          location.href = '/portal/?welcome=1';
        }).catch(function (err) {
          PX.busy(btn, false);
          if (err.data && err.data.fields) { PX.showErrors(form, err.data.fields); } else { PX.toast(err.message, true); }
        });
      });
      PX.clear(box).appendChild(form);
      form.querySelector('[name=password]').focus();
    }

    function check() {
      var body = {};
      if (params.ref && params.k) { body.ref = params.ref; body.k = params.k; params = {}; }
      PX.api('signup_status', body).then(function (res) {
        PX.demoBanner(res.mode);
        if (res.state === 'signed') { accountForm(res.client); return; }
        if (res.state === 'has_account') {
          state('✓', false, 'You already have a login', 'Sign in to see your website project.', [el('a', { href: '/portal/', class: 'btn-primary', text: 'Sign in →' })]);
          return;
        }
        if (res.state === 'declined') {
          state('!', true, 'The debit order was not approved', 'Nothing has been taken from your account. You can try again with the same account or a different one.', [
            el('a', { href: '/start/', class: 'btn-primary', text: 'Try again →' }),
            el('a', { href: 'tel:+27662412155', class: 'btn-outline', text: 'Call us' })
          ]);
          return;
        }
        if (res.state === 'pending') {
          polls += 1;
          if (polls > 45) {
            state('…', true, 'Still waiting for Netcash', 'This can take a little while. We will email you a link to create your login as soon as the debit order is confirmed, so you can close this page.', [
              el('button', { type: 'button', class: 'btn-outline', text: 'Check again', onclick: function () { polls = 0; check(); } })
            ]);
            return;
          }
          PX.clear(box).appendChild(el('div', { class: 'px-state' }, [
            el('span', { class: 'px-spin', 'aria-hidden': 'true' }),
            el('h2', { class: 'u-mt-20', text: 'Waiting for your bank' }),
            el('p', { text: 'Approve the debit order in your banking app if you have not yet. This page updates by itself, and we also email you a link to finish, so you can close it.' })
          ]));
          setTimeout(check, 4000);
          return;
        }
        state('?', true, 'We could not find your sign-up', 'Open the link in the email we sent you after you signed the debit order, or start again.', [
          el('a', { href: '/start/', class: 'btn-primary', text: 'Start again →' }),
          el('a', { href: '/portal/', class: 'btn-outline', text: 'Sign in' })
        ]);
      }).catch(function (err) {
        state('!', true, 'Something went wrong', err.message, [el('button', { type: 'button', class: 'btn-outline', text: 'Try again', onclick: check })]);
      });
    }
    check();
  }

  /* ================================================================ */
  /* /start/demo-mandate (local demo only)                             */
  /* ================================================================ */
  function demoPage() {
    var box = document.getElementById('pxDemo');
    var info;

    function frame(children) {
      PX.clear(box);
      box.appendChild(el('span', { class: 'px-demo-tag', text: 'Demo: stands in for Netcash' }));
      children.forEach(function (c) { box.appendChild(c); });
    }

    function stepOtp() {
      var masked = info.client.mobile.replace(/^(\d{3})\d{4}(\d{3})$/, '$1 *** *$2');
      var form = el('form', { novalidate: true }, [
        el('h2', { text: 'Open your mandate' }),
        el('p', { class: 'u-mb-24', text: 'Netcash texts a one-time PIN to ' + masked + '. In this demo the PIN is ' + info.otp + '.' }),
        el('div', { class: 'form-group' }, [
          el('label', { class: 'form-label', for: 'otp', text: 'One-time PIN' }),
          el('input', { class: 'form-input px-otp', id: 'otp', name: 'otp', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code' })
        ]),
        el('button', { type: 'submit', class: 'btn-primary px-btn-block', text: 'Open mandate →' })
      ]);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (form.otp.value.trim() !== info.otp) { PX.showErrors(form, { otp: 'Use the demo PIN ' + info.otp + '.' }); return; }
        stepBank();
      });
      frame([form]);
      form.otp.focus();
    }

    function stepBank() {
      var m = info.mandate;
      var banks = ['Absa', 'African Bank', 'Capitec', 'Discovery Bank', 'FNB', 'Investec', 'Nedbank', 'Standard Bank', 'TymeBank'];
      var summary = el('dl', { class: 'px-kv u-mb-24' });
      [['Creditor', 'Position Xero'], ['Debtor', info.client.business_name], ['Amount', PX.money(m.amount) + ' monthly'],
        ['Debit day', 'The ' + Number(info.client.debit_day) + (['th', 'st', 'nd', 'rd'][Number(info.client.debit_day) % 10] || 'th')],
        ['First debit', PX.date(m.first_debit)], ['Contract reference', m.agreement_ref]].forEach(function (r) {
        summary.appendChild(el('dt', { text: r[0] }));
        summary.appendChild(el('dd', { text: r[1] }));
      });
      var bankSelect = el('select', { class: 'form-select', id: 'bank', name: 'bank' }, banks.map(function (b) { return el('option', { value: b, text: b }); }));
      var form = el('form', { novalidate: true }, [
        el('h2', { text: m.purpose === 'update' ? 'Your new bank account' : 'Mandate details' }),
        el('p', { class: 'u-mb-20', text: 'On the real page Netcash shows the mandate and asks for your bank account.' }),
        summary,
        el('div', { class: 'px-alert px-alert-warn', text: 'Demo: do not type a real account number. Any digits work, and only the last three are kept.' }),
        el('div', { class: 'form-row' }, [
          el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'bank', text: 'Bank' }), bankSelect]),
          el('div', { class: 'form-group' }, [
            el('label', { class: 'form-label', for: 'acctType', text: 'Account type' }),
            el('select', { class: 'form-select', id: 'acctType', name: 'account_type' }, [el('option', { text: 'Current' }), el('option', { text: 'Savings' })])
          ])
        ]),
        el('div', { class: 'form-group' }, [
          el('label', { class: 'form-label', for: 'acctNo', text: 'Account number' }),
          el('input', { class: 'form-input', id: 'acctNo', name: 'account', inputmode: 'numeric', value: '1234567890', autocomplete: 'off' })
        ]),
        el('div', { class: 'form-group' }, [
          el('label', { class: 'px-check' }, [el('input', { type: 'checkbox', name: 'sign' }), el('span', { text: 'I authorise Position Xero, through Netcash, to debit this account monthly as shown above.' })])
        ]),
        el('button', { type: 'submit', class: 'btn-primary px-btn-block', text: 'Sign the mandate →' })
      ]);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var digits = form.account.value.replace(/\D/g, '');
        var f = {};
        if (digits.length < 6) { f.account = 'Any six or more digits will do in the demo.'; }
        if (!form.sign.checked) { f.sign = 'Tick to sign.'; }
        if (Object.keys(f).length) { PX.showErrors(form, f); return; }
        stepApp(form.bank.value, form.account_type.value, digits.slice(-3));
      });
      frame([form]);
    }

    function stepApp(bank, type, last3) {
      function finish(approve, btn) {
        PX.busy(btn, true, approve ? 'Approving' : 'Declining');
        PX.api('demo_mandate_complete', { approve: approve, bank_name: bank, account_type: type, account_last3: last3 }).then(function (res) {
          location.href = res.next;
        }).catch(function (err) { PX.busy(btn, false); PX.toast(err.message, true); });
      }
      var approveBtn = el('button', { type: 'button', class: 'btn-primary px-btn-block', text: 'Approve' });
      var declineBtn = el('button', { type: 'button', class: 'btn-outline px-btn-block px-mt-12', text: 'Decline' });
      approveBtn.addEventListener('click', function () { finish(true, approveBtn); });
      declineBtn.addEventListener('click', function () { finish(false, declineBtn); });
      frame([
        el('h2', { text: 'Approve it in your banking app' }),
        el('p', { text: 'Your bank sends a DebiCheck request to your banking app. Here is a mock of that screen.' }),
        el('div', { class: 'px-bankapp' }, [
          el('span', { class: 'px-mono', text: bank + ' app' }),
          el('h3', { class: 'px-mt-12 u-mb-8', text: 'DebiCheck mandate' }),
          el('p', { text: 'Position Xero wants to debit ' + PX.money(info.mandate.amount) + ' monthly from your account ending ' + last3 + '.' }),
          approveBtn,
          declineBtn
        ])
      ]);
    }

    PX.api('demo_mandate_info').then(function (res) {
      info = res;
      PX.demoBanner('demo');
      stepOtp();
    }).catch(function (err) {
      frame([el('h2', { text: 'Nothing to sign here' }), el('p', { text: err.message }), el('a', { href: '/start/', class: 'btn-primary', text: 'Go to sign-up →' })]);
    });
  }

  if (page === 'start') { startPage(); }
  if (page === 'start-done') { donePage(); }
  if (page === 'start-demo') { demoPage(); }
})();
