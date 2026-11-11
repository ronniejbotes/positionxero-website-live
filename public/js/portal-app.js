/* Position Xero: Website Plan client portal (/portal/).
 *
 * Views: overview, brief, changes, billing, account, plus sign-in, forgot
 * and reset. The view sits in ?view= rather than the hash, because main.js
 * smooth-scrolls every href="#..." link and would choke on a route.
 *
 * The brief form is drawn from the BRIEF spec below. Its paths match the
 * PX_BRIEF map in /api/portal-lib/brief.php; add a question in both.
 */
(function () {
  'use strict';
  var PX = window.PX;
  if (!PX || document.body.dataset.pxPage !== 'portal') { return; }
  var el = PX.el;
  var root = document.getElementById('pxRoot');
  var signOutBtn = document.getElementById('pxSignOut');

  var S = { dash: null, view: 'overview', tab: 'business', data: {}, saveTimer: null, saving: false, savedAt: '', pendingFiles: [] };

  /* ---------------------------------------------------------------- */
  /* Brief spec                                                        */
  /* ---------------------------------------------------------------- */
  var PERSONALITY = ['Professional', 'Friendly', 'Premium', 'Bold', 'Calm', 'Modern', 'Traditional', 'Playful', 'Technical', 'Local'];
  var PAGES = ['Home', 'About', 'Services', 'A page for each service', 'Gallery or portfolio', 'Pricing', 'Reviews', 'FAQ', 'Contact', 'Blog'];
  var FEATURES = ['Contact form', 'WhatsApp button', 'Quote request form', 'Booking link', 'Google Map', 'Reviews section', 'Price list', 'Newsletter sign-up'];

  var BRIEF = [
    { id: 'business', title: 'Business', groups: [
      { legend: 'The basics', intro: 'How customers know you.', fields: [
        { path: 'business.name', label: 'Business or brand name', type: 'text', req: true },
        { path: 'business.tagline', label: 'Tagline or slogan', type: 'text', hint: 'Optional. A short line that sits under your name.' },
        { path: 'business.description', label: 'What does the business do?', type: 'textarea', req: true, hint: 'A few sentences, the way you would explain it to a new customer.' },
        { path: 'business.areas', label: 'Where do you work?', type: 'text', half: true, placeholder: 'Towns, suburbs or regions' },
        { path: 'business.established', label: 'Year started', type: 'text', half: true, inputmode: 'numeric' }
      ] },
      { legend: 'Services or products', intro: 'One line each. Add a short description where it helps.', fields: [
        { path: 'business.services', type: 'repeat', req: true, add: 'Add another', cols: [
          { key: 'name', label: 'Service or product', placeholder: 'e.g. Geyser installation' },
          { key: 'desc', label: 'Short description', placeholder: 'Optional' }
        ] }
      ] },
      { legend: 'Your customers', fields: [
        { path: 'business.audience', label: 'Who are your customers?', type: 'textarea', small: true },
        { path: 'business.different', label: 'Why do customers choose you?', type: 'textarea', small: true, hint: 'Speed, price, experience, the area you cover, guarantees you really offer.' }
      ] }
    ] },
    { id: 'brand', title: 'Brand', groups: [
      { legend: 'Logo', fields: [
        { path: 'brand.logo_status', label: 'Do you have a logo?', type: 'choice', req: true, options: [
          { value: 'have', label: 'Yes, I have one', hint: 'Upload it below' },
          { value: 'need', label: 'No logo yet', hint: 'We will talk about options' }
        ] },
        { type: 'upload', kind: 'logo', label: 'Your logo', hint: 'The best version you have. SVG, AI, EPS or PDF is ideal; a large PNG works too.', showIf: ['brand.logo_status', ['have']] }
      ] },
      { legend: 'Colours and fonts', fields: [
        { path: 'brand.colours', label: 'Brand colours', type: 'colours', hint: 'Add up to five. Skip it if you are not sure.' },
        { path: 'brand.colours_note', label: 'Notes on colour', type: 'text', placeholder: 'e.g. Navy and white, nothing too bright' },
        { path: 'brand.fonts', label: 'Fonts', type: 'text', placeholder: 'Only if you know them' }
      ] },
      { legend: 'Look and feel', fields: [
        { path: 'brand.personality', label: 'How should the site feel?', type: 'chips', options: PERSONALITY, hint: 'Pick up to three.' },
        { path: 'brand.likes', label: 'Websites you like', type: 'repeat', add: 'Add another', cols: [
          { key: 'url', label: 'Website', placeholder: 'https://' },
          { key: 'note', label: 'What you like about it', placeholder: 'Optional' }
        ] },
        { path: 'brand.avoid', label: 'Anything to avoid?', type: 'textarea', small: true },
        { path: 'brand.competitors', label: 'Competitors', type: 'textarea', small: true, hint: 'Names or websites. It helps us make you stand apart.' },
        { type: 'upload', kind: 'brand', label: 'Other brand material', hint: 'Brand guide, business card, flyer, signage, a document with your text.' }
      ] }
    ] },
    { id: 'pages', title: 'Pages', groups: [
      { legend: 'Pages', fields: [
        { path: 'pages.list', label: 'Which pages do you want?', type: 'chips', options: PAGES, req: true },
        { path: 'pages.other', label: 'Any other pages?', type: 'text' }
      ] },
      { legend: 'Words', fields: [
        { path: 'pages.copy_source', label: 'Who writes the words on the site?', type: 'choice', req: true, options: [
          { value: 'brief', label: 'Write it from this brief' },
          { value: 'mine', label: 'I will supply my own text' },
          { value: 'mix', label: 'A mix of both' }
        ] },
        { path: 'pages.copy_text', label: 'Your text', type: 'textarea', hint: 'Paste it here, or upload a document under Brand > Other brand material.', showIf: ['pages.copy_source', ['mine', 'mix']] }
      ] },
      { legend: 'Photos', intro: 'Real photos of your work, team, premises or products make the biggest difference.', fields: [
        { type: 'upload', kind: 'photo', label: 'Your photos', hint: 'JPG, PNG, WEBP or HEIC.' },
        { path: 'pages.stock_ok', label: 'Use good stock photos where mine run out', type: 'check' }
      ] }
    ] },
    { id: 'contact', title: 'Contact', groups: [
      { legend: 'Contact details for the site', fields: [
        { path: 'contact.phone', label: 'Phone number', type: 'tel', half: true },
        { path: 'contact.whatsapp', label: 'WhatsApp number', type: 'tel', half: true, hint: 'Leave blank if it is the same.' },
        { path: 'contact.email', label: 'Email for enquiries', type: 'email', half: true },
        { path: 'contact.hours', label: 'Business hours', type: 'text', half: true, placeholder: 'Mon to Fri 8:00 to 17:00' },
        { path: 'contact.address', label: 'Address', type: 'textarea', small: true },
        { path: 'contact.show_address', label: 'Show the address on the site', type: 'check' }
      ] },
      { legend: 'Social profiles', intro: 'Links to the profiles you want on the site.', fields: [
        { path: 'contact.socials.facebook', label: 'Facebook', type: 'url', half: true },
        { path: 'contact.socials.instagram', label: 'Instagram', type: 'url', half: true },
        { path: 'contact.socials.linkedin', label: 'LinkedIn', type: 'url', half: true },
        { path: 'contact.socials.tiktok', label: 'TikTok', type: 'url', half: true },
        { path: 'contact.socials.youtube', label: 'YouTube', type: 'url', half: true },
        { path: 'contact.socials.google', label: 'Google Business Profile', type: 'url', half: true }
      ] },
      { legend: 'Domain name', fields: [
        { path: 'contact.domain_status', label: 'Do you have a domain name?', type: 'choice', req: true, options: [
          { value: 'own', label: 'Yes, I own one', hint: 'e.g. yourbusiness.co.za' },
          { value: 'need', label: 'No, I need one' }
        ] },
        { path: 'contact.domain', label: 'Your domain', type: 'text', half: true, placeholder: 'yourbusiness.co.za', showIf: ['contact.domain_status', ['own']] },
        { path: 'contact.domain_registrar', label: 'Where is it registered?', type: 'text', half: true, hint: 'The company you pay for it, if you know.', showIf: ['contact.domain_status', ['own']] },
        { path: 'contact.domain_wishes', label: 'Names you would like', type: 'text', showIf: ['contact.domain_status', ['need']] },
        { path: 'contact.current_site', label: 'Current website, if any', type: 'url' }
      ] }
    ] },
    { id: 'extras', title: 'Extras', groups: [
      { legend: 'Features', fields: [
        { path: 'extras.features', label: 'What should the site have?', type: 'chips', options: FEATURES },
        { path: 'extras.booking_url', label: 'Booking or quote link', type: 'url', hint: 'If you already use a booking system, paste its link.' },
        { path: 'extras.deadline', label: 'A date you need to be live by', type: 'date', half: true },
        { path: 'extras.notes', label: 'Anything else we should know?', type: 'textarea' }
      ] }
    ] },
    { id: 'send', title: 'Check and send' }
  ];

  var UPLOAD_ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.svg,.pdf,.ai,.eps,.psd,.zip,.doc,.docx,.txt,.pptx,.xlsx';

  /* ---------------------------------------------------------------- */
  /* Small helpers                                                     */
  /* ---------------------------------------------------------------- */
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o && typeof o === 'object' ? o[k] : undefined; }, obj);
  }
  function set(obj, path, value) {
    var keys = path.split('.');
    var o = obj;
    keys.slice(0, -1).forEach(function (k) { if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) { o[k] = {}; } o = o[k]; });
    o[keys[keys.length - 1]] = value;
  }
  function str(obj, path) { var v = get(obj, path); return typeof v === 'string' ? v.trim() : ''; }

  function setUrlView(view) {
    var url = location.pathname + (view && view !== 'overview' ? '?view=' + view : '');
    history.replaceState(null, '', url);
  }

  function panel(children, cls) { return el('div', { class: 'px-panel' + (cls ? ' ' + cls : '') }, children); }

  function button(label, cls, onclick, attrs) {
    var b = el('button', Object.assign({ type: 'button', class: cls || 'btn-primary', text: label }, attrs || {}));
    if (onclick) { b.addEventListener('click', onclick); }
    return b;
  }

  function setHeader(c) {
    var title = document.getElementById('pxTitle');
    var kicker = document.getElementById('pxKicker');
    var lead = document.getElementById('pxLead');
    if (!c) {
      PX.clear(title).appendChild(document.createTextNode('Your '));
      title.appendChild(el('span', { class: 'gradient-text', text: 'website' }));
      kicker.textContent = 'Client portal';
      lead.textContent = 'Everything about your website in one place: your brief, your progress, your monthly changes and your billing.';
      return;
    }
    PX.clear(title).appendChild(document.createTextNode('Hi ' + c.first_name + ', '));
    title.appendChild(el('br'));
    title.appendChild(el('span', { class: 'gradient-text', text: c.business_name }));
    kicker.textContent = 'Client portal · ' + c.ref;
    var stage = PX.STAGES.filter(function (s) { return s.key === c.stage; })[0];
    lead.textContent = stage ? 'Stage: ' + stage.label + '. ' + stage.note + '.' : '';
  }

  /* ---------------------------------------------------------------- */
  /* Auth                                                              */
  /* ---------------------------------------------------------------- */
  function authFrame(children) {
    signOutBtn.classList.add('px-hidden');
    setHeader(null);
    PX.clear(root).appendChild(el('div', { class: 'px-auth' }, children));
  }

  function showSignIn(message) {
    S.dash = null;
    var form = el('form', { novalidate: true }, [
      el('h2', { class: 'u-mb-8', text: 'Sign in' }),
      el('p', { class: 'u-mb-24', text: 'Use the email you signed up with.' }),
      message ? el('div', { class: 'px-alert', text: message }) : null,
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label', for: 'siEmail', text: 'Email' }),
        el('input', { class: 'form-input', id: 'siEmail', name: 'email', type: 'email', autocomplete: 'username', required: true })
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label', for: 'siPw', text: 'Password' }),
        el('input', { class: 'form-input', id: 'siPw', name: 'password', type: 'password', autocomplete: 'current-password', required: true })
      ]),
      el('button', { type: 'submit', class: 'btn-primary px-btn-block', text: 'Sign in →' }),
      el('div', { class: 'px-auth-foot' }, [button('Forgot your password?', 'px-link', showForgot)])
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      PX.busy(btn, true, 'Signing in');
      PX.api('login', { email: form.email.value, password: form.password.value }, { onSignedOut: false }).then(function () {
        load('overview');
      }).catch(function (err) {
        PX.busy(btn, false);
        PX.showErrors(form, { password: err.message });
      });
    });
    authFrame([
      panel([form]),
      el('p', { class: 'px-auth-foot' }, ['New here? ', el('a', { href: '/website-plan', text: 'See the Website Plan' })])
    ]);
    form.email.focus();
  }

  function showForgot() {
    var form = el('form', { novalidate: true }, [
      el('h2', { class: 'u-mb-8', text: 'Reset your password' }),
      el('p', { class: 'u-mb-24', text: 'We will email you a link to choose a new one.' }),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label', for: 'fgEmail', text: 'Email' }),
        el('input', { class: 'form-input', id: 'fgEmail', name: 'email', type: 'email', autocomplete: 'username', required: true })
      ]),
      el('button', { type: 'submit', class: 'btn-primary px-btn-block', text: 'Email me a link →' }),
      el('div', { class: 'px-auth-foot' }, [button('Back to sign in', 'px-link', function () { showSignIn(); })])
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      PX.busy(btn, true, 'Sending');
      PX.api('forgot', { email: form.email.value }).then(function (res) {
        showSignIn(res.message);
      }).catch(function (err) { PX.busy(btn, false); PX.toast(err.message, true); });
    });
    authFrame([panel([form])]);
    form.email.focus();
  }

  function showReset(token) {
    var form = el('form', { novalidate: true }, [
      el('h2', { class: 'u-mb-8', text: 'Choose a new password' }),
      el('div', { class: 'form-group u-mt-20' }, [
        el('label', { class: 'form-label', for: 'rsPw', text: 'New password' }),
        el('input', { class: 'form-input', id: 'rsPw', name: 'password', type: 'password', autocomplete: 'new-password', required: true }),
        el('span', { class: 'px-hint', text: 'At least 10 characters.' })
      ]),
      el('button', { type: 'submit', class: 'btn-primary px-btn-block', text: 'Save and sign in →' })
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      PX.busy(btn, true, 'Saving');
      PX.api('reset', { token: token, password: form.password.value }).then(function () {
        PX.toast('Password saved.');
        load('overview');
      }).catch(function (err) {
        PX.busy(btn, false);
        if (err.data && err.data.fields) { PX.showErrors(form, err.data.fields); } else { showSignIn(err.message); }
      });
    });
    authFrame([panel([form])]);
    form.password.focus();
  }

  /* ---------------------------------------------------------------- */
  /* Shell                                                             */
  /* ---------------------------------------------------------------- */
  var VIEWS = [
    { key: 'overview', label: 'Overview' },
    { key: 'brief', label: 'Brief' },
    { key: 'changes', label: 'Changes' },
    { key: 'billing', label: 'Billing' },
    { key: 'account', label: 'Account' }
  ];

  function load(view) {
    return PX.api('dashboard').then(function (d) {
      S.dash = d;
      S.data = JSON.parse(JSON.stringify(d.brief.data || {}));
      if (Array.isArray(S.data)) { S.data = {}; }
      // A fresh brief starts with what we already know from sign-up.
      if (!Object.keys(S.data).length && d.brief.status !== 'submitted') {
        set(S.data, 'business.name', d.client.business_name);
        set(S.data, 'contact.email', d.client.email);
        set(S.data, 'contact.phone', d.client.mobile);
      }
      PX.demoBanner(d.mode);
      signOutBtn.classList.remove('px-hidden');
      setHeader(d.client);
      show(view || S.view);
    }).catch(function (err) {
      if (err.status === 401) { showSignIn(); } else { PX.clear(root).appendChild(panel([el('h2', { text: 'Could not load your portal' }), el('p', { text: err.message })])); }
    });
  }

  function badgeFor(key) {
    var d = S.dash;
    if (key === 'brief' && d.brief.status !== 'submitted') { return '!'; }
    if (key === 'overview' && d.client.stage === 'review') { return '1'; }
    return null;
  }

  function show(view) {
    flushSave();
    S.view = view;
    setUrlView(view);
    var nav = el('nav', { class: 'px-sidenav', 'aria-label': 'Portal' });
    VIEWS.forEach(function (v) {
      var badge = badgeFor(v.key);
      nav.appendChild(el('button', { type: 'button', 'aria-current': v.key === view ? 'page' : null, onclick: function () { show(v.key); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, [
        el('span', { text: v.label }), badge ? el('span', { class: 'px-badge', text: badge }) : null
      ]));
    });
    nav.appendChild(el('div', { class: 'px-sidenav-foot' }, [
      'Stuck? Call ', el('a', { href: 'tel:+27662412155', text: '+27 66 241 2155' })
    ]));
    var main = el('div', { id: 'pxView' });
    PX.clear(root).appendChild(el('div', { class: 'px-app' }, [nav, main]));
    ({ overview: viewOverview, brief: viewBrief, changes: viewChanges, billing: viewBilling, account: viewAccount }[view] || viewOverview)(main);
  }

  function title(main, text, aside) {
    main.appendChild(el('div', { class: 'px-view-title' }, [el('h2', { text: text }), aside || null]));
  }

  /* ---------------------------------------------------------------- */
  /* Overview                                                          */
  /* ---------------------------------------------------------------- */
  function viewOverview(main) {
    var d = S.dash;
    var c = d.client;
    var stageIdx = PX.STAGES.map(function (s) { return s.key; }).indexOf(c.stage);

    var track = el('ol', { class: 'px-track', 'aria-label': 'Website progress' });
    PX.STAGES.forEach(function (s, i) {
      var cls = i < stageIdx || (c.stage === 'live' && i === stageIdx) ? 'is-done' : (i === stageIdx ? 'is-current' : '');
      track.appendChild(el('li', { class: cls, 'aria-current': i === stageIdx ? 'step' : null }, [el('strong', { text: s.label }), el('span', { text: s.note })]));
    });

    title(main, 'Overview');
    main.appendChild(panel([el('div', { class: 'px-panel-head' }, [el('h3', { text: 'Where your website is' })]), track]));
    main.appendChild(nextStep());

    var q = d.quota;
    var quotaBar = el('div', { class: 'px-quota', 'aria-hidden': 'true' });
    for (var i = 0; i < q.allowed; i++) { quotaBar.appendChild(el('i', { class: i < q.used ? 'is-used' : '' })); }
    var live = c.stage === 'live';
    main.appendChild(el('div', { class: 'px-stats' }, [
      el('div', { class: 'px-stat' }, [
        el('span', { class: 'px-mono', text: 'Changes this month' }),
        el('span', { class: 'px-stat-value', text: live ? q.left + ' of ' + q.allowed + ' left' : q.allowed + ' a month' }),
        live ? quotaBar : null,
        el('p', { text: live ? 'Resets on ' + PX.date(q.resets_on) + '.' : 'They start once your site is live.' })
      ]),
      el('div', { class: 'px-stat' }, [
        el('span', { class: 'px-mono', text: 'Next debit' }),
        el('span', { class: 'px-stat-value', text: c.next_debit_date ? PX.money(c.amount) : 'None' }),
        el('p', { text: c.next_debit_date ? 'On ' + PX.date(c.next_debit_date) + '.' : 'No debit is scheduled.' })
      ]),
      el('div', { class: 'px-stat' }, [
        el('span', { class: 'px-mono', text: 'Plan' }),
        el('span', { class: 'px-stat-value', text: d.plan.name }),
        el('p', {}, [PX.statusPill(c.status)])
      ])
    ]));

    var monthItems = d.care.items.filter(function (it) { return it.month === (d.care.months[0] || ''); });
    var care = panel([
      el('div', { class: 'px-panel-head' }, [el('h3', { text: d.care.months[0] ? 'Website report, ' + PX.monthLabel(d.care.months[0]) : 'Monthly website report' })]),
      monthItems.length ? careList(monthItems) : el('p', { text: live ? 'This month\'s report appears here as the work is logged.' : 'Once your site is live, each month you will see the security updates, backups, SEO checks and analytics notes here.' })
    ]);
    var activity = el('ol', { class: 'px-timeline' });
    d.events.slice(0, 8).forEach(function (ev) { activity.appendChild(el('li', {}, [el('time', { text: PX.date(ev.created_at, true) }), ev.message])); });
    main.appendChild(el('div', { class: 'px-two' }, [care, panel([el('div', { class: 'px-panel-head' }, [el('h3', { text: 'Recent activity' })]), activity])]));
  }

  function careList(items) {
    var labels = { security: 'Security', backup: 'Backups', seo: 'SEO', analytics: 'Analytics', maintenance: 'Maintenance', uptime: 'Uptime', change: 'Change', note: 'Note' };
    var ul = el('ul', { class: 'px-care' });
    items.forEach(function (it) {
      ul.appendChild(el('li', {}, [
        el('span', { class: 'px-mono', text: labels[it.category] || it.category }),
        el('span', { text: it.text }),
        it.metric_value ? el('span', { class: 'px-care-metric' }, [it.metric_value, el('small', { text: it.metric_label || '' })]) : el('span')
      ]));
    });
    return ul;
  }

  function nextStep() {
    var d = S.dash;
    var c = d.client;
    var heading;
    var text;
    var actions = [];
    if (c.status === 'cancel_requested') {
      heading = 'Cancellation asked';
      text = 'We have your request and will confirm the last debit date by email.';
    } else if (c.stage === 'brief') {
      var started = Object.keys(S.data || {}).length > 0;
      heading = d.brief.status === 'unlocked' ? 'Your brief is open for changes' : 'Send us your brief';
      text = 'Your logo, photos, colours and services. It saves as you go, so you can do it in more than one sitting.';
      actions.push(button(started ? 'Continue the brief →' : 'Start the brief →', 'btn-primary', function () { show('brief'); }));
    } else if (c.stage === 'building') {
      heading = c.review_round > 0 ? 'Working through your changes' : 'We are building your site';
      text = 'Nothing for you to do right now. We email you when the preview is ready. Thought of something? Send the build team a note.';
      actions.push(button('Send a note', 'btn-outline', function () { show('changes'); }));
    } else if (c.stage === 'review') {
      return reviewPanel();
    } else if (c.stage === 'launching') {
      heading = 'Approved. Going live next';
      text = 'We are connecting your domain and doing the final checks. You will get an email the moment the site is live.';
    } else {
      heading = 'Your site is live';
      text = 'Need something updated? Send a change request. Something broken? Report a problem; fixes never use up your changes.';
      if (c.live_url) { actions.push(el('a', { href: c.live_url, target: '_blank', rel: 'noopener', class: 'btn-outline', text: 'Open your site ↗' })); }
      actions.push(button('Request a change →', 'btn-primary', function () { show('changes'); }));
    }
    return panel([el('div', {}, [el('span', { class: 'px-mono', text: 'Next step' }), el('h3', { class: 'px-mt-12', text: heading }), el('p', { text: text })]),
      actions.length ? el('div', { class: 'px-btn-row' }, actions) : null], 'px-next');
  }

  function reviewPanel() {
    var c = S.dash.client;
    var box = panel([], 'px-next');
    function base() {
      PX.clear(box);
      box.appendChild(el('div', {}, [
        el('span', { class: 'px-mono', text: 'Your turn' }),
        el('h3', { class: 'px-mt-12', text: 'Your preview is ready' }),
        el('p', { text: 'Look at it on your phone and on a computer. Approve it to go live, or list every change you want in one message.' })
      ]));
      box.appendChild(el('div', { class: 'px-btn-row' }, [
        c.preview_url ? el('a', { href: c.preview_url, target: '_blank', rel: 'noopener', class: 'btn-outline', text: 'Open the preview ↗' }) : null,
        button('Ask for changes', 'btn-outline', revise),
        button('Approve it →', 'btn-primary', approve)
      ]));
    }
    function approve(e) {
      var btn = e.currentTarget;
      if (!window.confirm('Approve the preview so we can take it live?')) { return; }
      PX.busy(btn, true, 'Approving');
      PX.api('review_approve', {}).then(function () { PX.toast('Approved. We will email you when it is live.'); load('overview'); })
        .catch(function (err) { PX.busy(btn, false); PX.toast(err.message, true); });
    }
    function revise() {
      PX.clear(box);
      box.classList.remove('px-next');
      var files = [];
      var form = el('form', { novalidate: true }, [
        el('h3', { class: 'u-mb-8', text: 'What should we change?' }),
        el('p', { class: 'u-mb-20', text: 'List everything in one go, page by page. Screenshots help.' }),
        el('div', { class: 'form-group' }, [
          el('label', { class: 'form-label', for: 'rvText', text: 'Changes' }),
          el('textarea', { class: 'form-textarea', id: 'rvText', name: 'details', placeholder: 'Home page: make the phone number bigger.\nServices: add Solar geysers.' })
        ]),
        uploader('change', files, true),
        el('div', { class: 'px-btn-row u-mt-20' }, [button('Cancel', 'btn-outline', function () { box.classList.add('px-next'); base(); }), el('button', { type: 'submit', class: 'btn-primary', text: 'Send the changes →' })])
      ]);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('[type=submit]');
        PX.busy(btn, true, 'Sending');
        PX.api('review_revise', { details: form.details.value, file_ids: files.map(function (f) { return f.id; }) }).then(function () {
          PX.toast('Sent. We will email you when the next preview is ready.');
          load('overview');
        }).catch(function (err) {
          PX.busy(btn, false);
          if (err.data && err.data.fields) { PX.showErrors(form, err.data.fields); } else { PX.toast(err.message, true); }
        });
      });
      box.appendChild(form);
      form.details.focus();
    }
    base();
    return box;
  }

  /* ---------------------------------------------------------------- */
  /* Uploads                                                           */
  /* ---------------------------------------------------------------- */
  /* kind: logo | photo | brand | change. list: array the uploaded files
     are kept in (S.dash.brief.files for the brief, a local array for a
     change request). */
  function uploader(kind, list, local) {
    var wrap = el('div', { class: 'form-group' });
    var grid = el('div', { class: 'px-files' });
    var status = el('div', { class: 'px-upload-status', 'aria-live': 'polite' });
    var input = el('input', { type: 'file', multiple: true, accept: UPLOAD_ACCEPT, 'aria-label': 'Choose files to upload' });
    var drop = el('label', { class: 'px-drop' }, [input, el('strong', { text: 'Drop files here or tap to choose' }), el('span', { text: 'Up to ' + 15 + ' MB each' })]);

    function mine() { return local ? list : list.filter(function (f) { return f.kind === kind; }); }
    function paint() {
      PX.clear(grid);
      mine().forEach(function (f) {
        var thumb = f.is_image ? el('img', { src: PX.fileUrl(f.id, true), alt: '', loading: 'lazy' }) : el('b', { text: (f.name.split('.').pop() || 'file').slice(0, 4) });
        grid.appendChild(el('div', { class: 'px-file' }, [
          el('div', { class: 'px-file-thumb' }, [thumb]),
          el('a', { class: 'px-file-name', href: PX.fileUrl(f.id), title: f.name + ' (' + PX.fileSize(f.size) + ')', text: f.name }),
          el('button', { type: 'button', class: 'px-file-x', 'aria-label': 'Remove ' + f.name, text: '×', onclick: function () { remove(f); } })
        ]));
      });
    }
    function remove(f) {
      PX.api('file_delete', { id: f.id }).then(function () {
        var i = list.indexOf(f);
        if (i > -1) { list.splice(i, 1); }
        paint();
        if (!local) { refreshTabs(); }
      }).catch(function (err) { PX.toast(err.message, true); });
    }
    function send(files) {
      if (!files || !files.length) { return; }
      status.textContent = 'Uploading ' + files.length + ' file' + (files.length === 1 ? '' : 's') + '…';
      PX.upload(kind, files, function (p) { status.textContent = 'Uploading… ' + Math.round(p * 100) + '%'; }).then(function (res) {
        res.files.forEach(function (f) { list.push(f); });
        status.textContent = res.rejected.length ? 'Not uploaded: ' + res.rejected.join('; ') : res.files.length + ' uploaded.';
        paint();
        if (!local) { refreshTabs(); }
      }).catch(function (err) { status.textContent = err.message; });
      input.value = '';
    }
    input.addEventListener('change', function () { send(input.files); });
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('is-over'); }); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); send(e.dataTransfer.files); });
    wrap.appendChild(drop);
    wrap.appendChild(status);
    wrap.appendChild(grid);
    paint();
    return wrap;
  }

  /* ---------------------------------------------------------------- */
  /* Brief                                                             */
  /* ---------------------------------------------------------------- */
  function missing() {
    var d = S.data;
    var files = S.dash.brief.files;
    var p = [];
    if (!str(d, 'business.name')) { p.push(['business', 'Add your business name.']); }
    if (str(d, 'business.description').length < 20) { p.push(['business', 'Tell us what the business does, in a sentence or two.']); }
    if (!(get(d, 'business.services') || []).some(function (s) { return s && s.name && s.name.trim(); })) { p.push(['business', 'Add at least one service or product.']); }
    var logo = str(d, 'brand.logo_status');
    if (!logo) { p.push(['brand', 'Tell us whether you have a logo.']); }
    else if (logo === 'have' && !files.some(function (f) { return f.kind === 'logo'; })) { p.push(['brand', 'Upload your logo, or choose "No logo yet".']); }
    if (!(get(d, 'pages.list') || []).length) { p.push(['pages', 'Pick the pages you want.']); }
    if (!str(d, 'pages.copy_source')) { p.push(['pages', 'Tell us who writes the words on the site.']); }
    if (!str(d, 'contact.phone') && !str(d, 'contact.email')) { p.push(['contact', 'Add a phone number or an email address for the site.']); }
    var dom = str(d, 'contact.domain_status');
    if (!dom) { p.push(['contact', 'Tell us about your domain name.']); }
    else if (dom === 'own' && !str(d, 'contact.domain')) { p.push(['contact', 'Add the domain name you own.']); }
    return p;
  }

  function scheduleSave() {
    clearTimeout(S.saveTimer);
    var tag = document.getElementById('pxSaved');
    if (tag) { tag.textContent = 'Saving soon…'; }
    S.saveTimer = setTimeout(save, 1200);
  }
  function save() {
    clearTimeout(S.saveTimer);
    S.saveTimer = null;
    if (!S.dash || S.dash.brief.status === 'submitted') { return Promise.resolve(); }
    return PX.api('brief_save', { data: S.data }).then(function () {
      S.dash.brief.data = JSON.parse(JSON.stringify(S.data));
      var now = new Date();
      S.savedAt = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
      var tag = document.getElementById('pxSaved');
      if (tag) { tag.textContent = 'Saved ' + S.savedAt; }
    }).catch(function (err) { PX.toast('Not saved: ' + err.message, true); });
  }
  function flushSave() { if (S.saveTimer) { save(); } }
  window.addEventListener('beforeunload', function () { if (S.saveTimer) { save(); } });

  function refreshTabs() {
    var miss = missing();
    document.querySelectorAll('.px-brief-tabs button').forEach(function (b) {
      var id = b.dataset.tab;
      if (id === 'send') { return; }
      var bad = miss.some(function (m) { return m[0] === id; });
      b.classList.toggle('is-missing', bad);
      b.classList.toggle('is-complete', !bad);
    });
  }

  function applyShowIf(form) {
    form.querySelectorAll('[data-showif]').forEach(function (node) {
      var rule = JSON.parse(node.dataset.showif);
      node.classList.toggle('px-hidden', rule[1].indexOf(str(S.data, rule[0])) === -1);
    });
  }

  function fieldNode(f) {
    var id = 'f_' + (f.path || f.kind).replace(/\./g, '_');
    var value = f.path ? get(S.data, f.path) : null;
    var group = el('div', { class: 'form-group' });
    if (f.showIf) { group.dataset.showif = JSON.stringify(f.showIf); }
    var labelText = f.label ? f.label + (f.req ? '' : '') : '';
    var control;

    if (f.type === 'text' || f.type === 'email' || f.type === 'tel' || f.type === 'url' || f.type === 'date') {
      group.appendChild(el('label', { class: 'form-label', for: id, text: labelText }));
      control = el('input', { class: 'form-input', id: id, type: f.type, value: value || '', placeholder: f.placeholder || null, inputmode: f.inputmode || null });
      control.addEventListener('input', function () { set(S.data, f.path, control.value); scheduleSave(); });
      control.addEventListener('blur', refreshTabs);
      group.appendChild(control);
    } else if (f.type === 'textarea') {
      group.appendChild(el('label', { class: 'form-label', for: id, text: labelText }));
      control = el('textarea', { class: 'form-textarea' + (f.small ? ' px-textarea-sm' : ''), id: id, placeholder: f.placeholder || null });
      control.value = value || '';
      control.addEventListener('input', function () { set(S.data, f.path, control.value); scheduleSave(); });
      control.addEventListener('blur', refreshTabs);
      group.appendChild(control);
    } else if (f.type === 'choice') {
      var gid = id + '_l';
      group.appendChild(el('span', { class: 'form-label', id: gid, text: labelText }));
      var choices = el('div', { class: 'px-choices px-choices-wide', role: 'radiogroup', 'aria-labelledby': gid });
      f.options.forEach(function (o) {
        var input = el('input', { type: 'radio', name: id, value: o.value, checked: value === o.value ? true : null });
        input.addEventListener('change', function () { set(S.data, f.path, o.value); applyShowIf(group.closest('form')); refreshTabs(); scheduleSave(); });
        choices.appendChild(el('label', { class: 'px-choice' }, [input, el('span', {}, [o.label, o.hint ? el('small', { text: o.hint }) : null])]));
      });
      group.appendChild(choices);
    } else if (f.type === 'chips') {
      var cid = id + '_l';
      group.appendChild(el('span', { class: 'form-label', id: cid, text: labelText }));
      var chips = el('div', { class: 'px-chips', role: 'group', 'aria-labelledby': cid });
      var current = Array.isArray(value) ? value : [];
      f.options.forEach(function (o) {
        var input = el('input', { type: 'checkbox', value: o, checked: current.indexOf(o) > -1 ? true : null });
        input.addEventListener('change', function () {
          var picked = Array.prototype.filter.call(chips.querySelectorAll('input'), function (i) { return i.checked; }).map(function (i) { return i.value; });
          set(S.data, f.path, picked);
          refreshTabs();
          scheduleSave();
        });
        chips.appendChild(el('label', { class: 'px-chip' }, [input, el('span', { text: o })]));
      });
      group.appendChild(chips);
    } else if (f.type === 'check') {
      var cb = el('input', { type: 'checkbox', id: id, checked: value === true ? true : null });
      cb.addEventListener('change', function () { set(S.data, f.path, cb.checked); scheduleSave(); });
      group.appendChild(el('label', { class: 'px-check' }, [cb, el('span', { text: f.label })]));
    } else if (f.type === 'repeat') {
      if (f.label) { group.appendChild(el('span', { class: 'form-label', text: f.label })); }
      var rows = el('div', { class: 'px-repeat' });
      var items = Array.isArray(value) && value.length ? value : [{}];
      var sync = function () {
        var out = Array.prototype.map.call(rows.querySelectorAll('.px-repeat-row'), function (r) {
          var o = {};
          r.querySelectorAll('input').forEach(function (i) { o[i.dataset.key] = i.value; });
          return o;
        }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k].trim(); }); });
        set(S.data, f.path, out);
        scheduleSave();
      };
      var addRow = function (item) {
        var row = el('div', { class: 'px-repeat-row' });
        f.cols.forEach(function (col) {
          var inp = el('input', { class: 'form-input', value: item[col.key] || '', placeholder: col.placeholder || '', 'aria-label': col.label });
          inp.dataset.key = col.key;
          inp.addEventListener('input', sync);
          inp.addEventListener('blur', refreshTabs);
          row.appendChild(inp);
        });
        row.appendChild(el('button', { type: 'button', class: 'px-repeat-x', 'aria-label': 'Remove this row', text: '×', onclick: function () {
          if (rows.children.length > 1) { row.remove(); } else { row.querySelectorAll('input').forEach(function (i) { i.value = ''; }); }
          sync();
          refreshTabs();
        } }));
        rows.appendChild(row);
      };
      items.forEach(addRow);
      group.appendChild(rows);
      group.appendChild(el('div', { class: 'u-mt-20' }, [button('+ ' + f.add, 'px-link', function () { if (rows.children.length < 30) { addRow({}); rows.lastChild.querySelector('input').focus(); } })]));
    } else if (f.type === 'colours') {
      group.appendChild(el('span', { class: 'form-label', text: f.label }));
      var list = el('div', { class: 'px-colours' });
      var colours = Array.isArray(value) ? value.slice(0, 5) : [];
      var paint = function () {
        PX.clear(list);
        colours.forEach(function (hex, i) {
          var picker = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000', 'aria-label': 'Colour ' + (i + 1) });
          var code = el('code', { text: hex.toUpperCase() });
          picker.addEventListener('input', function () { colours[i] = picker.value; code.textContent = picker.value.toUpperCase(); set(S.data, f.path, colours.slice()); scheduleSave(); });
          list.appendChild(el('span', { class: 'px-colour' }, [picker, code, el('button', { type: 'button', 'aria-label': 'Remove colour', text: '×', onclick: function () { colours.splice(i, 1); set(S.data, f.path, colours.slice()); paint(); scheduleSave(); } })]));
        });
        if (colours.length < 5) {
          list.appendChild(button('+ Add a colour', 'px-link', function () { colours.push('#2EE6FF'); set(S.data, f.path, colours.slice()); paint(); scheduleSave(); }));
        }
      };
      paint();
      group.appendChild(list);
    } else if (f.type === 'upload') {
      group.appendChild(el('span', { class: 'form-label', text: f.label }));
      var up = uploader(f.kind, S.dash.brief.files);
      up.classList.remove('form-group');
      group.appendChild(up);
    }
    if (f.hint) { group.appendChild(el('span', { class: 'px-hint', text: f.hint })); }
    return group;
  }

  function viewBrief(main) {
    var d = S.dash;
    if (d.brief.status === 'submitted') { return briefLocked(main); }
    title(main, 'Your website brief', el('span', { class: 'px-mono', text: 'Saves as you type' }));
    if (d.brief.status === 'unlocked') {
      main.appendChild(el('div', { class: 'px-alert', text: 'We opened your brief so you can change it. Send it again when you are done.' }));
    }
    var tabs = el('div', { class: 'px-brief-tabs', role: 'tablist', 'aria-label': 'Brief sections' });
    var body = el('div');
    BRIEF.forEach(function (sec) {
      tabs.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': sec.id === S.tab ? 'true' : 'false', dataset: { tab: sec.id }, text: sec.title, onclick: function () { flushSave(); S.tab = sec.id; show('brief'); } }));
    });
    main.appendChild(tabs);
    main.appendChild(body);

    var idx = BRIEF.map(function (s) { return s.id; }).indexOf(S.tab);
    var sec = BRIEF[idx] || BRIEF[0];
    var card = panel([]);
    if (sec.id === 'send') {
      briefSend(card);
    } else {
      var form = el('form', { novalidate: true, onsubmit: function (e) { e.preventDefault(); } });
      sec.groups.forEach(function (g) {
        var fs = el('fieldset', { class: 'px-fieldset' }, [el('legend', { text: g.legend }), g.intro ? el('p', { text: g.intro }) : null]);
        var row = null;
        g.fields.forEach(function (f) {
          var node = fieldNode(f);
          if (f.half) {
            if (!row) { row = el('div', { class: 'form-row' }); fs.appendChild(row); }
            row.appendChild(node);
            if (row.children.length === 2) { row = null; }
          } else {
            row = null;
            fs.appendChild(node);
          }
        });
        form.appendChild(fs);
      });
      card.appendChild(form);
      applyShowIf(form);
    }
    body.appendChild(card);

    var prev = BRIEF[idx - 1];
    var next = BRIEF[idx + 1];
    main.appendChild(el('div', { class: 'px-savebar' }, [
      el('span', { class: 'px-saved', id: 'pxSaved', text: S.savedAt ? 'Saved ' + S.savedAt : 'Saves automatically' }),
      el('div', { class: 'px-btn-row' }, [
        prev ? button('← ' + prev.title, 'btn-outline', function () { flushSave(); S.tab = prev.id; show('brief'); window.scrollTo({ top: 0, behavior: 'smooth' }); }) : null,
        next ? button(next.title + ' →', 'btn-primary', function () { flushSave(); S.tab = next.id; show('brief'); window.scrollTo({ top: 0, behavior: 'smooth' }); }) : null
      ])
    ]));
    refreshTabs();
  }

  function summaryNode() {
    var wrap = el('div');
    BRIEF.forEach(function (sec) {
      if (!sec.groups) { return; }
      var dl = el('dl', { class: 'px-summary' });
      sec.groups.forEach(function (g) {
        g.fields.forEach(function (f) {
          var text = '';
          if (f.type === 'upload') {
            var n = S.dash.brief.files.filter(function (x) { return x.kind === f.kind; }).length;
            text = n ? n + ' file' + (n === 1 ? '' : 's') : '';
          } else {
            var v = get(S.data, f.path);
            if (f.type === 'choice') { var o = f.options.filter(function (x) { return x.value === v; })[0]; text = o ? o.label : ''; }
            else if (f.type === 'check') { text = v === true ? 'Yes' : ''; }
            else if (f.type === 'repeat') { text = (v || []).map(function (r) { return f.cols.map(function (c) { return r[c.key]; }).filter(Boolean).join(': '); }).filter(Boolean).join('\n'); }
            else if (Array.isArray(v)) { text = v.join(', '); }
            else if (typeof v === 'string') { text = v.trim(); }
          }
          if (text) { dl.appendChild(el('dt', { text: f.label || g.legend })); dl.appendChild(el('dd', { text: text })); }
        });
      });
      if (dl.children.length) { wrap.appendChild(el('div', { class: 'px-summary-section' }, [el('h4', { text: sec.title }), dl])); }
    });
    return wrap;
  }

  function briefSend(card) {
    var miss = missing();
    if (miss.length) {
      card.appendChild(el('h3', { class: 'u-mb-8', text: 'A few things are still missing' }));
      card.appendChild(el('p', { class: 'u-mb-20', text: 'Fill these in and the brief is ready to send.' }));
      var ul = el('ul', { class: 'px-requests' });
      miss.forEach(function (m) {
        var sec = BRIEF.filter(function (s) { return s.id === m[0]; })[0];
        ul.appendChild(el('li', {}, [el('div', { class: 'px-req-top' }, [el('span', { text: m[1] }), button('Go to ' + sec.title, 'px-link', function () { S.tab = m[0]; show('brief'); })])]));
      });
      card.appendChild(ul);
      return;
    }
    card.appendChild(el('h3', { class: 'u-mb-8', text: 'Check your brief, then send it' }));
    card.appendChild(el('p', { class: 'u-mb-24', text: 'Once it is sent, the build team starts. The brief locks while we build; if you think of something later, send the team a note.' }));
    card.appendChild(summaryNode());
    var btn = button('Send my brief →', 'btn-primary u-mt-32', function () {
      PX.busy(btn, true, 'Sending');
      clearTimeout(S.saveTimer);
      S.saveTimer = null;
      PX.api('brief_submit', { data: S.data }).then(function () {
        PX.toast('Brief sent. The build team has it.');
        S.tab = 'business';
        load('overview');
      }).catch(function (err) {
        PX.busy(btn, false);
        PX.toast(err.data && err.data.missing ? err.data.missing.map(function (m) { return m.message; }).join(' ') : err.message, true);
      });
    });
    card.appendChild(btn);
  }

  function briefLocked(main) {
    var d = S.dash;
    title(main, 'Your website brief', PX.statusPill('submitted'));
    main.appendChild(el('div', { class: 'px-alert' }, [
      'Sent on ' + PX.date(d.brief.submitted_at, true) + '. It is locked while we build. Thought of something? ',
      button('Send the build team a note', 'px-link', function () { show('changes'); })
    ]));
    var files = el('div', { class: 'px-files' });
    d.brief.files.forEach(function (f) {
      files.appendChild(el('div', { class: 'px-file' }, [
        el('div', { class: 'px-file-thumb' }, [f.is_image ? el('img', { src: PX.fileUrl(f.id, true), alt: '', loading: 'lazy' }) : el('b', { text: (f.name.split('.').pop() || 'file').slice(0, 4) })]),
        el('a', { class: 'px-file-name', href: PX.fileUrl(f.id), text: f.name })
      ]));
    });
    main.appendChild(panel([summaryNode(), d.brief.files.length ? el('div', { class: 'u-mt-32' }, [el('h4', { class: 'px-mono u-mb-8', text: 'Files' }), files]) : null]));
  }

  /* ---------------------------------------------------------------- */
  /* Changes                                                           */
  /* ---------------------------------------------------------------- */
  var TYPE_LABEL = { change: 'Change', problem: 'Problem', note: 'Note', revision: 'Preview changes', cancel: 'Cancellation' };

  function requestList(items) {
    var ul = el('ul', { class: 'px-requests' });
    items.forEach(function (r) {
      ul.appendChild(el('li', {}, [
        el('div', { class: 'px-req-top' }, [
          el('div', {}, [el('h4', { text: r.title }), el('div', { class: 'px-req-meta', text: [TYPE_LABEL[r.type] || r.type, PX.date(r.created_at), r.page ? 'Page: ' + r.page : null, r.counts ? 'Counts towards ' + PX.monthLabel(r.month) : null].filter(Boolean).join(' · ') })]),
          PX.statusPill(r.status)
        ]),
        el('div', { class: 'px-req-body', text: r.details }),
        r.files.length ? el('div', { class: 'px-req-meta' }, r.files.map(function (f) { return el('a', { class: 'px-text-link', href: PX.fileUrl(f.id), text: f.name + '  ' }); })) : null,
        r.team_note ? el('div', { class: 'px-req-note', text: 'From the team: ' + r.team_note }) : null
      ]));
    });
    return ul;
  }

  function viewChanges(main) {
    var d = S.dash;
    var live = d.client.stage === 'live';
    var q = d.quota;
    title(main, live ? 'Changes' : 'Notes to the build team', live ? el('span', { class: 'px-mono', text: q.left + ' of ' + q.allowed + ' changes left in ' + PX.monthLabel(q.month) }) : null);

    var files = [];
    var typeChoice = live ? el('div', { class: 'form-group' }, [
      el('span', { class: 'form-label', id: 'rqTypeL', text: 'What is it?' }),
      el('div', { class: 'px-choices px-choices-wide', role: 'radiogroup', 'aria-labelledby': 'rqTypeL' }, [
        el('label', { class: 'px-choice' }, [el('input', { type: 'radio', name: 'type', value: 'change', checked: q.left > 0 ? true : null, disabled: q.left > 0 ? null : true }), el('span', {}, ['A change to my site', el('small', { text: q.left > 0 ? 'Uses 1 of your ' + q.left + ' left this month' : 'None left until ' + PX.date(q.resets_on) })])]),
        el('label', { class: 'px-choice' }, [el('input', { type: 'radio', name: 'type', value: 'problem', checked: q.left > 0 ? null : true }), el('span', {}, ['Something is broken', el('small', { text: 'Fixes never count towards your changes' })])])
      ])
    ]) : el('input', { type: 'hidden', name: 'type', value: 'note' });

    var form = el('form', { novalidate: true }, [
      el('h3', { class: 'u-mb-8', text: live ? 'Ask for something' : 'Send a note' }),
      el('p', { class: 'u-mb-20', text: live ? 'One request per change. Be specific about the page and what should change; it gets done faster.' : 'Thought of something after you sent the brief? Tell the build team here.' }),
      typeChoice,
      el('div', { class: 'form-row' }, [
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'rqTitle', text: 'Short title' }), el('input', { class: 'form-input', id: 'rqTitle', name: 'title', maxlength: '120', placeholder: live ? 'e.g. Update our prices' : 'e.g. New photos coming' })]),
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'rqPage', text: 'Which page?' }), el('input', { class: 'form-input', id: 'rqPage', name: 'page', maxlength: '80', placeholder: 'e.g. Services', list: 'rqPages' }),
          el('datalist', { id: 'rqPages' }, ((get(S.data, 'pages.list') || []).concat(['Whole site'])).map(function (p) { return el('option', { value: p }); }))])
      ]),
      el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'rqDetails', text: 'Details' }), el('textarea', { class: 'form-textarea', id: 'rqDetails', name: 'details', maxlength: '4000' })]),
      el('span', { class: 'form-label', text: 'Files or screenshots (optional)' }),
      uploader('change', files, true),
      el('button', { type: 'submit', class: 'btn-primary u-mt-20', text: 'Send →' })
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type=submit]');
      var body = PX.formData(form);
      body.file_ids = files.map(function (f) { return f.id; });
      PX.busy(btn, true, 'Sending');
      PX.api('request_create', body).then(function () {
        PX.toast(body.type === 'note' ? 'Note sent to the build team.' : 'Sent. You will get an email when it is done.');
        load('changes');
      }).catch(function (err) {
        PX.busy(btn, false);
        if (err.data && err.data.fields) { PX.showErrors(form, err.data.fields); } else { PX.toast(err.message, true); }
      });
    });
    main.appendChild(panel([form]));

    var items = d.requests.filter(function (r) { return r.type !== 'cancel'; });
    main.appendChild(panel([el('div', { class: 'px-panel-head' }, [el('h3', { text: 'Your requests' })]), items.length ? requestList(items) : el('p', { text: 'Nothing sent yet.' })]));
  }

  /* ---------------------------------------------------------------- */
  /* Billing                                                           */
  /* ---------------------------------------------------------------- */
  function viewBilling(main) {
    var d = S.dash;
    var c = d.client;
    title(main, 'Billing');
    var dl = el('dl', { class: 'px-kv' });
    [
      ['Plan', d.plan.name],
      ['Amount', PX.money(c.amount) + ' a month'],
      ['Debit date', 'The ' + Number(c.debit_day) + (['th', 'st', 'nd', 'rd'][Number(c.debit_day) % 10] || 'th') + ' of each month'],
      ['Next debit', c.next_debit_date ? PX.date(c.next_debit_date) : 'None scheduled'],
      ['Debit order', c.mandate_ref || ''],
      ['Bank account', d.bank && d.bank.summary ? d.bank.summary : '']
    ].forEach(function (r) { if (r[1]) { dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1] })); } });

    var bankBtn = button('Change bank details', 'btn-outline', function () {
      if (!window.confirm('You will sign a new debit order for the new account. Continue?')) { return; }
      PX.busy(bankBtn, true, 'Starting');
      PX.api('bank_update', {}).then(function (res) { location.href = res.redirect; }).catch(function (err) { PX.busy(bankBtn, false); PX.toast(err.message, true); });
    });
    main.appendChild(panel([el('div', { class: 'px-panel-head' }, [el('h3', { text: 'Your plan' }), PX.statusPill(c.status)]), dl, el('div', { class: 'px-btn-row u-mt-24' }, [c.mandate_status === 'signed' ? bankBtn : null])]));

    var table = el('table', { class: 'comparison-table' }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: 'Date' }), el('th', { text: 'Amount' }), el('th', { text: 'Status' }), el('th', { text: 'Note' })])]),
      el('tbody', {}, d.payments.map(function (p) {
        return el('tr', {}, [el('td', { text: PX.date(p.date) }), el('td', { 'data-label': 'Amount', text: PX.money(p.amount) }), el('td', { 'data-label': 'Status' }, [PX.statusPill(p.status)]), el('td', { 'data-label': 'Note', text: p.note || '' })]);
      }))
    ]);
    main.appendChild(panel([el('div', { class: 'px-panel-head' }, [el('h3', { text: 'Debits' })]), d.payments.length ? el('div', { class: 'table-wrap' }, [table]) : el('p', { text: 'No debits yet.' })]));

    var cancelBox = panel([]);
    if (c.status === 'cancel_requested') {
      cancelBox.appendChild(el('h3', { class: 'u-mb-8', text: 'Cancellation asked' }));
      cancelBox.appendChild(el('p', { text: 'We have your request and will confirm the last debit date, and what happens to your site and domain, by email.' }));
    } else {
      var reveal = button('Cancel my plan', 'px-link', function () {
        PX.clear(cancelBox);
        var form = el('form', { novalidate: true }, [
          el('h3', { class: 'u-mb-8', text: 'Cancel your plan' }),
          el('p', { class: 'u-mb-20', text: 'Tell us why, if you like. We confirm the last debit date and what happens to your site and domain by email.' }),
          el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'cxWhy', text: 'Reason (optional)' }), el('textarea', { class: 'form-textarea px-textarea-sm', id: 'cxWhy', name: 'reason' })]),
          el('div', { class: 'px-btn-row' }, [button('Keep my plan', 'btn-primary', function () { show('billing'); }), el('button', { type: 'submit', class: 'btn-outline', text: 'Send cancellation request' })])
        ]);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          PX.api('cancel_request', { reason: form.reason.value }).then(function () { PX.toast('Cancellation request sent.'); load('billing'); }).catch(function (err) { PX.toast(err.message, true); });
        });
        cancelBox.appendChild(form);
      });
      cancelBox.appendChild(el('div', { class: 'px-panel-head' }, [el('h3', { text: 'Cancelling' }), reveal]));
      cancelBox.appendChild(el('p', { text: 'You can ask to cancel from here at any time.' }));
    }
    main.appendChild(cancelBox);
  }

  /* ---------------------------------------------------------------- */
  /* Account                                                           */
  /* ---------------------------------------------------------------- */
  function viewAccount(main) {
    var c = S.dash.client;
    title(main, 'Account');
    var profile = el('form', { novalidate: true }, [
      el('h3', { class: 'u-mb-20', text: 'Your details' }),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'acFirst', text: 'First name' }), el('input', { class: 'form-input', id: 'acFirst', name: 'first_name', value: c.first_name, autocomplete: 'given-name' })]),
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'acLast', text: 'Surname' }), el('input', { class: 'form-input', id: 'acLast', name: 'last_name', value: c.last_name, autocomplete: 'family-name' })])
      ]),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'acMobile', text: 'Mobile' }), el('input', { class: 'form-input', id: 'acMobile', name: 'mobile', type: 'tel', value: c.mobile, autocomplete: 'tel' })]),
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'acEmail', text: 'Email' }), el('input', { class: 'form-input', id: 'acEmail', value: c.email, readonly: true }), el('span', { class: 'px-hint', text: 'To change your login email, call us.' })])
      ]),
      el('button', { type: 'submit', class: 'btn-primary', text: 'Save' })
    ]);
    profile.addEventListener('submit', function (e) {
      e.preventDefault();
      PX.api('account_update', PX.formData(profile)).then(function () { PX.toast('Saved.'); load('account'); }).catch(function (err) { PX.toast(err.message, true); });
    });
    var pw = el('form', { novalidate: true }, [
      el('h3', { class: 'u-mb-20', text: 'Change password' }),
      el('div', { class: 'form-row' }, [
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'pwCur', text: 'Current password' }), el('input', { class: 'form-input', id: 'pwCur', name: 'current', type: 'password', autocomplete: 'current-password' })]),
        el('div', { class: 'form-group' }, [el('label', { class: 'form-label', for: 'pwNew', text: 'New password' }), el('input', { class: 'form-input', id: 'pwNew', name: 'password', type: 'password', autocomplete: 'new-password' })])
      ]),
      el('button', { type: 'submit', class: 'btn-outline', text: 'Change password' })
    ]);
    pw.addEventListener('submit', function (e) {
      e.preventDefault();
      PX.api('password_change', PX.formData(pw)).then(function () { PX.toast('Password changed.'); pw.reset(); }).catch(function (err) {
        if (err.data && err.data.fields) { PX.showErrors(pw, err.data.fields); } else { PX.toast(err.message, true); }
      });
    });
    main.appendChild(panel([profile]));
    main.appendChild(panel([pw]));
  }

  /* ---------------------------------------------------------------- */
  /* Boot                                                              */
  /* ---------------------------------------------------------------- */
  PX.onSignedOut = function () { showSignIn('Your session ended. Please sign in again.'); };
  signOutBtn.addEventListener('click', function () {
    flushSave();
    PX.api('logout', {}).then(function () { showSignIn('You are signed out.'); }, function () { showSignIn(); });
  });

  var params = PX.takeHashParams();
  var query = new URLSearchParams(location.search);
  var startView = query.get('view') || 'overview';
  if (params.reset) {
    showReset(params.reset);
  } else {
    PX.api('me').then(function (res) {
      PX.demoBanner(res.mode);
      if (!res.client) { showSignIn(); return; }
      if (query.get('welcome')) {
        startView = 'brief';
        setTimeout(function () { PX.toast('Your login is ready. Start with your brief; it saves as you go.'); }, 400);
      }
      load(startView);
    }).catch(function (err) { PX.clear(root).appendChild(panel([el('h2', { text: 'The portal is not available' }), el('p', { text: err.message })])); });
  }
})();
