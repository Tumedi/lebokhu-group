/* ============================================================
   LeKhuBo Connect — chat-page.js
   Standalone chat page opened by a homeowner via their private
   link: chat.html?r=<request_id>&t=<access_token>
   Validates the token, then mounts the shared chat widget.
   ============================================================ */
(function () {
  'use strict';

  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
  var requestId = params && params.get('r');
  var token = params && params.get('t');

  var errorEl = document.getElementById('chatError');
  var cardEl = document.getElementById('chatCard');
  var providerEl = document.getElementById('chatProvider');
  var mountEl = document.getElementById('chatMount');
  var subEl = document.getElementById('chatSub');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  if (!requestId || !token || !window.LEBOKHU_CHAT) {
    if (errorEl) errorEl.hidden = false;
    return;
  }

  window.LEBOKHU_CHAT.getRequestByToken(requestId, token).then(function (req) {
    if (!req) { errorEl.hidden = false; return; }
    cardEl.hidden = false;
    providerEl.innerHTML = '<h3>' + esc(req.provider_name || 'Service Provider') + '</h3>' +
      '<p class="muted">' + esc(req.service || '') + (req.status ? ' · ' + esc(req.status) : '') + '</p>';
    if (subEl) subEl.textContent = 'Chatting with ' + (req.provider_name || 'your provider') + '.';

    window.LEBOKHU_CHAT.mount({
      container: mountEl,
      requestId: req.id,
      sender: 'homeowner',
      senderName: req.homeowner_name || 'Homeowner'
    });
  });
})();
