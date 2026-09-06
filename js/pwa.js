/* ============================================================
   LeBoKhu Group — pwa.js
   Registers the service worker and shows a custom install button.
   ============================================================ */
(function () {
  'use strict';

  /* ---- Register service worker ---- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      // Relative path so it works under a sub-path (GitHub Pages project site)
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('SW registration failed:', err);
      });
    });
  }

  /* ---- Custom install prompt ---- */
  var deferredPrompt = null;
  var installBtn = null;

  function makeButton() {
    if (installBtn) return installBtn;
    installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.className = 'pwa-install-btn';
    installBtn.setAttribute('aria-label', 'Install the LeBoKhu app');
    installBtn.innerHTML = '<span class="pwa-install-icon">⬇</span> Install App';
    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        hideButton();
      });
    });
    document.body.appendChild(installBtn);
    return installBtn;
  }

  function showButton() { makeButton().classList.add('show'); }
  function hideButton() { if (installBtn) installBtn.classList.remove('show'); }

  // Fired by Chromium browsers when the app is installable
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showButton();
  });

  // Hide the button once installed
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideButton();
  });

  // If already running as an installed app, never show the button
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }
  if (isStandalone()) hideButton();
})();
