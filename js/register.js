/* ============================================================
   LeKhuBo Connect — register.js
   On submit:
     1. Upload CV to Supabase Storage (if provided)
     2. Save the registration row to the Supabase database
     3. Send a Web3Forms email alert (with CV attachment)
   The database is the source of truth for reporting; the email
   is a real-time alert. Each part degrades gracefully if not
   configured, so the form always gives the user feedback.
   Also pre-fills the role from ?role= and validates input.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('regForm');
  if (!form) return;
  var status = document.getElementById('regStatus');
  var MAX_FILE_BYTES = 5 * 1024 * 1024; // Web3Forms free tier: 5 MB total

  /* ---- Pre-fill "Applying for" from ?role= ---- */
  try {
    var params = new URLSearchParams(window.location.search);
    var role = params.get('role');
    if (role) {
      document.getElementById('applyRoleText').textContent = role;
      document.getElementById('applyingFor').value = role;
      document.getElementById('applyBanner').hidden = false;
    }
  } catch (e) { /* ignore */ }

  /* ---- Show selected CV filename hint ---- */
  var cv = document.getElementById('cv');
  if (cv) {
    cv.addEventListener('change', function () {
      var hint = cv.parentNode.querySelector('.hint');
      if (cv.files && cv.files.length) {
        var kb = Math.round(cv.files[0].size / 1024);
        hint.innerHTML = 'Selected: <strong>' + cv.files[0].name + '</strong> (' +
          (kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB') + ')';
      }
    });
  }

  /* ---- Clear errors on input ---- */
  form.querySelectorAll('input,select,textarea').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate() {
    var valid = true;
    form.querySelectorAll('[required]').forEach(function (field) {
      var ok;
      if (field.type === 'checkbox') ok = field.checked;
      else ok = field.value.trim() !== '';
      if (field.type === 'email' && ok) ok = emailRe.test(field.value.trim());
      field.classList.toggle('err', !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';

    if (!validate()) {
      status.textContent = 'Please complete all required fields correctly.';
      status.className = 'form-status bad';
      return;
    }

    // File size guard (avoids a confusing server rejection)
    if (cv && cv.files && cv.files.length && cv.files[0].size > MAX_FILE_BYTES) {
      cv.classList.add('err');
      status.textContent = 'Your CV is larger than 5 MB. Please upload a smaller file, or email it to Tbmadihlaba@gmail.com.';
      status.className = 'form-status bad';
      return;
    }

    var accessKey = (form.querySelector('input[name="access_key"]') || {}).value || '';
    var emailConfigured = accessKey && accessKey.indexOf('WEB3FORMS_ACCESS_KEY') === -1;
    var dbConfigured = window.LEBOKHU_SUPABASE && window.LEBOKHU_SUPABASE.isConfigured();
    var first = (document.getElementById('firstName').value || '').trim();

    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';

    // Gather the field values once
    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    var record = {
      first_name: val('firstName'),
      last_name: val('lastName'),
      email: val('email'),
      phone: val('phone'),
      location: val('location'),
      right_to_work: val('idType'),
      qualification: val('qualLevel'),
      experience: val('expLevel'),
      preferred_sector: val('sector'),
      skills: val('skills'),
      applying_for: (document.getElementById('applyingFor') || {}).value || '',
      consent: (document.getElementById('consent') || {}).checked || false
    };

    // ---- Step 1: upload CV to Supabase Storage (if any) ----
    function uploadCv() {
      if (!dbConfigured || !cv || !cv.files || !cv.files.length) return Promise.resolve(null);
      var client = window.LEBOKHU_SUPABASE.client();
      if (!client) return Promise.resolve(null);
      var file = cv.files[0];
      var safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + safe;
      return client.storage.from(window.LEBOKHU_SUPABASE.BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false })
        .then(function (res) {
          if (res.error) { console.warn('CV upload failed:', res.error.message); return null; }
          var pub = client.storage.from(window.LEBOKHU_SUPABASE.BUCKET).getPublicUrl(path);
          return { url: (pub.data && pub.data.publicUrl) || null, name: file.name };
        }).catch(function () { return null; });
    }

    // ---- Step 2: insert row into the database ----
    function saveToDb(cvInfo) {
      if (!dbConfigured) return Promise.resolve({ skipped: true });
      var client = window.LEBOKHU_SUPABASE.client();
      if (!client) return Promise.resolve({ skipped: true });
      if (cvInfo) { record.cv_url = cvInfo.url; record.cv_filename = cvInfo.name; }
      return client.from(window.LEBOKHU_SUPABASE.TABLE).insert([record])
        .then(function (res) {
          if (res.error) throw new Error('Database: ' + res.error.message);
          return { saved: true };
        });
    }

    // ---- Step 3: send Web3Forms email alert (includes CV attachment) ----
    function sendEmail() {
      if (!emailConfigured) return Promise.resolve({ skipped: true });
      return fetch(form.getAttribute('action'), {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        return res.json().then(function (d) { return { ok: res.ok && d.success, data: d }; });
      }).catch(function () { return { ok: false }; });
    }

    // ---- Step 4: send the applicant a "thanks for registering" email ----
    // (Automatic, via the Supabase Edge Function + Resend. Non-blocking:
    //  if it isn't deployed, we simply skip it — the DB save is what matters.)
    function sendWelcome() {
      if (!dbConfigured) return Promise.resolve({ skipped: true });
      var client = window.LEBOKHU_SUPABASE.client();
      if (!client || !client.functions || !record.email) return Promise.resolve({ skipped: true });
      return client.functions.invoke('send-welcome-email', {
        body: {
          email: record.email,
          first_name: record.first_name,
          preferred_sector: record.preferred_sector,
          applying_for: record.applying_for,
          has_cv: !!(cv && cv.files && cv.files.length)
        }
      }).then(function (res) {
        return { ok: res && !res.error && res.data && res.data.success };
      }).catch(function () { return { ok: false }; });
    }

    // ---- Orchestrate: DB first (source of truth), then the emails ----
    uploadCv()
      .then(saveToDb)
      .then(function (dbResult) {
        // Fire both emails; don't fail the whole thing if either hiccups
        return Promise.all([sendEmail(), sendWelcome()]).then(function () { return dbResult; });
      })
      .then(function (dbResult) {
        if (dbResult && dbResult.skipped && !emailConfigured) {
          // Nothing is connected yet
          status.textContent = 'Thank you' + (first ? ', ' + first : '') +
            '! Your registration has been captured. (Note: storage/email are not connected yet.)';
        } else {
          status.textContent = 'Thank you' + (first ? ', ' + first : '') +
            '! Your registration' + (cv && cv.files.length ? ' and CV have' : ' has') +
            ' been submitted. Our team will be in touch soon.';
        }
        status.className = 'form-status ok';
        form.reset();
        var hint = cv && cv.parentNode.querySelector('.hint');
        if (hint) hint.innerHTML = 'Max file size 5&nbsp;MB. No CV? No problem — you can still register.';
      })
      .catch(function (err) {
        status.textContent = 'Sorry, something went wrong: ' + err.message +
          '. Please try again or email us directly at Tbmadihlaba@gmail.com.';
        status.className = 'form-status bad';
      })
      .then(function () {
        btn.disabled = false; btn.textContent = original;
      });
  });
})();
