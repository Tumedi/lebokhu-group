/* ============================================================
   LeBoKhu Group — login.js
   Email/password login. Redirects to ?next= or the role dashboard.
   Also handles "forgot password".
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('loginForm');
  if (!form) return;
  var status = document.getElementById('loginStatus');

  if (!(window.LEBOKHU_AUTH && window.LEBOKHU_AUTH.configured())) {
    document.getElementById('notConfigured').hidden = false;
    form.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
    return;
  }

  var client = window.LEBOKHU_AUTH.client();

  function nextParam() {
    try { return new URLSearchParams(location.search).get('next'); } catch (e) { return null; }
  }

  // Already logged in? Go straight to destination.
  window.LEBOKHU_AUTH.getProfile().then(function (p) {
    if (p) redirectAfterLogin(p);
  });

  function redirectAfterLogin(profile) {
    var next = nextParam();
    if (next) { location.href = next; return; }
    location.href = window.LEBOKHU_AUTH.dashboardFor(profile && profile.role).href;
  }

  form.querySelectorAll('input').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = ''; status.className = 'form-status';
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    if (!email || !password) {
      status.textContent = 'Please enter your email and password.';
      status.className = 'form-status bad';
      return;
    }
    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Logging in…';

    client.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return window.LEBOKHU_AUTH.getProfile(true);
      })
      .then(function (profile) { redirectAfterLogin(profile); })
      .catch(function (err) {
        var msg = err.message || 'Login failed';
        if (/confirm/i.test(msg)) msg = 'Please confirm your email first (check your inbox), then log in.';
        status.textContent = 'Login failed: ' + msg;
        status.className = 'form-status bad';
        btn.disabled = false; btn.textContent = original;
      });
  });

  // Forgot password
  var forgot = document.getElementById('forgotLink');
  if (forgot) {
    forgot.addEventListener('click', function (e) {
      e.preventDefault();
      var email = (document.getElementById('email').value || '').trim();
      if (!email) {
        status.textContent = 'Enter your email above first, then click "Forgot password".';
        status.className = 'form-status bad';
        return;
      }
      client.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname.replace(/login\.html$/, 'reset-password.html')
      }).then(function (res) {
        if (res.error) throw new Error(res.error.message);
        status.textContent = 'Password reset link sent to ' + email + '. Check your inbox.';
        status.className = 'form-status ok';
      }).catch(function (err) {
        status.textContent = 'Could not send reset email: ' + err.message;
        status.className = 'form-status bad';
      });
    });
  }
})();
