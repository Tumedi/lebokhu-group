/* ============================================================
   LeKhuBo Connect — reset-password.js
   Handles the password-recovery flow. The user arrives here from
   the link in their reset email; Supabase establishes a temporary
   recovery session, then we let them set a new password.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('resetForm');
  if (!form) return;

  var checking = document.getElementById('checking');
  var fields = document.getElementById('resetFields');
  var invalid = document.getElementById('invalidLink');
  var status = document.getElementById('resetStatus');

  if (!(window.LEBOKHU_AUTH && window.LEBOKHU_AUTH.configured())) {
    document.getElementById('notConfigured').hidden = false;
    checking.hidden = true;
    return;
  }

  var client = window.LEBOKHU_AUTH.client();
  var canReset = false;

  function showFields() {
    checking.hidden = true;
    invalid.hidden = true;
    fields.hidden = false;
    canReset = true;
  }
  function showInvalid() {
    checking.hidden = true;
    fields.hidden = true;
    invalid.hidden = false;
    canReset = false;
  }

  // Supabase fires PASSWORD_RECOVERY when the recovery link is processed.
  client.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') showFields();
  });

  // Also check if a session already exists (link processed before listener attached).
  client.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    // Give the recovery event a brief chance to fire; if we already have a
    // session (recovery), allow reset. Otherwise, show invalid after a short wait.
    if (session) {
      showFields();
    } else {
      setTimeout(function () { if (!canReset) showInvalid(); }, 2500);
    }
  });

  form.querySelectorAll('input').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = ''; status.className = 'form-status';
    if (!canReset) return;

    var p1 = document.getElementById('password');
    var p2 = document.getElementById('password2');
    var v1 = p1.value, v2 = p2.value;

    var ok = true;
    if (!v1 || v1.length < 6) { p1.classList.add('err'); ok = false; }
    if (v2 !== v1) { p2.classList.add('err'); ok = false; }
    if (!ok) {
      status.textContent = (v1.length < 6)
        ? 'Password must be at least 6 characters.'
        : 'The two passwords do not match.';
      status.className = 'form-status bad';
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Updating…';

    client.auth.updateUser({ password: v1 })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        status.innerHTML = '✓ Your password has been updated! Redirecting you to log in…';
        status.className = 'form-status ok';
        fields.hidden = true;
        // Sign out the temporary recovery session, then send to login
        return client.auth.signOut();
      })
      .then(function () {
        if (status.className.indexOf('ok') !== -1) {
          setTimeout(function () { location.href = 'login.html'; }, 1800);
        }
      })
      .catch(function (err) {
        status.textContent = 'Could not update password: ' + err.message;
        status.className = 'form-status bad';
        btn.disabled = false; btn.textContent = original;
      });
  });
})();
