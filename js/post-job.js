/* ============================================================
   LeBoKhu Group — post-job.js
   Employer job posting. On submit:
     1. Save the post to the Supabase job_posts table (status: pending)
     2. Send a Web3Forms email alert
   Degrades gracefully if either isn't configured.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('jobForm');
  if (!form) return;
  var status = document.getElementById('jobStatus');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  form.querySelectorAll('input,select,textarea').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  function validate() {
    var valid = true;
    form.querySelectorAll('[required]').forEach(function (field) {
      var ok = field.value.trim() !== '';
      if (field.type === 'email' && ok) ok = emailRe.test(field.value.trim());
      field.classList.toggle('err', !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';

    if (!validate()) {
      status.textContent = 'Please complete all required fields correctly.';
      status.className = 'form-status bad';
      return;
    }

    var accessKey = (form.querySelector('input[name="access_key"]') || {}).value || '';
    var emailConfigured = accessKey && accessKey.indexOf('WEB3FORMS_ACCESS_KEY') === -1;
    var dbConfigured = window.LEBOKHU_SUPABASE && window.LEBOKHU_SUPABASE.isConfigured();
    var company = val('company');

    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Submitting…';

    var record = {
      company: val('company'),
      contact_name: val('contactName'),
      contact_email: val('contactEmail'),
      contact_phone: val('contactPhone'),
      title: val('title'),
      sector: val('sector'),
      level: val('level'),
      location: val('location'),
      job_type: val('jobType'),
      description: val('description'),
      closing_date: val('closingDate') || null,
      status: 'pending'
    };

    function saveToDb() {
      if (!dbConfigured) return Promise.resolve({ skipped: true });
      var client = window.LEBOKHU_SUPABASE.client();
      if (!client) return Promise.resolve({ skipped: true });
      return client.from(window.LEBOKHU_SUPABASE.POSTS_TABLE).insert([record])
        .then(function (res) {
          if (res.error) throw new Error('Database: ' + res.error.message);
          return { saved: true };
        });
    }

    // Web3Forms alert to YOU (the admin)
    function sendEmail() {
      if (!emailConfigured) return Promise.resolve({ skipped: true });
      return fetch(form.getAttribute('action'), {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        return res.json().then(function (d) { return { ok: res.ok && d.success }; });
      }).catch(function () { return { ok: false }; });
    }

    // "We've received your post" confirmation to the EMPLOYER
    // (Automatic, via the Supabase Edge Function + Resend. Non-blocking:
    //  skipped if the function isn't deployed.)
    function sendReceipt() {
      if (!dbConfigured) return Promise.resolve({ skipped: true });
      var client = window.LEBOKHU_SUPABASE.client();
      if (!client || !client.functions || !record.contact_email) return Promise.resolve({ skipped: true });
      return client.functions.invoke('send-post-received-email', {
        body: {
          contact_email: record.contact_email,
          contact_name: record.contact_name,
          company: record.company,
          title: record.title,
          sector: record.sector,
          location: record.location,
          job_type: record.job_type
        }
      }).then(function (res) {
        return { ok: res && !res.error && res.data && res.data.success };
      }).catch(function () { return { ok: false }; });
    }

    saveToDb()
      .then(function (dbResult) {
        // Fire both emails; don't fail the submission if either hiccups
        return Promise.all([sendEmail(), sendReceipt()]).then(function () { return dbResult; });
      })
      .then(function (dbResult) {
        if (dbResult && dbResult.skipped && !emailConfigured) {
          status.textContent = 'Thank you! Your job post has been captured. ' +
            '(Note: storage/email are not connected yet.)';
        } else {
          status.textContent = 'Thank you' + (company ? ', ' + company : '') +
            '! Your job post has been submitted for review. Our team will be in touch shortly.';
        }
        status.className = 'form-status ok';
        form.reset();
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
