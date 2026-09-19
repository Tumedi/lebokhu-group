/* ============================================================
   LeKhuBo Connect — post-job.js
   A logged-in "Potential Employer" (role 'homeowner') posts a job.
   Saves to the job_posts table as status:'pending' (goes live after
   admin approval). Stamped with the poster's user_id.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('jobForm');
  if (!form) return;
  var status = document.getElementById('jobStatus');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var AUTH = window.LEBOKHU_AUTH;
  var CFG = window.LEBOKHU_SUPABASE;

  if (!(AUTH && AUTH.configured())) {
    document.getElementById('notConfigured').hidden = false;
    form.querySelectorAll('input,select,textarea,button').forEach(function (el) { el.disabled = true; });
    return;
  }

  var currentProfile = null;

  // Require a logged-in Potential Employer (homeowner). requireAuth redirects
  // guests to login and other roles to their own dashboard.
  AUTH.requireAuth('homeowner').then(function (ctx) {
    currentProfile = ctx.profile;
    AUTH.renderHeader('#mainNav');
    // Pre-fill contact details from the profile.
    if (currentProfile) {
      var company = document.getElementById('company');
      var cn = document.getElementById('contactName');
      var ce = document.getElementById('contactEmail');
      var cp = document.getElementById('contactPhone');
      if (company && !company.value && currentProfile.full_name) company.value = currentProfile.full_name;
      if (cn && !cn.value && currentProfile.full_name) cn.value = currentProfile.full_name;
      if (ce && !ce.value && currentProfile.email) ce.value = currentProfile.email;
      if (cp && !cp.value && currentProfile.phone) cp.value = currentProfile.phone;
    }
  }).catch(function () { /* requireAuth redirected */ });

  form.querySelectorAll('input,select,textarea').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  function validate() {
    var ok = true;
    form.querySelectorAll('[required]').forEach(function (field) {
      var good = field.value.trim() !== '';
      if (field.type === 'email' && good) good = emailRe.test(field.value.trim());
      field.classList.toggle('err', !good);
      if (!good) ok = false;
    });
    return ok;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = ''; status.className = 'form-status';

    if (!validate()) {
      status.textContent = 'Please complete all required fields correctly.';
      status.className = 'form-status bad';
      return;
    }

    var client = AUTH.client();
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
      status: 'pending',
      user_id: currentProfile ? currentProfile.id : null
    };

    client.from(CFG.POSTS_TABLE).insert([record]).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      status.innerHTML = '✓ Thank you! Your job post has been submitted and will appear once our ' +
        'team approves it. You can <a href="post-job.html">post another</a> or ' +
        '<a href="employer-jobs.html">view current jobs</a>.';
      status.className = 'form-status ok';
      form.reset();
    }).catch(function (err) {
      status.textContent = 'Could not submit your job post: ' + err.message;
      status.className = 'form-status bad';
    }).then(function () {
      btn.disabled = false; btn.textContent = original;
    });
  });
})();
