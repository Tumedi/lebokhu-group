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

    // Build submission data (text fields only). CVs are uploaded separately
    // via the Google Form, so there is no file field to send here.
    var data = new FormData();
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') { data.append(el.name, el.checked ? 'Yes' : 'No'); return; }
      data.append(el.name, el.value);
    });

    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';

    fetch(endpoint, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (res.ok) {
        status.innerHTML = 'Thank you' + (first ? ', ' + first : '') +
          '! Your registration has been submitted. Our team will be in touch soon. ' +
          'If you haven\'t already, please <a href="https://docs.google.com/forms/d/e/1FAIpQLSfMy4Tgo0wbgp8jnhMjEyZ5nbfeJKyI2hQWGmVLGGtd16yVKA/viewform" target="_blank" rel="noopener">upload your CV</a>.';
        status.className = 'form-status ok';
        form.reset();
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
