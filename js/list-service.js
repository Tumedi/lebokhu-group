/* ============================================================
   LeBoKhu Group — list-service.js
   Service provider lists/updates their service. Requires a
   logged-in 'provider'. Saves to service_providers (status pending).
   If the provider already has a listing, it loads it for editing.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('serviceForm');
  if (!form) return;
  var status = document.getElementById('serviceStatus');

  var AUTH = window.LEBOKHU_AUTH;
  if (!(AUTH && AUTH.configured())) {
    document.getElementById('notConfigured').hidden = false;
    form.querySelectorAll('input,select,textarea,button').forEach(function (el) { el.disabled = true; });
    return;
  }

  var CFG = window.LEBOKHU_SUPABASE;
  var client = AUTH.client();
  var profile = null;
  var existingId = null;

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function setVal(id, v) { var el = document.getElementById(id); if (el && v != null) el.value = v; }

  AUTH.requireAuth('provider').then(function (ctx) {
    profile = ctx.profile;
    AUTH.renderHeader('#mainNav');
    // Prefill name; load existing listing if any
    if (profile.full_name) setVal('fullName', profile.full_name);
    if (profile.phone) setVal('phone', profile.phone);
    return client.from(CFG.PROVIDERS_TABLE).select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(1);
  }).then(function (res) {
    if (res && res.data && res.data.length) {
      var p = res.data[0];
      existingId = p.id;
      setVal('fullName', p.full_name); setVal('service', p.service); setVal('location', p.location);
      setVal('phone', p.phone); setVal('whatsapp', p.whatsapp); setVal('rate', p.rate);
      setVal('experience', p.experience); setVal('bio', p.bio);
      var s = form.querySelector('button[type="submit"]'); if (s) s.textContent = 'Update Listing';
      status.textContent = 'You already have a listing (' + (p.status || 'pending') + '). Edit and resubmit below.';
      status.className = 'form-status';
    }
  }).catch(function () { /* requireAuth redirected, or no listing */ });

  form.querySelectorAll('input,select,textarea').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  function validate() {
    var valid = true;
    form.querySelectorAll('[required]').forEach(function (field) {
      var ok = field.value.trim() !== '';
      field.classList.toggle('err', !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = ''; status.className = 'form-status';
    if (!profile) return;
    if (!validate()) {
      status.textContent = 'Please complete all required fields.';
      status.className = 'form-status bad';
      return;
    }

    var record = {
      user_id: profile.id,
      full_name: val('fullName'),
      service: val('service'),
      location: val('location'),
      phone: val('phone'),
      whatsapp: val('whatsapp'),
      email: profile.email || '',
      rate: val('rate'),
      experience: val('experience'),
      bio: val('bio'),
      status: 'pending'  // resubmitting sends it back to review
    };

    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Submitting…';

    var op = existingId
      ? client.from(CFG.PROVIDERS_TABLE).update(record).eq('id', existingId)
      : client.from(CFG.PROVIDERS_TABLE).insert([record]);

    op.then(function (res) {
      if (res.error) throw new Error(res.error.message);
      status.innerHTML = '✓ Your service listing has been submitted for review. ' +
        'Track it under <a href="my-services.html">My Services</a>.';
      status.className = 'form-status ok';
      setTimeout(function () { location.href = 'my-services.html'; }, 1500);
    }).catch(function (err) {
      status.textContent = 'Sorry, could not submit: ' + err.message;
      status.className = 'form-status bad';
      btn.disabled = false; btn.textContent = original;
    });
  });
})();
