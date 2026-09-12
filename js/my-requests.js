/* ============================================================
   LeKhuBo Connect — my-requests.js
   Homeowner dashboard: requires a logged-in 'homeowner'. Lists
   their service requests and lets them reopen each chat anytime
   (so they never lose a conversation with a provider).
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
  var profile = null;
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
  function statusBadge(s) {
    s = s || 'new';
    var cls = s === 'completed' ? 'badge-approved' : (s === 'closed' ? 'badge-closed'
      : (s === 'contacted' ? 'badge-pending' : 'badge-live'));
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }

  var logout = document.getElementById('logoutBtn');
  if (logout) logout.addEventListener('click', function (e) {
    e.preventDefault(); AUTH.signOut().then(function () { location.href = 'index.html'; });
  });

  AUTH.requireAuth('homeowner').then(function (ctx) {
    profile = ctx.profile;
    var who = document.getElementById('who');
    if (who) who.textContent = (profile && (profile.full_name || profile.email)) || '';
    var lo = document.getElementById('logoutBtn'); if (lo) lo.hidden = false;
    loadRequests();
  }).catch(function () { /* redirected */ });

  function loadRequests() {
    var countEl = document.getElementById('count');
    // RLS returns only this homeowner's own requests.
    client.from(CFG.REQUESTS_TABLE).select('*').eq('homeowner_id', profile.id)
      .order('created_at', { ascending: false })
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
      { label: 'In Progress', value: cs('contacted') },
      { label: 'Completed', value: cs('completed') }
    ];
    document.getElementById('statCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');

    var tbody = document.getElementById('tbody');
    tbody.innerHTML = rows.map(function (r) {
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate(r.created_at)) + '</td>' +
        '<td>' + esc(r.provider_name || '—') + '</td>' +
        '<td>' + esc(r.service || '—') + '</td>' +
        '<td class="skills-cell">' + esc(r.details || '') + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td><button class="mini-btn" data-chat="' + esc(r.id) + '" data-who="' + esc(r.provider_name || 'Provider') +
          '">💬 Chat<span class="unread-badge" data-badge="' + esc(r.id) + '" hidden></span></button></td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-chat]').forEach(function (b) {
      b.addEventListener('click', function () {
        openChat(b.getAttribute('data-chat'), b.getAttribute('data-who'));
        var badge = b.querySelector('[data-badge]');
        if (badge) badge.hidden = true;   // clear optimistically on open
      });
    });

    // Live unread badges for the homeowner (messages from the provider/admin).
    watchedIds = rows.map(function (r) { return r.id; });
    var baseCount = document.getElementById('count').textContent;
    if (window.LEBOKHU_CHAT && window.LEBOKHU_CHAT.watchUnread) {
      if (unreadWatcher) unreadWatcher.stop();
      unreadWatcher = window.LEBOKHU_CHAT.watchUnread(
        function () { return watchedIds; },
        'homeowner',
        function (counts, total) {
          watchedIds.forEach(function (id) {
            var badge = tbody.querySelector('[data-badge="' + id + '"]');
            if (!badge) return;
            var n = counts[id] || 0;
            if (n > 0) { badge.textContent = n; badge.hidden = false; }
            else { badge.hidden = true; }
          });
          var c = document.getElementById('count');
          if (c) {
            c.textContent = total > 0
              ? baseCount + ' · ' + total + ' unread message' + (total === 1 ? '' : 's')
              : baseCount;
          }
        }
      );
    }
  }

  /* ---- Chat modal ---- */
  var chatModal = document.getElementById('chatModal');
  var chatWith = document.getElementById('chatWith');
  var chatMount = document.getElementById('chatMount');
  var chatWidget = null;

  function openChat(requestId, providerName) {
    if (chatWidget) chatWidget.stop();
    chatWith.textContent = 'Conversation with ' + (providerName || 'provider');
    chatMount.innerHTML = '';
    chatModal.hidden = false;
    document.body.style.overflow = 'hidden';
    if (window.LEBOKHU_CHAT) {
      chatWidget = window.LEBOKHU_CHAT.mount({
        container: chatMount,
        requestId: requestId,
        sender: 'homeowner',
        senderName: (profile && profile.full_name) || 'Homeowner'
      });
    }
  }
  function closeChat() {
    if (chatWidget) { chatWidget.stop(); chatWidget = null; }
    chatModal.hidden = true; document.body.style.overflow = '';
    if (unreadWatcher) unreadWatcher.refresh();   // reading cleared unread — refresh badges
  }
  if (chatModal) {
    chatModal.querySelectorAll('[data-cclose]').forEach(function (el) { el.addEventListener('click', closeChat); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChat(); });
  }
})();
