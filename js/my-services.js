/* ============================================================
   LeKhuBo Connect — my-services.js
   Provider dashboard: requires a logged-in 'provider'. Shows
   their listing (with status) and the service requests sent to it.
   ============================================================ */
(function () {
  'use strict';

  var AUTH = window.LEBOKHU_AUTH;
  if (!(AUTH && AUTH.configured())) {
    var nc = document.getElementById('notConfigured');
    if (nc) nc.hidden = false;
    document.getElementById('count').textContent = '';
    return;
  }

  var CFG = window.LEBOKHU_SUPABASE;
  var client = AUTH.client();
  var myListingIds = [];
  var watchedIds = [];        // request ids currently shown (for the unread watcher)
  var unreadWatcher = null;   // live unread poller (chat.js watchUnread)

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-ZA') + ' ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }
  function provStatusBadge(s) {
    s = s || 'pending';
    var cls = s === 'approved' ? 'badge-approved' : (s === 'rejected' ? 'badge-declined' : 'badge-pending');
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }
  function reqStatusBadge(s) {
    s = s || 'new';
    var cls = s === 'completed' ? 'badge-approved' : (s === 'closed' ? 'badge-closed'
      : (s === 'contacted' ? 'badge-pending' : 'badge-live'));
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }

  var logout = document.getElementById('logoutBtn');
  if (logout) logout.addEventListener('click', function (e) {
    e.preventDefault(); AUTH.signOut().then(function () { location.href = 'index.html'; });
  });

  AUTH.requireAuth('provider').then(function (ctx) {
    var who = document.getElementById('who');
    if (who) who.textContent = (ctx.profile && (ctx.profile.full_name || ctx.profile.email)) || '';
    var lo = document.getElementById('logoutBtn'); if (lo) lo.hidden = false;
    loadListing(ctx.profile);
  }).catch(function () { /* redirected */ });

  function loadListing(profile) {
    client.from(CFG.PROVIDERS_TABLE).select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(function (res) {
        var box = document.getElementById('listingBox');
        var listings = (res && res.data) || [];
        myListingIds = listings.map(function (l) { return l.id; });
        if (!listings.length) {
          box.innerHTML = '<div class="notice">You haven\'t listed a service yet. ' +
            '<a href="list-service.html">Create your listing</a> to appear in the directory.</div>';
        } else {
          box.innerHTML = listings.map(function (p) {
            var photo = p.photo_url ? '<img src="' + esc(p.photo_url) + '" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--gold)">' : '';
            var rating = p.rating_count ? ' &middot; ⭐ ' + Number(p.rating_avg).toFixed(1) + ' (' + p.rating_count + ')' : '';
            return '<div class="about-card" style="margin-bottom:16px">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
                '<h3 style="margin:0;display:flex;align-items:center;gap:10px">' + photo +
                  '<span>' + esc(p.service) + ' — ' + esc(p.full_name) + rating + '</span></h3>' +
                provStatusBadge(p.status) +
              '</div>' +
              '<p class="prov-meta" style="margin-top:10px">' +
                (p.location ? '<span>📍 ' + esc(p.location) + '</span>' : '') +
                (p.rate ? '<span>💰 ' + esc(p.rate) + '</span>' : '') +
                (p.experience ? '<span>🧰 ' + esc(p.experience) + '</span>' : '') +
              '</p>' +
              (p.bio ? '<p style="color:var(--slate);margin-top:8px">' + esc(p.bio) + '</p>' : '') +
              (p.status === 'pending' ? '<p class="hint">⏳ Your listing is awaiting approval.</p>' : '') +
              (p.status === 'rejected' ? '<p class="hint">This listing was not approved. You can edit and resubmit it.</p>' : '') +
            '</div>';
          }).join('');
        }
        loadRequests();
      });
  }

  function loadRequests() {
    var countEl = document.getElementById('count');
    // RLS returns only requests for this provider's listings.
    client.from(CFG.REQUESTS_TABLE).select('*').order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Error loading requests: ' + res.error.message; return; }
        render(res.data || []);
      });
  }

  function render(rows) {
    document.getElementById('count').textContent =
      rows.length + (rows.length === 1 ? ' request' : ' requests');
    document.getElementById('noRows').hidden = rows.length !== 0;

    function cs(s) { return rows.filter(function (r) { return (r.status || 'new') === s; }).length; }
    var cards = [
      { label: 'Total Requests', value: rows.length },
      { label: 'New', value: cs('new') },
      { label: 'Contacted', value: cs('contacted') },
      { label: 'Completed', value: cs('completed') }
    ];
    document.getElementById('statCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');

    var tbody = document.getElementById('tbody');
    tbody.innerHTML = rows.map(function (r) {
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate(r.created_at)) + '</td>' +
        '<td>' + esc(r.homeowner_name || '—') + '</td>' +
        '<td><a href="tel:' + esc(r.homeowner_phone) + '">' + esc(r.homeowner_phone) + '</a>' +
          (r.homeowner_email ? '<br><span class="muted">' + esc(r.homeowner_email) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.location || '—') + '</td>' +
        '<td class="skills-cell">' + esc(r.details || '') + '</td>' +
        '<td>' + reqStatusBadge(r.status) + '</td>' +
        '<td><button class="mini-btn" data-chat="' + esc(r.id) + '" data-name="' + esc(r.homeowner_name || 'Homeowner') +
          '" data-email="' + esc(r.homeowner_email || '') + '" data-service="' + esc(r.service || '') +
          '">💬 Chat<span class="unread-badge" data-badge="' + esc(r.id) + '" hidden></span></button></td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-chat]').forEach(function (b) {
      b.addEventListener('click', function () {
        openChat(b.getAttribute('data-chat'), b.getAttribute('data-name'),
          b.getAttribute('data-email'), b.getAttribute('data-service'));
        // Clear the badge optimistically after opening
        var badge = b.querySelector('[data-badge]');
        if (badge) { badge.hidden = true; }
      });
    });

    // Keep the list of request ids current for the unread watcher.
    watchedIds = rows.map(function (r) { return r.id; });
    var baseCount = document.getElementById('count').textContent;

    // Live unread badges: refresh on a timer so new messages surface while the
    // dashboard is open (and flash the browser tab title).
    if (window.LEBOKHU_CHAT && window.LEBOKHU_CHAT.watchUnread) {
      if (unreadWatcher) unreadWatcher.stop();
      unreadWatcher = window.LEBOKHU_CHAT.watchUnread(
        function () { return watchedIds; },
        'provider',
        function (counts, total) {
          // Update each row badge.
          watchedIds.forEach(function (id) {
            var badge = tbody.querySelector('[data-badge="' + id + '"]');
            if (!badge) return;
            var n = counts[id] || 0;
            if (n > 0) { badge.textContent = n; badge.hidden = false; }
            else { badge.hidden = true; }
          });
          // Reflect the total on the count line.
          var c = document.getElementById('count');
          if (c) {
            c.textContent = total > 0
              ? baseCount + ' · ' + total + ' unread message' + (total === 1 ? '' : 's')
              : baseCount;
          }
        },
        8000,
        { notifyTitle: 'New message — LeKhuBo Connect',
          notifyBody: 'A potential employer sent you a new chat message.' }
      );
    }
  }

  /* ---- Chat modal (provider side) ---- */
  var chatModal = document.getElementById('chatModal');
  var chatWith = document.getElementById('chatWith');
  var chatMount = document.getElementById('chatMount');
  var chatWidget = null;
  var providerName = '';

  AUTH.getProfile().then(function (p) { providerName = (p && (p.company || p.full_name)) || 'Provider'; });

  function openChat(requestId, homeownerName, homeownerEmail, service) {
    // First chat opened this session is a good moment to ask for notifications.
    if (window.LEBOKHU_CHAT && window.LEBOKHU_CHAT.requestNotificationPermission) {
      window.LEBOKHU_CHAT.requestNotificationPermission();
    }
    if (chatWidget) chatWidget.stop();
    chatWith.textContent = 'Conversation with ' + (homeownerName || 'homeowner');
    chatMount.innerHTML = '';
    chatModal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (window.LEBOKHU_CHAT) {
      chatWidget = window.LEBOKHU_CHAT.mount({
        container: chatMount,
        requestId: requestId,
        sender: 'provider',
        senderName: providerName,
        recipientEmail: homeownerEmail || '',
        recipientName: homeownerName || '',
        service: service || ''
      });
    }
  }
  function closeChat() {
    if (chatWidget) { chatWidget.stop(); chatWidget = null; }
    chatModal.hidden = true; document.body.style.overflow = '';
    // Reading the thread marked messages read — refresh badges right away.
    if (unreadWatcher) unreadWatcher.refresh();
  }
  if (chatModal) {
    chatModal.querySelectorAll('[data-cclose]').forEach(function (el) { el.addEventListener('click', closeChat); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChat(); });
  }
})();
