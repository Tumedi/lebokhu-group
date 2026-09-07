/* ============================================================
   LeBoKhu Group — chat.js (shared chat widget)
   Renders a chat thread for a service request and handles
   loading, sending, polling, read-tracking and email notifications.

   Usage:
     var chat = window.LEBOKHU_CHAT.mount({
       container: element,
       requestId: '<uuid>',
       sender: 'homeowner',        // 'homeowner' | 'provider' | 'admin'
       senderName: 'Jane',
       readOnly: false,
       // for email notifications to the OTHER party (all optional):
       recipientEmail: '...',
       recipientName: '...',
       service: 'Plumbing',
       chatUrl: 'https://.../chat.html?r=..&t=..'  // link included in emails
     });
     chat.stop();  // stop polling

   Helpers:
     window.LEBOKHU_CHAT.unreadCounts(requestIds, forRole) -> Promise<{id:count}>
     window.LEBOKHU_CHAT.getRequestByToken(id, token) -> Promise<request|null>
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
    var lastNotified = 0;

    // Which "read" column this viewer clears, and which senders are "incoming".
    var readCol = (sender === 'homeowner') ? 'read_by_homeowner' : 'read_by_provider';
    function isIncoming(m) { return m.sender !== sender; }

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

    function markRead(rows) {
      // Mark any incoming, not-yet-read messages as read for this viewer.
      var toMark = rows.filter(function (m) { return isIncoming(m) && !m[readCol]; })
        .map(function (m) { return m.id; });
      if (!toMark.length) return;
      var patch = {}; patch[readCol] = true;
      client.from(CFG.MESSAGES_TABLE).update(patch).in('id', toMark)
        .then(function () {}).catch(function () {});
    }

    function render(rows) {
      markRead(rows);
      if (rows.length === lastCount) return;
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

    function notify(body) {
      // Throttle: at most one email per 30s per open thread.
      var now = Date.now();
      if (now - lastNotified < 30000) return;
      if (!opts.recipientEmail || !client.functions) return;
      lastNotified = now;
      var label = sender === 'homeowner' ? (senderName || 'A homeowner')
        : (sender === 'provider' ? (senderName || 'A service provider') : 'LeBoKhu Group');
      client.functions.invoke('send-chat-notification', {
        body: {
          recipient_email: opts.recipientEmail,
          recipient_name: opts.recipientName || '',
          sender_label: label,
          service: opts.service || '',
          preview: body.length > 120 ? body.slice(0, 117) + '…' : body,
          chat_url: opts.chatUrl || ''
        }
      }).catch(function () {});
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
          notify(body);
        });
      });
    }

    load();
    var timer = setInterval(load, 4000);

    return {
      stop: function () { stopped = true; clearInterval(timer); },
      reload: function () { lastCount = -1; load(); }
    };
  }

  // Count unread messages for a set of requests, from a role's perspective.
  //   forRole 'provider' -> messages sent by homeowner, read_by_provider = false
  //   forRole 'homeowner' -> messages sent by provider/admin, read_by_homeowner = false
  function unreadCounts(requestIds, forRole) {
    var result = {};
    if (!CFG || !CFG.isConfigured() || !requestIds || !requestIds.length) return Promise.resolve(result);
    var client = CFG.client();
    var q = client.from(CFG.MESSAGES_TABLE).select('request_id, sender, read_by_provider, read_by_homeowner')
      .in('request_id', requestIds);
    return q.then(function (res) {
      if (res.error || !res.data) return result;
      res.data.forEach(function (m) {
        var unread = (forRole === 'provider')
          ? (m.sender === 'homeowner' && !m.read_by_provider)
          : (m.sender !== 'homeowner' && !m.read_by_homeowner);
        if (unread) result[m.request_id] = (result[m.request_id] || 0) + 1;
      });
      return result;
    }).catch(function () { return result; });
  }

  function getRequestByToken(requestId, token) {
    if (!CFG || !CFG.isConfigured()) return Promise.resolve(null);
    var client = CFG.client();
    return client.rpc('get_request_by_token', { p_id: requestId, p_token: token })
      .then(function (res) { return (res.data && res.data[0]) || null; })
      .catch(function () { return null; });
  }

  window.LEBOKHU_CHAT = { mount: mount, getRequestByToken: getRequestByToken, unreadCounts: unreadCounts };
})();
