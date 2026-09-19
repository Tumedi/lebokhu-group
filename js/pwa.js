/* ============================================================
   LeKhuBo Connect — pwa.js
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

  // If already running as an installed app, never show the button.
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }
  // iOS Safari never fires beforeinstallprompt — detect it so we can still
  // guide the user (Share → Add to Home Screen).
  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
  }

  function makeButton() {
    if (installBtn) return installBtn;
    installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.className = 'pwa-install-btn';
    installBtn.setAttribute('aria-label', 'Install the LeKhuBo Connect app');
    installBtn.innerHTML = '<span class="pwa-install-icon">⬇</span> Install App';
    installBtn.addEventListener('click', function () {
      if (deferredPrompt) {
        // Chromium: show the native install prompt.
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          hideButton();
        });
      } else if (isIOS()) {
        // iOS: no programmatic install — tell them how.
        showIosHelp();
      }
    });
    document.body.appendChild(installBtn);
    return installBtn;
  }

  function showButton() { makeButton().classList.add('show'); }
  function hideButton() { if (installBtn) installBtn.classList.remove('show'); }

  // A small dismissible tip for iOS users explaining Add to Home Screen.
  function showIosHelp() {
    if (document.querySelector('.pwa-ios-tip')) return;
    var tip = document.createElement('div');
    tip.className = 'pwa-ios-tip';
    tip.innerHTML =
      '<button type="button" class="pwa-ios-close" aria-label="Close">&times;</button>' +
      'To install: tap the <strong>Share</strong> button ' +
      '<span aria-hidden="true">&#x2191;</span> in Safari, then choose ' +
      '<strong>“Add to Home Screen”</strong>.';
    tip.querySelector('.pwa-ios-close').addEventListener('click', function () { tip.remove(); });
    document.body.appendChild(tip);
    setTimeout(function () { if (tip.parentNode) tip.remove(); }, 12000);
  }

  if (!isStandalone()) {
    // Fired by Chromium browsers when the app is installable.
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      showButton();
    });
    // iOS can't fire that event, so show the button (→ instructions) directly.
    if (isIOS()) showButton();
  }

  // Hide the button once installed.
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    hideButton();
  });
})();
