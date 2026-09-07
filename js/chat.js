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
        '<div class="chat-typing" data-chat-typing hidden></div>' +
        (readOnly ? '' :
        '<div class="chat-preview" data-chat-preview hidden>' +
          '<img class="chat-preview-img" data-chat-preview-img alt="Preview">' +
          '<div class="chat-preview-body">' +
            '<input type="text" class="chat-preview-cap" data-chat-preview-cap placeholder="Add a caption (optional)…" autocomplete="off">' +
            '<div class="chat-preview-actions">' +
              '<button type="button" class="btn btn-outline btn-sm" data-chat-preview-cancel>Cancel</button>' +
              '<button type="button" class="btn btn-primary btn-sm" data-chat-preview-send>Send photo</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<form class="chat-input" data-chat-form>' +
          '<button type="button" class="chat-tool" data-chat-photo title="Share a photo">📷</button>' +
          '<button type="button" class="chat-tool" data-chat-loc title="Share my location">📍</button>' +
          '<input type="file" accept="image/*" data-chat-file hidden>' +
          '<input type="text" placeholder="Type a message…" data-chat-text autocomplete="off">' +
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
        var inner;
        if (m.attachment_type === 'image' && m.attachment_url) {
          inner = '<a href="' + esc(m.attachment_url) + '" target="_blank" rel="noopener">' +
            '<img class="chat-img" src="' + esc(m.attachment_url) + '" alt="Shared photo" loading="lazy"></a>' +
            (m.body && m.body !== '[photo]' ? '<div class="chat-cap">' + esc(m.body) + '</div>' : '');
        } else if (m.attachment_type === 'location') {
          var url = m.attachment_url || m.body;
          inner = '<a class="chat-loc" href="' + esc(url) + '" target="_blank" rel="noopener">📍 View shared location</a>';
        } else {
          inner = esc(m.body);
        }
        return '<div class="chat-msg ' + (mine ? 'mine' : 'theirs') + '">' +
          '<div class="chat-bubble">' + inner + '</div>' +
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

    // Insert a message (text, image, or location) and refresh.
    function insertMessage(fields, previewText) {
      var record = {
        request_id: requestId,
        sender: sender,
        sender_name: senderName,
        body: fields.body || '',
        attachment_url: fields.attachment_url || null,
        attachment_type: fields.attachment_type || null
      };
      return client.from(CFG.MESSAGES_TABLE).insert([record]).then(function (res) {
        if (res.error) { alert('Message failed: ' + res.error.message); return false; }
        lastCount = -1; load();
        notify(previewText || fields.body || '');
        return true;
      });
    }

    if (form) {
      var input = form.querySelector('[data-chat-text]');
      var fileInput = form.querySelector('[data-chat-file]');
      var photoBtn = form.querySelector('[data-chat-photo]');
      var locBtn = form.querySelector('[data-chat-loc]');

      // Text send
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = (input.value || '').trim();
        if (!body) return;
        input.value = '';
        insertMessage({ body: body });
      });

      // Photo: pick → PREVIEW (with caption, confirm/cancel) → upload & send
      var previewEl = container.querySelector('[data-chat-preview]');
      var previewImg = container.querySelector('[data-chat-preview-img]');
      var previewCap = container.querySelector('[data-chat-preview-cap]');
      var previewSend = container.querySelector('[data-chat-preview-send]');
      var previewCancel = container.querySelector('[data-chat-preview-cancel]');
      var pendingFile = null;
      var previewObjUrl = null;

      function clearPreview() {
        pendingFile = null;
        if (previewObjUrl) { URL.revokeObjectURL(previewObjUrl); previewObjUrl = null; }
        if (previewEl) previewEl.hidden = true;
        if (previewCap) previewCap.value = '';
        if (fileInput) fileInput.value = '';
      }

      if (photoBtn && fileInput) {
        photoBtn.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          if (f.size > 5 * 1024 * 1024) { alert('Image is larger than 5 MB. Please choose a smaller one.'); fileInput.value = ''; return; }
          pendingFile = f;
          previewObjUrl = URL.createObjectURL(f);
          previewImg.src = previewObjUrl;
          previewEl.hidden = false;
          previewCap.focus();
        });
      }
      if (previewCancel) previewCancel.addEventListener('click', clearPreview);
      if (previewSend) {
        previewSend.addEventListener('click', function () {
          if (!pendingFile) return;
          var caption = (previewCap.value || '').trim();
          previewSend.disabled = true; previewSend.textContent = 'Sending…';
          var safe = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          var path = requestId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '_' + safe;
          client.storage.from(CFG.CHAT_MEDIA_BUCKET).upload(path, pendingFile, { cacheControl: '3600', upsert: false })
            .then(function (res) {
              if (res.error) throw new Error(res.error.message);
              var pub = client.storage.from(CFG.CHAT_MEDIA_BUCKET).getPublicUrl(path);
              return insertMessage({
                body: caption || '[photo]',
                attachment_url: (pub.data && pub.data.publicUrl) || '',
                attachment_type: 'image'
              }, '📷 Photo');
            })
            .then(function () { clearPreview(); })
            .catch(function (err) { alert('Could not share photo: ' + err.message); })
            .then(function () { previewSend.disabled = false; previewSend.textContent = 'Send photo'; });
        });
      }

      // Location: get GPS coords → Google Maps link, send as location message
      if (locBtn) {
        locBtn.addEventListener('click', function () {
          if (!navigator.geolocation) { alert('Location sharing is not supported on this device.'); return; }
          locBtn.disabled = true; locBtn.textContent = '⏳';
          navigator.geolocation.getCurrentPosition(function (pos) {
            var lat = pos.coords.latitude.toFixed(6), lng = pos.coords.longitude.toFixed(6);
            var mapUrl = 'https://www.google.com/maps?q=' + lat + ',' + lng;
            insertMessage({ body: mapUrl, attachment_url: mapUrl, attachment_type: 'location' }, '📍 Location')
              .then(function () { locBtn.disabled = false; locBtn.textContent = '📍'; });
          }, function (err) {
            alert('Could not get your location: ' + err.message + '. Please allow location access.');
            locBtn.disabled = false; locBtn.textContent = '📍';
          }, { enableHighAccuracy: true, timeout: 10000 });
        });
      }
    }

    /* ---- Typing indicator (Supabase Realtime broadcast) ---- */
    var typingEl = container.querySelector('[data-chat-typing]');
    var typingChannel = null;
    var typingHideTimer = null;
    var lastBroadcast = 0;
    try {
      if (client.channel) {
        typingChannel = client.channel('typing:' + requestId, { config: { broadcast: { self: false } } });
        typingChannel.on('broadcast', { event: 'typing' }, function (payload) {
          var who = (payload && payload.payload && payload.payload.name) || 'Someone';
          if (typingEl) {
            typingEl.textContent = who + ' is typing…';
            typingEl.hidden = false;
            clearTimeout(typingHideTimer);
            typingHideTimer = setTimeout(function () { if (typingEl) typingEl.hidden = true; }, 3000);
          }
        });
        typingChannel.subscribe();
      }
    } catch (e) { /* realtime optional */ }

    function broadcastTyping() {
      if (!typingChannel) return;
      var now = Date.now();
      if (now - lastBroadcast < 1500) return; // throttle
      lastBroadcast = now;
      try {
        typingChannel.send({ type: 'broadcast', event: 'typing', payload: { name: senderName || 'Someone' } });
      } catch (e) { /* ignore */ }
    }
    if (form) {
      var textInput = form.querySelector('[data-chat-text]');
      if (textInput) textInput.addEventListener('input', broadcastTyping);
    }

    load();
    var timer = setInterval(load, 4000);

    return {
      stop: function () {
        stopped = true; clearInterval(timer);
        if (typingChannel) { try { client.removeChannel(typingChannel); } catch (e) {} }
      },
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
