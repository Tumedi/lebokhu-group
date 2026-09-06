/* ============================================================
   LeBoKhu Group — register.js
   Pre-fill role from ?role=, validate, submit via Formspree (AJAX).
   If the Formspree endpoint isn't configured yet, it falls back to
   a friendly on-page success message so the form still "works".
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('regForm');
  if (!form) return;
  var status = document.getElementById('regStatus');

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
      if (cv.files && cv.files.length) hint.textContent = 'Selected: ' + cv.files[0].name;
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

    var endpoint = form.getAttribute('action') || '';
    var configured = endpoint.indexOf('YOUR_FORM_ID') === -1 && endpoint.indexOf('formspree.io') !== -1;
    var first = (document.getElementById('firstName').value || '').trim();

    // If Formspree isn't set up yet, show a friendly local success.
    if (!configured) {
      status.textContent = 'Thank you' + (first ? ', ' + first : '') +
        '! Your registration has been captured. (Note: email delivery is not yet connected — ' +
        'add your Formspree endpoint to enable it.)';
      status.className = 'form-status ok';
      form.reset();
      return;
    }

    // Build submission data WITHOUT the file field.
    // (The free Formspree plan rejects file uploads, which would fail the
    //  whole submission — so we send text fields only and handle the CV
    //  separately by asking the applicant to email it.)
    var data = new FormData();
    var hasCv = false, cvName = '';
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'file') {
        if (el.files && el.files.length) { hasCv = true; cvName = el.files[0].name; }
        return; // never append the file itself
      }
      if (el.type === 'checkbox') { data.append(el.name, el.checked ? 'Yes' : 'No'); return; }
      data.append(el.name, el.value);
    });
    // Record whether a CV exists so you know to expect it by email
    data.append('cv_status', hasCv ? ('Applicant will email CV: ' + cvName) : 'No CV attached');

    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';

    fetch(endpoint, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (res.ok) {
        var msg = 'Thank you' + (first ? ', ' + first : '') +
          '! Your registration has been submitted. Our team will be in touch soon.';
        if (hasCv) {
          var subject = encodeURIComponent('CV — ' + first + ' ' +
            (document.getElementById('lastName').value || '').trim());
          msg += ' To include your CV, please email it to ' +
            '<a href="mailto:Tbmadihlaba@gmail.com?subject=' + subject + '">Tbmadihlaba@gmail.com</a>.';
        }
        status.innerHTML = msg;
        status.className = 'form-status ok';
        form.reset();
        var hint = cv && cv.parentNode.querySelector('.hint');
        if (hint) hint.textContent = 'No CV? No problem — you can still register. We\'ll help you build one.';
      } else {
        return res.json().then(function (d) { throw new Error((d.errors && d.errors[0] && d.errors[0].message) || 'Submission failed'); });
      }
    }).catch(function (err) {
      status.textContent = 'Sorry, something went wrong: ' + err.message + '. Please try again or email us directly at Tbmadihlaba@gmail.com.';
      status.className = 'form-status bad';
    }).finally(function () {
      btn.disabled = false; btn.textContent = original;
    });
  });
})();
