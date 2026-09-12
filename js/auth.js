/* ============================================================
   LeKhuBo Connect — auth.js (shared authentication helper)
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
    // NOTE: the employer / job-posting module is temporarily disabled while we
    // focus on job seekers and service providers. It can be re-enabled later by
    // restoring the 'employer' -> my-posts.html mapping.
    if (role === 'provider') return { href: 'my-services.html', label: 'My Services' };
    if (role === 'homeowner') return { href: 'my-requests.html', label: 'My Requests' };
    if (role === 'admin') return { href: 'admin.html', label: 'Admin Dashboard' };
    if (role === 'seeker') return { href: 'my-applications.html', label: 'My Applications' };
    // Unknown / missing role — don't guess a role-specific page (that can
    // bounce the user back onto a page they're not allowed on). Send home.
    return { href: 'index.html', label: 'Home' };
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
          // Logged in but wrong role — send them to their own dashboard.
          var dest = AUTH.dashboardFor(profile.role);
          var currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
          var destPage = (dest.href.split('/').pop() || '').toLowerCase();
          // Never bounce the user back onto the SAME page (that caused an
          // infinite alert loop for roles whose dashboard couldn't be resolved).
          if (destPage === currentPage) dest = { href: 'index.html', label: 'Home' };
          location.replace(dest.href);
          return Promise.reject(new Error('wrong-role'));
        }
        // Logged in and allowed → arm the 3-minute inactivity auto-logout.
        AUTH.startIdleLogout(3);
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

  // ---- Idle auto-logout ----
  // Signs the user out after a period of no activity (default 3 minutes) and
  // sends them to the login page. Safe to call more than once (only arms once).
  var _idleTimer = null;
  var _idleArmed = false;
  AUTH.startIdleLogout = function (minutes) {
    if (_idleArmed) return;            // don't double-bind listeners
    _idleArmed = true;
    var ms = (minutes || 3) * 60 * 1000;

    function doLogout() {
      _idleArmed = false;
      AUTH.signOut().then(function () {
        location.href = 'login.html?timeout=1';
      }).catch(function () {
        location.href = 'login.html?timeout=1';
      });
    }
    function reset() {
      if (_idleTimer) clearTimeout(_idleTimer);
      _idleTimer = setTimeout(doLogout, ms);
    }

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'visibilitychange']
      .forEach(function (evt) {
        document.addEventListener(evt, reset, { passive: true });
      });
    reset();   // start the countdown
  };

  // Update the top nav to reflect auth state.
  // Adds a login link (logged out) or an account dropdown (logged in).
  AUTH.renderHeader = function (navSelector) {
    var nav = document.querySelector(navSelector || '#mainNav');
    if (!nav) return;

    // Remove any previously injected auth nodes
    nav.querySelectorAll('[data-auth-node]').forEach(function (n) { n.remove(); });

    var currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

    // Show/hide the static guest links (Register / Sign Up / Log In in the page HTML)
    // depending on auth state.
    function setGuestLinksVisible(visible) {
      nav.querySelectorAll('a[href]').forEach(function (a) {
        if (a.hasAttribute('data-auth-node')) return; // skip injected ones
        var target = (a.getAttribute('href') || '').split('#')[0].split('?')[0].toLowerCase();
        if (target === 'register.html' || target === 'signup.html' || target === 'login.html') {
          a.style.display = visible ? '' : 'none';
        }
      });
    }

    return AUTH.getUser().then(function (user) {
      if (!user) {
        setGuestLinksVisible(true);
        // Only add a "Log In" link if the page doesn't already have a login/signup link.
        var hasGuestLink = false;
        nav.querySelectorAll('a[href]').forEach(function (a) {
          var t = (a.getAttribute('href') || '').split('#')[0].split('?')[0].toLowerCase();
          if (t === 'login.html' || t === 'signup.html' || t === 'register.html') hasGuestLink = true;
        });
        if (!hasGuestLink) {
          var login = document.createElement('a');
          login.href = 'login.html';
          login.textContent = 'Log In';
          login.setAttribute('data-auth-node', '');
          nav.appendChild(login);
        }
        return;
      }

      // Logged in: hide guest-only links (Register / Sign Up / Log In).
      setGuestLinksVisible(false);

      return AUTH.getProfile().then(function (profile) {
        var role = (profile && profile.role) || 'seeker';
        var d = AUTH.dashboardFor(role);
        var dashHref = d.href;
        var dashLabel = d.label;

        // Each role gets a quick primary action shortcut in the header —
        // but not if it just points to the page they're already on.
        var shortcuts = {
          homeowner: { href: 'services-directory.html', label: '＋ Request a Service' },
          seeker:    { href: 'jobs.html',                label: 'Browse Jobs' },
          provider:  { href: 'list-service.html',        label: 'Edit My Listing' }
        };
        var sc = shortcuts[role];
        if (sc && sc.href.toLowerCase() !== currentPage) {
          var scLink = document.createElement('a');
          scLink.href = sc.href;
          scLink.className = 'nav-cta';
          scLink.textContent = sc.label;
          scLink.setAttribute('data-auth-node', '');
          nav.appendChild(scLink);
        }

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
