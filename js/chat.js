/* ============================================================
   LeBoKhu Group — chat.js (shared chat widget)
   Renders a chat thread for a service request and handles
   loading, sending and polling for new messages.

   Usage:
     var chat = window.LEBOKHU_CHAT.mount({
       container: element,       // where to render
       requestId: '<uuid>',      // service_requests.id
       sender: 'homeowner',      // 'homeowner' | 'provider' | 'admin'
       senderName: 'Jane',       // display name (optional)
       readOnly: false           // admin can be read-only
     });
     // later: chat.stop();  to stop polling
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.LEBOKHU_SUPABASE;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  function mount(opts) {
    var container = opts.container;
    var requestId = opts.requestId;
    var sender = opts.sender || 'homeowner';
    var senderName = opts.senderName || '';
    var readOnly = !!opts.readOnly;
    if (!container || !requestId || !CFG || !CFG.isConfigured()) {
      if (container) container.innerHTML = '<p class="muted">Chat is not available.</p>';
      return { stop: function () {} };
    }
    var client = CFG.client();

    container.innerHTML =
      '<div class="chat-box">' +
        '<div class="chat-messages" data-chat-messages><p class="muted">Loading messages…</p></div>' +
        (readOnly ? '' :
        '<form class="chat-input" data-chat-form>' +
          '<input type="text" placeholder="Type a message…" data-chat-text autocomplete="off" required>' +
          '<button type="submit" class="btn btn-primary btn-sm">Send</button>' +
        '</form>') +
      '</div>';

    var msgsEl = container.querySelector('[data-chat-messages]');
    var form = container.querySelector('[data-chat-form]');
    var lastCount = -1;
    var stopped = false;

    function render(rows) {
      if (rows.length === lastCount) return; // no change, skip re-render
      lastCount = rows.length;
      if (!rows.length) {
        msgsEl.innerHTML = '<p class="muted">No messages yet. Say hello 👋</p>';
        return;
      }
      msgsEl.innerHTML = rows.map(function (m) {
        var mine = m.sender === sender;
        return '<div class="chat-msg ' + (mine ? 'mine' : 'theirs') + '">' +
          '<div class="chat-bubble">' + esc(m.body) + '</div>' +
          '<div class="chat-meta">' + esc(m.sender_name || m.sender) + ' · ' + esc(fmtTime(m.created_at)) + '</div>' +
        '</div>';
      }).join('');
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    function load() {
      if (stopped) return;
      client.from(CFG.MESSAGES_TABLE).select('*').eq('request_id', requestId)
        .order('created_at', { ascending: true })
        .then(function (res) { if (!res.error && res.data) render(res.data); });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('[data-chat-text]');
        var body = (input.value || '').trim();
        if (!body) return;
        input.value = '';
        client.from(CFG.MESSAGES_TABLE).insert([{
          request_id: requestId,
          sender: sender,
          sender_name: senderName,
          body: body
        }]).then(function (res) {
          if (res.error) { alert('Message failed: ' + res.error.message); input.value = body; return; }
          lastCount = -1; load();
        });
      });
    }

    load();
    var timer = setInterval(load, 4000); // poll for near-real-time

    return {
      stop: function () { stopped = true; clearInterval(timer); },
      reload: function () { lastCount = -1; load(); }
    };
  }

  // Look up a request by its private token (for the homeowner link).
  function getRequestByToken(requestId, token) {
    if (!CFG || !CFG.isConfigured()) return Promise.resolve(null);
    var client = CFG.client();
    return client.rpc('get_request_by_token', { p_id: requestId, p_token: token })
      .then(function (res) { return (res.data && res.data[0]) || null; })
      .catch(function () { return null; });
  }

  window.LEBOKHU_CHAT = { mount: mount, getRequestByToken: getRequestByToken };
})();
