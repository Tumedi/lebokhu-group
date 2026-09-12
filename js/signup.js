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

  // If already logged in, send them to their dashboard
  if (window.LEBOKHU_AUTH && window.LEBOKHU_AUTH.configured()) {
    window.LEBOKHU_AUTH.getProfile().then(function (p) {
      if (p) location.href = window.LEBOKHU_AUTH.dashboardFor(p.role).href;
    });
  } else {
    document.getElementById('notConfigured').hidden = false;
    form.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
    return;
  }

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
      status.textContent = 'Sign up failed: ' + err.message;
      status.className = 'form-status bad';
    }).then(function () {
      btn.disabled = false; btn.textContent = original;
    });
  });
})();
