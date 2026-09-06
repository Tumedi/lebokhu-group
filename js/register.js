/* ============================================================
   LeBoKhu Group — register.js
   Pre-fill role from ?role=, validate, submit via Web3Forms (AJAX).
   Web3Forms supports file attachments (CV), so the whole form —
   including the CV — is sent in one submission to your email.
   If the access key isn't set yet, it falls back to a friendly
   on-page success message so the form still "works".
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
    var configured = accessKey && accessKey.indexOf('WEB3FORMS_ACCESS_KEY') === -1;
    var first = (document.getElementById('firstName').value || '').trim();

    // If Web3Forms isn't set up yet, show a friendly local success.
    if (!configured) {
      status.textContent = 'Thank you' + (first ? ', ' + first : '') +
        '! Your registration has been captured. (Note: email delivery is not yet connected — ' +
        'add your Web3Forms access key to enable it.)';
      status.className = 'form-status ok';
      form.reset();
      return;
    }

    // Build submission data. FormData(form) automatically includes the file
    // input (name="attachment") and all text fields for Web3Forms.
    var data = new FormData(form);

    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';

    fetch(form.getAttribute('action'), {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      return res.json().then(function (d) { return { ok: res.ok, data: d }; });
    }).then(function (r) {
      if (r.ok && r.data.success) {
        status.textContent = 'Thank you' + (first ? ', ' + first : '') +
          '! Your registration' + (cv && cv.files.length ? ' and CV have' : ' has') +
          ' been submitted. Our team will be in touch soon.';
        status.className = 'form-status ok';
        form.reset();
        var hint = cv && cv.parentNode.querySelector('.hint');
        if (hint) hint.innerHTML = 'Max file size 5&nbsp;MB. No CV? No problem — you can still register.';
      } else {
        throw new Error((r.data && r.data.message) || 'Submission failed');
      }
    }).catch(function (err) {
      status.textContent = 'Sorry, something went wrong: ' + err.message +
        '. Please try again or email us directly at Tbmadihlaba@gmail.com.';
      status.className = 'form-status bad';
    }).finally(function () {
      btn.disabled = false; btn.textContent = original;
    });
  });
})();
