/* ============================================================
   LeBoKhu Group — auth.js (shared authentication helper)
   Requires: supabase-js CDN + js/supabase-config.js loaded first.

   Exposes window.LEBOKHU_AUTH with:
     client()                      -> supabase client (or null)
     getSession()                  -> Promise<session|null>
     getUser()                     -> Promise<user|null>
     getProfile()                  -> Promise<profile|null>  (role, name, ...)
     requireAuth(role?)            -> Promise<{user,profile}> ; redirects to login if not allowed
     signOut()                     -> Promise
     renderHeader(navSelector?)    -> updates nav to show login/logout + dashboard link
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.LEBOKHU_SUPABASE;
  var AUTH = {};
  var _profileCache = null;

  AUTH.configured = function () { return !!(CFG && CFG.isConfigured()); };
  AUTH.client = function () { return AUTH.configured() ? CFG.client() : null; };

  // Map a role to its dashboard page + label.
  AUTH.dashboardFor = function (role) {
    if (role === 'employer') return { href: 'my-posts.html', label: 'My Job Posts' };
    if (role === 'provider') return { href: 'my-services.html', label: 'My Services' };
    return { href: 'my-applications.html', label: 'My Applications' };
  };

  AUTH.getSession = function () {
    var c = AUTH.client();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) { return (r.data && r.data.session) || null; });
  };

  AUTH.getUser = function () {
    return AUTH.getSession().then(function (s) { return s ? s.user : null; });
  };

  AUTH.getProfile = function (force) {
    if (_profileCache && !force) return Promise.resolve(_profileCache);
    var c = AUTH.client();
    if (!c) return Promise.resolve(null);
    return AUTH.getUser().then(function (user) {
      if (!user) return null;
      return c.from('profiles').select('*').eq('id', user.id).single()
        .then(function (r) {
          _profileCache = r.data || { id: user.id, role: 'seeker' };
          _profileCache.email = user.email;
          return _profileCache;
        })
        .catch(function () { return { id: user.id, role: 'seeker', email: user.email }; });
    });
  };

  // Redirect to login if not authenticated (optionally require a specific role).
  // Returns a promise that resolves with {user, profile} when allowed.
  AUTH.requireAuth = function (role) {
    return AUTH.getUser().then(function (user) {
      if (!user) {
        var next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        location.href = 'login.html?next=' + next;
        return Promise.reject(new Error('not-authenticated'));
      }
      return AUTH.getProfile().then(function (profile) {
        if (role && profile && profile.role !== role) {
          // Logged in but wrong role — send them to their own dashboard
          alert('This page is for ' + role + ' accounts. Redirecting you to your dashboard.');
          location.href = AUTH.dashboardFor(profile.role).href;
          return Promise.reject(new Error('wrong-role'));
        }
        return { user: user, profile: profile };
      });
    });
  };

  AUTH.signOut = function () {
    var c = AUTH.client();
    _profileCache = null;
    if (!c) return Promise.resolve();
    return c.auth.signOut();
  };

  // Update the top nav to reflect auth state.
  // Adds a login link (logged out) or an account dropdown (logged in).
  AUTH.renderHeader = function (navSelector) {
    var nav = document.querySelector(navSelector || '#mainNav');
    if (!nav) return;

    // Remove any previously injected auth nodes
    nav.querySelectorAll('[data-auth-node]').forEach(function (n) { n.remove(); });

    return AUTH.getUser().then(function (user) {
      if (!user) {
        var login = document.createElement('a');
        login.href = 'login.html';
        login.textContent = 'Log In';
        login.setAttribute('data-auth-node', '');
        nav.appendChild(login);
        return;
      }
      return AUTH.getProfile().then(function (profile) {
        var role = (profile && profile.role) || 'seeker';
        var d = AUTH.dashboardFor(role);
        var dashHref = d.href;
        var dashLabel = d.label;

        var dash = document.createElement('a');
        dash.href = dashHref;
        dash.textContent = dashLabel;
        dash.setAttribute('data-auth-node', '');
        nav.appendChild(dash);

        var out = document.createElement('a');
        out.href = '#';
        out.textContent = 'Log Out';
        out.setAttribute('data-auth-node', '');
        out.addEventListener('click', function (e) {
          e.preventDefault();
          AUTH.signOut().then(function () { location.href = 'index.html'; });
        });
        nav.appendChild(out);
      });
    });
  };

  window.LEBOKHU_AUTH = AUTH;
})();
