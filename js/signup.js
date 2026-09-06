/* ============================================================
   LeBoKhu Group — signup.js
   Creates a Supabase auth user with a role (seeker | employer).
   Profile is auto-created by the DB trigger from user metadata.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('signupForm');
  if (!form) return;
  var status = document.getElementById('signupStatus');
  var companyField = document.getElementById('companyField');
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // If already logged in, send them to their dashboard
  if (window.LEBOKHU_AUTH && window.LEBOKHU_AUTH.configured()) {
    window.LEBOKHU_AUTH.getProfile().then(function (p) {
      if (p) location.href = p.role === 'employer' ? 'my-posts.html' : 'my-applications.html';
    });
  } else {
    document.getElementById('notConfigured').hidden = false;
    form.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
    return;
  }

  // Show the company field only for employers
  function roleValue() {
    var r = form.querySelector('input[name="role"]:checked');
    return r ? r.value : 'seeker';
  }
  form.querySelectorAll('input[name="role"]').forEach(function (el) {
    el.addEventListener('change', function () {
      companyField.hidden = roleValue() !== 'employer';
    });
  });

  form.querySelectorAll('input').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = ''; status.className = 'form-status';

    var role = roleValue();
    var fullName = document.getElementById('fullName').value.trim();
    var company = document.getElementById('company').value.trim();
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
        data: { role: role, full_name: fullName, company: company, phone: phone },
        emailRedirectTo: location.origin + location.pathname.replace(/signup\.html$/, 'login.html')
      }
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      // If email confirmation is ON, there is no active session yet.
      var hasSession = res.data && res.data.session;
      if (hasSession) {
        location.href = role === 'employer' ? 'my-posts.html' : 'my-applications.html';
      } else {
        status.innerHTML = 'Account created! Please check your email (<strong>' + email +
          '</strong>) and click the confirmation link, then <a href="login.html">log in</a>.';
        status.className = 'form-status ok';
        form.reset();
        companyField.hidden = true;
      }
    }).catch(function (err) {
      status.textContent = 'Sign up failed: ' + err.message;
      status.className = 'form-status bad';
    }).then(function () {
      btn.disabled = false; btn.textContent = original;
    });
  });
})();
