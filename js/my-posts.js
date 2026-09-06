/* ============================================================
   LeBoKhu Group — my-posts.js
   Employer dashboard: requires a logged-in employer; lists their
   own job posts with status + applicant counts, and lets them
   close / reopen / delete their posts.
   ============================================================ */
(function () {
  'use strict';

  var AUTH = window.LEBOKHU_AUTH;
  if (!AUTH || !AUTH.configured()) {
    var nc = document.getElementById('notConfigured');
    if (nc) nc.hidden = false;
    document.getElementById('count').textContent = '';
    return;
  }

  var CFG = window.LEBOKHU_SUPABASE;
  var client = AUTH.client();
  var MY = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-ZA');
  }
  function statusBadge(s) {
    s = s || 'pending';
    var cls = s === 'approved' ? 'badge-approved'
      : (s === 'closed' ? 'badge-closed'
      : (s === 'declined' ? 'badge-declined' : 'badge-pending'));
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }

  var logout = document.getElementById('logoutBtn');
  if (logout) logout.addEventListener('click', function (e) {
    e.preventDefault(); AUTH.signOut().then(function () { location.href = 'index.html'; });
  });

  AUTH.requireAuth('employer').then(function (ctx) {
    var who = document.getElementById('who');
    if (who) who.textContent = (ctx.profile && (ctx.profile.company || ctx.profile.full_name || ctx.profile.email)) || '';
    loadPosts(ctx.profile);
  }).catch(function () { /* redirected */ });

  function loadPosts(profile) {
    var countEl = document.getElementById('count');
    client.from(CFG.POSTS_TABLE)
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Error loading posts: ' + res.error.message; return; }
        MY = res.data || [];
        return loadCounts().then(function () { render(); });
      });
  }

  // Count applications per post (employer can read apps to their own posts via RLS)
  var counts = {};
  function loadCounts() {
    var ids = MY.map(function (p) { return p.id; });
    if (!ids.length) return Promise.resolve();
    return client.from('applications').select('job_id').in('job_id', ids)
      .then(function (res) {
        counts = {};
        if (res.data) res.data.forEach(function (a) { counts[a.job_id] = (counts[a.job_id] || 0) + 1; });
      }).catch(function () { counts = {}; });
  }

  function render() {
    var tbody = document.getElementById('tbody');
    document.getElementById('count').textContent =
      MY.length + (MY.length === 1 ? ' job post' : ' job posts');
    document.getElementById('noRows').hidden = MY.length !== 0;

    function cs(s) { return MY.filter(function (p) { return (p.status || 'pending') === s; }).length; }
    var totalApps = Object.keys(counts).reduce(function (n, k) { return n + counts[k]; }, 0);
    var cards = [
      { label: 'Total Posts', value: MY.length },
      { label: 'Approved (live)', value: cs('approved') },
      { label: 'Pending', value: cs('pending') },
      { label: 'Total Applicants', value: totalApps }
    ];
    document.getElementById('statCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');

    tbody.innerHTML = MY.map(function (p) {
      var actions = '';
      if (p.status !== 'closed') actions += '<button class="mini-btn close" data-close="' + esc(p.id) + '">Close</button>';
      if (p.status === 'closed') actions += '<button class="mini-btn" data-reopen="' + esc(p.id) + '">Reopen</button>';
      actions += '<button class="mini-btn danger" data-del="' + esc(p.id) + '">Delete</button>';
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate(p.created_at)) + '</td>' +
        '<td>' + statusBadge(p.status) + '</td>' +
        '<td>' + esc(p.title) + '</td>' +
        '<td>' + esc(p.sector) + '</td>' +
        '<td>' + esc(p.level) + '</td>' +
        '<td>' + esc(p.location) + '</td>' +
        '<td>' + esc(p.job_type) + '</td>' +
        '<td><strong>' + (counts[p.id] || 0) + '</strong></td>' +
        '<td class="actions-cell">' + actions + '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { setStatus(b.getAttribute('data-close'), 'closed'); });
    });
    tbody.querySelectorAll('[data-reopen]').forEach(function (b) {
      b.addEventListener('click', function () { setStatus(b.getAttribute('data-reopen'), 'pending'); });
    });
    tbody.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { del(b.getAttribute('data-del')); });
    });
  }

  function setStatus(id, status) {
    client.from(CFG.POSTS_TABLE).update({ status: status }).eq('id', id)
      .then(function (res) {
        if (res.error) { alert('Update failed: ' + res.error.message); return; }
        var p = MY.filter(function (x) { return x.id === id; })[0];
        if (p) p.status = status;
        render();
      });
  }
  function del(id) {
    if (!confirm('Delete this job post permanently?')) return;
    client.from(CFG.POSTS_TABLE).delete().eq('id', id)
      .then(function (res) {
        if (res.error) { alert('Delete failed: ' + res.error.message); return; }
        MY = MY.filter(function (x) { return x.id !== id; });
        render();
      });
  }
})();
