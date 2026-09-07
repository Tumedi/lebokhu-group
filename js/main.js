/* ============================================================
   LeKhuBo Connect — main.js
   Mobile nav · reveal-on-scroll · counters · form validation
   ============================================================ */
(function () {
  'use strict';

  /* ---- Footer year ---- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Highlight the active page in the nav ---- */
  (function () {
    var navEl = document.getElementById('mainNav');
    if (!navEl) return;
    // Current page filename (default to index.html for "/" root)
    var current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    navEl.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      // Ignore external, anchor-only, mailto/tel and JS links
      if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) return;
      // Compare just the page part (strip any #anchor or ?query)
      var target = href.split('#')[0].split('?')[0].toLowerCase();
      if (!target) return;               // pure "#..." link on same page
      if (target === current) a.classList.add('active');
    });
  })();

  /* ---- Mobile nav toggle ---- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close menu when any link is clicked (delegated, so it also covers
    // links injected later by renderHeader — dashboard, Log Out, shortcuts).
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- Reveal on scroll ---- */
  var revealTargets = document.querySelectorAll(
    '.section .kicker, .section h2, .card, .impact-item, .about-card, ' +
    '.steps, .check-list, .contact-form, .section-head, .founder > div, blockquote'
  );
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- Animated counters ---- */
  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    var start = 0, dur = 1400, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('.num[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var cObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { runCounter(entry.target); cObs.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cObs.observe(c); });
  } else {
    counters.forEach(runCounter);
  }

  /* ---- Contact form validation ---- */
  var form = document.getElementById('contactForm');
  var status = document.getElementById('formStatus');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      var required = form.querySelectorAll('[required]');
      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      required.forEach(function (field) {
        var ok = field.value.trim() !== '';
        if (field.type === 'email' && ok) ok = emailRe.test(field.value.trim());
        field.classList.toggle('err', !ok);
        if (!ok) valid = false;
      });

      if (!valid) {
        status.textContent = 'Please complete all required fields with valid details.';
        status.className = 'form-status bad';
        return;
      }

      var name = form.querySelector('#name').value.trim().split(' ')[0];
      var endpoint = form.getAttribute('action') || '';
      var configured = endpoint.indexOf('YOUR_FORM_ID') === -1 && endpoint.indexOf('formspree.io') !== -1;

      // Fallback when the email service isn't connected yet
      if (!configured) {
        status.textContent = 'Thank you' + (name ? ', ' + name : '') +
          '! Your message has been captured. (Email delivery is not connected yet — ' +
          'add your Formspree endpoint to enable it.)';
        status.className = 'form-status ok';
        form.reset();
        return;
      }

      // Real submission via Formspree AJAX
      var btn = form.querySelector('button[type="submit"]');
      var original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';

      fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          status.textContent = 'Thank you' + (name ? ', ' + name : '') +
            '! Your message has been sent. Our team will be in touch soon.';
          status.className = 'form-status ok';
          form.reset();
        } else {
          throw new Error('Submission failed');
        }
      }).catch(function () {
        status.textContent = 'Sorry, something went wrong. Please try again or email us directly.';
        status.className = 'form-status bad';
      }).finally(function () {
        btn.disabled = false; btn.textContent = original;
      });
    });

    // Clear error styling as the user types
    form.querySelectorAll('input,select,textarea').forEach(function (field) {
      field.addEventListener('input', function () { field.classList.remove('err'); });
    });
  }
})();
