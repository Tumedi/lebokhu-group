/* ============================================================
   LeKhuBo Connect — signup.js
   Creates a Supabase auth user with a role (seeker | provider | homeowner).
   Profile is auto-created by the DB trigger from user metadata.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('signupForm');
  if (!form) return;
  var status = document.getElementById('signupStatus');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!(window.LEBOKHU_AUTH && window.LEBOKHU_AUTH.configured())) {
    document.getElementById('notConfigured').hidden = false;
    form.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
    return;
  }

  // If already logged in, DON'T silently redirect away (that made the signup
  // page look like it "does nothing"). Instead show a clear notice and let the
  // user go to their dashboard OR log out to create a different account.
  var AUTH = window.LEBOKHU_AUTH;
  AUTH.getUser().then(function (user) {
    if (!user) return; // logged out — normal signup, leave the form as-is
    var box = document.getElementById('alreadyLoggedIn');
    var emailEl = document.getElementById('currentEmail');
    if (emailEl) emailEl.textContent = user.email || 'your account';
    if (box) box.hidden = false;

    var go = document.getElementById('goDashboard');
    if (go) go.addEventListener('click', function (e) {
      e.preventDefault();
      AUTH.getProfile().then(function (p) {
        location.href = AUTH.dashboardFor(p && p.role).href;
      });
    });

    var out = document.getElementById('logoutFirst');
    if (out) out.addEventListener('click', function (e) {
      e.preventDefault();
      AUTH.signOut().then(function () { location.reload(); });
    });
  });

  function roleValue() {
    var r = form.querySelector('input[name="role"]:checked');
    return r ? r.value : 'seeker';
  }

  // Wire up the "Resend confirmation" link that appears in the success message.
  function wireResend(email) {
    var link = document.getElementById('resendLink');
    if (!link) return;
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var client = window.LEBOKHU_AUTH.client();
      if (!client) return;
      link.textContent = 'Sending…';
      client.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: location.origin + location.pathname.replace(/signup\.html$/, 'login.html')
        }
      }).then(function (res) {
        if (res.error) throw new Error(res.error.message);
        status.innerHTML = 'Confirmation email re-sent to <strong>' + email +
          '</strong>. Check your inbox and spam folder, then <a href="login.html">log in</a>.';
        status.className = 'form-status ok';
      }).catch(function (err) {
        var m = err.message || 'Please try again';
        if (/already|confirmed/i.test(m)) m = 'This email is already confirmed — just log in.';
        status.textContent = 'Could not resend: ' + m;
        status.className = 'form-status bad';
      });
    });
  }

  form.querySelectorAll('input').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = ''; status.className = 'form-status';

    var role = roleValue();
    var fullName = document.getElementById('fullName').value.trim();
    var email = document.getElementById('email').value.trim();
    var phone = document.getElementById('phone').value.trim();
    var password = document.getElementById('password').value;
    var consent = document.getElementById('consent').checked;

    var valid = true;
    function bad(id) { var el = document.getElementById(id); if (el) el.classList.add('err'); valid = false; }
    if (!fullName) bad('fullName');
    if (!emailRe.test(email)) bad('email');
    if (!password || password.length < 6) bad('password');
    if (!consent) bad('consent');
    if (!valid) {
      status.textContent = 'Please complete all required fields (password min 6 characters).';
      status.className = 'form-status bad';
      return;
    }

    var client = window.LEBOKHU_AUTH.client();
    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Creating account…';

    client.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { role: role, full_name: fullName, phone: phone },
        emailRedirectTo: location.origin + location.pathname.replace(/signup\.html$/, 'login.html')
      }
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      // If email confirmation is ON, there is no active session yet.
      var hasSession = res.data && res.data.session;
      if (hasSession) {
        location.href = window.LEBOKHU_AUTH.dashboardFor(role).href;
      } else {
        status.innerHTML = 'Account created! Please check your email (<strong>' + email +
          '</strong>) and click the confirmation link, then <a href="login.html">log in</a>.' +
          '<br><span class="hint">Didn\'t get it? <a href="#" id="resendLink">Resend confirmation</a> ' +
          '(also check your spam folder).</span>';
        status.className = 'form-status ok';
        wireResend(email, role);
        form.reset();
      }
    }).catch(function (err) {
      // Log the raw error so the exact Supabase reason is visible in the console
      // (e.g. "Signups not allowed", "Database error saving new user", rate limits).
      try { console.error('[signup] Supabase signUp failed:', err); } catch (e) {}
      var m = err && err.message ? err.message : 'Please try again.';
      if (/signup.*disabled|not allowed/i.test(m)) {
        m = 'New sign-ups are currently disabled. Please contact us to get access.';
      } else if (/sending.*(confirmation|email)|error sending/i.test(m)) {
        // Supabase could not send the confirmation email, so it aborted the
        // signup. This is a mail-delivery/config issue on the server side.
        m = 'We could not send your confirmation email right now, so your account ' +
            'was not created. Please try again shortly. If this keeps happening, ' +
            'contact us at Tbmadihlaba@gmail.com.';
      } else if (/rate limit/i.test(m)) {
        m = 'Too many sign-ups from this address in a short time. Please wait a ' +
            'few minutes and try again.';
      } else if (/database error/i.test(m)) {
        m = 'We could not create your account (server setup issue). Please try again later or contact us.';
      } else if (/already registered|already exists/i.test(m)) {
        m = 'An account with this email already exists. Try logging in instead.';
      }
      status.textContent = 'Sign up failed: ' + m;
      status.className = 'form-status bad';
    }).then(function () {
      btn.disabled = false; btn.textContent = original;
    });
  });
})();
