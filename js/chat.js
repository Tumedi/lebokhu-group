/* ============================================================
   LeKhuBo Connect — chat.js (shared chat widget)
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
        '<form class="chat-input" data-chat-form>' +
          '<button type="button" class="chat-tool" data-chat-emoji title="Add an emoji">😊</button>' +
          '<button type="button" class="chat-tool" data-chat-photo title="Share photos">📷</button>' +
          '<button type="button" class="chat-tool" data-chat-loc title="Share my location">📍</button>' +
          '<input type="file" accept="image/*" multiple data-chat-file hidden>' +
          '<div class="chat-emoji-panel" data-chat-emoji-panel hidden></div>' +
          '<div class="chat-input-field">' +
            '<div class="chat-thumbs" data-chat-thumbs hidden></div>' +
            '<input type="text" placeholder="Type a message…" data-chat-text autocomplete="off">' +
          '</div>' +
          '<button type="submit" class="btn btn-primary btn-sm" data-chat-send>Send</button>' +
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
      var label = sender === 'homeowner' ? (senderName || 'A potential employer')
        : (sender === 'provider' ? (senderName || 'A service provider') : 'LeKhuBo Connect');
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
      var sendBtn = form.querySelector('[data-chat-send]');
      var thumbsEl = form.querySelector('[data-chat-thumbs]');
      var emojiBtn = form.querySelector('[data-chat-emoji]');
      var emojiPanel = form.querySelector('[data-chat-emoji-panel]');

      var MAX_PHOTOS = 10;
      var pendingFiles = [];    // chosen photos waiting to be sent
      var thumbObjUrls = [];    // matching object URLs (index-aligned with pendingFiles)

      function renderThumbs() {
        if (!thumbsEl) return;
        if (!pendingFiles.length) {
          thumbsEl.hidden = true;
          thumbsEl.innerHTML = '';
          if (input) input.placeholder = 'Type a message…';
          return;
        }
        thumbsEl.hidden = false;
        thumbsEl.innerHTML = pendingFiles.map(function (f, i) {
          return '<div class="chat-thumb">' +
            '<img src="' + thumbObjUrls[i] + '" alt="Selected photo">' +
            '<button type="button" class="chat-thumb-x" data-remove="' + i + '" title="Remove photo">&times;</button>' +
          '</div>';
        }).join('');
        // Wire each remove button.
        thumbsEl.querySelectorAll('[data-remove]').forEach(function (b) {
          b.addEventListener('click', function () {
            removePhoto(parseInt(b.getAttribute('data-remove'), 10));
          });
        });
        if (input) input.placeholder = 'Add a caption (optional)…';
      }

      function removePhoto(i) {
        if (i < 0 || i >= pendingFiles.length) return;
        if (thumbObjUrls[i]) URL.revokeObjectURL(thumbObjUrls[i]);
        pendingFiles.splice(i, 1);
        thumbObjUrls.splice(i, 1);
        renderThumbs();
      }

      function clearPhoto() {
        thumbObjUrls.forEach(function (u) { if (u) URL.revokeObjectURL(u); });
        pendingFiles = [];
        thumbObjUrls = [];
        if (fileInput) fileInput.value = '';
        renderThumbs();
      }

      // Pick one or more photos → show a thumbnail chip for each in the input bar.
      if (photoBtn && fileInput) {
        photoBtn.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
          var files = fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
          if (!files.length) return;
          var tooBig = false, roomLeft;
          files.forEach(function (f) {
            if (pendingFiles.length >= MAX_PHOTOS) return;
            if (f.size > 5 * 1024 * 1024) { tooBig = true; return; }
            pendingFiles.push(f);
            thumbObjUrls.push(URL.createObjectURL(f));
          });
          fileInput.value = '';   // allow re-selecting the same file(s) later
          renderThumbs();
          if (input) input.focus();
          if (tooBig) alert('Some images were larger than 5 MB and were skipped. Please choose smaller ones.');
          if (files.length + (pendingFiles.length - files.length) > MAX_PHOTOS) {
            alert('You can attach up to ' + MAX_PHOTOS + ' photos per message.');
          }
        });
      }

      /* ---- Emoji picker ---- */
      var EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😉','😎','🤩','🥳','😇',
        '🙂','🙃','😌','😋','😛','🤔','🤗','🤝','👍','👎','👏','🙏','💪','🙌',
        '👋','✌️','🤞','👌','🔥','✨','⭐','🎉','❤️','🧡','💛','💚','💙','💜',
        '💯','✅','❌','⚠️','❓','❗','👀','😅','😢','😭','😤','😡','😴','🤦','🤷',
        '💰','🛠️','🔧','🧹','🪴','🌿','🎨','🏠','🚗','📍','📅','⏰','☎️','📞'];
      var emojiOpen = false;

      function buildEmojiPanel() {
        if (!emojiPanel || emojiPanel.childNodes.length) return;
        emojiPanel.innerHTML = EMOJIS.map(function (e) {
          return '<button type="button" class="chat-emoji-btn" data-emoji="' + e + '">' + e + '</button>';
        }).join('');
        emojiPanel.querySelectorAll('[data-emoji]').forEach(function (b) {
          b.addEventListener('click', function () { insertAtCursor(b.getAttribute('data-emoji')); });
        });
      }

      // Insert text at the caret position of the message input.
      function insertAtCursor(text) {
        if (!input) return;
        var start = input.selectionStart, end = input.selectionEnd;
        if (typeof start === 'number' && typeof end === 'number') {
          input.value = input.value.slice(0, start) + text + input.value.slice(end);
          var pos = start + text.length;
          input.setSelectionRange(pos, pos);
        } else {
          input.value += text;
        }
        input.focus();
      }

      function toggleEmoji(show) {
        if (!emojiPanel) return;
        emojiOpen = (typeof show === 'boolean') ? show : !emojiOpen;
        if (emojiOpen) { buildEmojiPanel(); emojiPanel.hidden = false; }
        else { emojiPanel.hidden = true; }
      }

      if (emojiBtn && emojiPanel) {
        emojiBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleEmoji(); });
        // Keep the panel open while clicking emojis; close when clicking elsewhere.
        emojiPanel.addEventListener('click', function (e) { e.stopPropagation(); });
        document.addEventListener('click', function () { if (emojiOpen) toggleEmoji(false); });
      }

      // One Send button: sends the photo (with the text as caption) if one is
      // selected, otherwise sends the text message.
      // Upload one file to the chat-media bucket, resolving to its public URL.
      function uploadOne(file) {
        var safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var path = requestId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '_' + safe;
        return client.storage.from(CFG.CHAT_MEDIA_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
          .then(function (res) {
            if (res.error) throw new Error(res.error.message);
            var pub = client.storage.from(CFG.CHAT_MEDIA_BUCKET).getPublicUrl(path);
            return (pub.data && pub.data.publicUrl) || '';
          });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var body = (input.value || '').trim();

        if (pendingFiles.length) {
          var files = pendingFiles.slice();     // snapshot
          var caption = body;
          var total = files.length;
          sendBtn.disabled = true;
          sendBtn.textContent = total > 1 ? 'Sending 0/' + total + '…' : 'Sending…';

          // Upload every photo, then insert one message row per photo (the
          // FIRST row carries the caption; the rest are photo-only bubbles).
          var done = 0;
          var uploads = files.map(function (f) {
            return uploadOne(f).then(function (url) {
              done++;
              if (total > 1) sendBtn.textContent = 'Sending ' + done + '/' + total + '…';
              return url;
            });
          });

          Promise.all(uploads).then(function (urls) {
            // Insert sequentially so bubbles keep their order.
            var chain = Promise.resolve();
            urls.forEach(function (url, i) {
              if (!url) return;
              chain = chain.then(function () {
                return insertMessage({
                  body: i === 0 ? (caption || '[photo]') : '[photo]',
                  attachment_url: url,
                  attachment_type: 'image'
                }, total > 1 ? '📷 ' + total + ' photos' : '📷 Photo');
              });
            });
            return chain;
          })
            .then(function () { input.value = ''; clearPhoto(); })
            .catch(function (err) { alert('Could not share photos: ' + err.message); })
            .then(function () { sendBtn.disabled = false; sendBtn.textContent = 'Send'; });
          return;
        }

        if (!body) return;      // nothing to send
        input.value = '';
        insertMessage({ body: body });
      });

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

  // Poll unread counts on a timer and call back with { counts, total } each tick.
  // Also flashes the document title so a new message is noticed in a background tab,
  // and fires a native browser notification when the unread total INCREASES.
  //   getIds()  -> array of request ids to watch (re-read each tick so it stays fresh)
  //   forRole   -> 'provider' | 'homeowner'
  //   onUpdate(counts, total) -> called after every poll
  //   opts.notifyTitle / opts.notifyBody -> optional strings for the OS notification
  // Returns { refresh(), stop() } to cancel.
  function watchUnread(getIds, forRole, onUpdate, intervalMs, opts) {
    opts = opts || {};
    var baseTitle = document.title;
    var stopped = false;
    var timer = null;
    var prevTotal = null;   // null until the first poll completes (so we don't notify on load)

    function setTitle(total) {
      if (total > 0) document.title = '(' + total + ') ' + baseTitle;
      else document.title = baseTitle;
    }

    // Fire an OS notification only if the tab isn't the one the user is looking at.
    function maybeNotify(total) {
      if (prevTotal === null || total <= prevTotal) return;   // no increase → no notify
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      // Don't nag if the user is actively viewing this tab.
      if (document.visibilityState === 'visible' && document.hasFocus && document.hasFocus()) return;
      var n = total - prevTotal;
      try {
        var note = new Notification(opts.notifyTitle || 'New message — LeKhuBo Connect', {
          body: opts.notifyBody || (n === 1 ? 'You have a new chat message.'
            : 'You have ' + n + ' new chat messages.'),
          icon: 'assets/icon-192.svg',
          tag: 'lekhubo-chat'   // collapse repeats into one
        });
        note.onclick = function () { window.focus(); this.close(); };
      } catch (e) { /* some browsers block constructing Notification in bg */ }
    }

    function tick() {
      if (stopped) return;
      var ids = (typeof getIds === 'function' ? getIds() : getIds) || [];
      if (!ids.length) { setTitle(0); prevTotal = 0; if (onUpdate) onUpdate({}, 0); return; }
      unreadCounts(ids, forRole).then(function (counts) {
        if (stopped) return;
        var total = 0;
        Object.keys(counts).forEach(function (k) { total += counts[k]; });
        setTitle(total);
        maybeNotify(total);
        prevTotal = total;
        if (onUpdate) onUpdate(counts, total);
      });
    }

    tick();
    timer = setInterval(tick, intervalMs || 8000);
    return {
      refresh: tick,
      stop: function () {
        stopped = true;
        if (timer) clearInterval(timer);
        document.title = baseTitle;
      }
    };
  }

  // Ask the browser for permission to show notifications (call from a user click).
  // Resolves to true if granted. Safe to call when unsupported/denied.
  function requestNotificationPermission() {
    if (typeof Notification === 'undefined') return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    try {
      return Notification.requestPermission().then(function (p) { return p === 'granted'; });
    } catch (e) { return Promise.resolve(false); }
  }

  window.LEBOKHU_CHAT = {
    mount: mount,
    getRequestByToken: getRequestByToken,
    unreadCounts: unreadCounts,
    watchUnread: watchUnread,
    requestNotificationPermission: requestNotificationPermission
  };
})();
