/* ============================================================
   LeBoKhu Group — services-directory.js
   Public directory of APPROVED service providers. Homeowners
   search/filter, view contact details, and submit a request
   (open — no login required). Requests save to the DB and
   trigger an email to the admin + provider (Resend, optional).
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.LEBOKHU_SUPABASE;
  var listEl = document.getElementById('providerList');
  var countEl = document.getElementById('resultsCount');
  var noRes = document.getElementById('noResults');
  var searchEl = document.getElementById('search');
  var serviceEl = document.getElementById('service');
  var locEl = document.getElementById('loc');

  var PROVIDERS = [];
  var VIEW = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function digits(s) { return String(s || '').replace(/[^0-9+]/g, ''); }

  function providerCard(p, idx) {
    var phone = p.phone ? '<a class="prov-contact" href="tel:' + esc(digits(p.phone)) + '">📞 ' + esc(p.phone) + '</a>' : '';
    var wa = p.whatsapp ? '<a class="prov-contact" target="_blank" rel="noopener" href="https://wa.me/' + esc(digits(p.whatsapp).replace(/^0/, '27')) + '">💬 WhatsApp</a>' : '';
    return '' +
      '<article class="provider-card">' +
        '<div class="prov-head">' +
          '<span class="prov-avatar">' + esc((p.full_name || '?').charAt(0).toUpperCase()) + '</span>' +
          '<div>' +
            '<h3>' + esc(p.full_name) + '</h3>' +
            '<span class="badge badge-level">' + esc(p.service) + '</span>' +
          '</div>' +
        '</div>' +
        '<p class="prov-meta">' +
          (p.location ? '<span>📍 ' + esc(p.location) + '</span>' : '') +
          (p.rate ? '<span>💰 ' + esc(p.rate) + '</span>' : '') +
          (p.experience ? '<span>🧰 ' + esc(p.experience) + '</span>' : '') +
        '</p>' +
        (p.bio ? '<p class="prov-bio">' + esc(p.bio) + '</p>' : '') +
        '<div class="prov-actions">' +
          phone + wa +
          '<button class="btn btn-primary btn-sm" data-req="' + idx + '">Request Service</button>' +
        '</div>' +
      '</article>';
  }

  function render() {
    var s = (searchEl.value || '').trim().toLowerCase();
    var service = serviceEl.value;
    var loc = (locEl.value || '').trim().toLowerCase();

    VIEW = PROVIDERS.filter(function (p) {
      if (service && p.service !== service) return false;
      if (loc && (p.location || '').toLowerCase().indexOf(loc) === -1) return false;
      if (s && (p.full_name + ' ' + p.service + ' ' + (p.bio || '')).toLowerCase().indexOf(s) === -1) return false;
      return true;
    });

    listEl.innerHTML = VIEW.map(providerCard).join('');
    countEl.textContent = VIEW.length + (VIEW.length === 1 ? ' provider' : ' providers') + ' found';
    noRes.hidden = VIEW.length !== 0;

    listEl.querySelectorAll('[data-req]').forEach(function (btn) {
      btn.addEventListener('click', function () { openRequest(VIEW[parseInt(btn.getAttribute('data-req'), 10)]); });
    });
  }

  function load() {
    if (!CFG || !CFG.isConfigured()) {
      countEl.textContent = '';
      noRes.hidden = false;
      noRes.querySelector('p').textContent = 'The services directory isn\'t connected yet.';
      return;
    }
    var client = CFG.client();
    countEl.textContent = 'Loading…';
    client.from(CFG.PROVIDERS_TABLE).select('*').eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Error loading providers: ' + res.error.message; return; }
        PROVIDERS = res.data || [];
        render();
      });
  }

  [searchEl, serviceEl, locEl].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  /* ---- Request a service modal ---- */
  var modal = document.getElementById('reqModal');
  var reqProvider = document.getElementById('reqProvider');
  var reqForm = document.getElementById('reqForm');
  var reqStatus = document.getElementById('reqStatus');
  var currentProvider = null;
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function openRequest(p) {
    currentProvider = p;
    reqProvider.textContent = (p.full_name || '') + ' — ' + (p.service || '');
    reqStatus.textContent = ''; reqStatus.className = 'form-status';
    reqForm.reset();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeRequest() { modal.hidden = true; document.body.style.overflow = ''; }
  modal.querySelectorAll('[data-rclose]').forEach(function (el) { el.addEventListener('click', closeRequest); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeRequest(); });

  reqForm.querySelectorAll('input,textarea').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  reqForm.addEventListener('submit', function (e) {
    e.preventDefault();
    reqStatus.textContent = ''; reqStatus.className = 'form-status';
    if (!currentProvider) return;

    var name = document.getElementById('hName');
    var phone = document.getElementById('hPhone');
    var email = document.getElementById('hEmail');
    var loc = document.getElementById('hLocation');
    var details = document.getElementById('hDetails');

    var ok = true;
    [name, phone, details].forEach(function (f) { if (!f.value.trim()) { f.classList.add('err'); ok = false; } });
    if (email.value.trim() && !emailRe.test(email.value.trim())) { email.classList.add('err'); ok = false; }
    if (!ok) {
      reqStatus.textContent = 'Please complete the required fields (name, phone, details).';
      reqStatus.className = 'form-status bad';
      return;
    }

    var client = CFG.client();
    var record = {
      provider_id: currentProvider.id,
      provider_name: currentProvider.full_name || '',
      service: currentProvider.service || '',
      homeowner_name: name.value.trim(),
      homeowner_email: email.value.trim(),
      homeowner_phone: phone.value.trim(),
      location: loc.value.trim(),
      details: details.value.trim(),
      status: 'new'
    };

    var btn = reqForm.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';

    client.from(CFG.REQUESTS_TABLE).insert([record]).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      // Fire notification email (optional Edge Function) — non-blocking
      sendRequestEmail(record, currentProvider);
      reqStatus.textContent = 'Thank you, ' + record.homeowner_name +
        '! Your request has been sent. ' + (currentProvider.full_name || 'The provider') +
        ' or our team will contact you soon.';
      reqStatus.className = 'form-status ok';
      reqForm.reset();
      setTimeout(closeRequest, 2500);
    }).catch(function (err) {
      reqStatus.textContent = 'Sorry, could not send: ' + err.message +
        '. Please try again or call ' + (currentProvider.phone || 'us') + '.';
      reqStatus.className = 'form-status bad';
    }).then(function () {
      btn.disabled = false; btn.textContent = original;
    });
  });

  function sendRequestEmail(record, provider) {
    var client = CFG.client();
    if (!client || !client.functions) return;
    client.functions.invoke('send-service-request-email', {
      body: {
        provider_email: provider.email || '',
        provider_name: provider.full_name || '',
        service: record.service,
        homeowner_name: record.homeowner_name,
        homeowner_phone: record.homeowner_phone,
        homeowner_email: record.homeowner_email,
        location: record.location,
        details: record.details
      }
    }).catch(function () { /* non-blocking */ });
  }

  load();
})();
