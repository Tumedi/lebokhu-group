/* ============================================================
   LeKhuBo Connect — my-applications.js
   Seeker dashboard: requires a logged-in seeker; lists their
   application history with statuses.
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
    s = s || 'submitted';
    return '<span class="badge app-' + esc(s) + '">' + esc(s) + '</span>';
  }

  // Logout
  var logout = document.getElementById('logoutBtn');
  if (logout) logout.addEventListener('click', function (e) {
    e.preventDefault(); AUTH.signOut().then(function () { location.href = 'index.html'; });
  });

  // Guard: must be a logged-in seeker
  AUTH.requireAuth('seeker').then(function (ctx) {
    var who = document.getElementById('who');
    if (who) who.textContent = (ctx.profile && (ctx.profile.full_name || ctx.profile.email)) || '';
    loadApplications(ctx.profile);
  }).catch(function () { /* requireAuth already redirected */ });

  function loadApplications(profile) {
    var client = AUTH.client();
    var countEl = document.getElementById('count');
    client.from('applications')
      .select('*')
      .eq('seeker_id', profile.id)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Error loading applications: ' + res.error.message; return; }
        render(res.data || []);
      });
  }

  function render(rows) {
    var tbody = document.getElementById('tbody');
    document.getElementById('count').textContent =
      rows.length + (rows.length === 1 ? ' application' : ' applications');
    document.getElementById('noRows').hidden = rows.length !== 0;

    // Stat cards
    function countStatus(s) { return rows.filter(function (r) { return (r.status || 'submitted') === s; }).length; }
    var cards = [
      { label: 'Total', value: rows.length },
      { label: 'Under Review', value: countStatus('reviewed') },
      { label: 'Shortlisted', value: countStatus('shortlisted') },
      { label: 'Hired', value: countStatus('hired') }
    ];
    document.getElementById('statCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');

    tbody.innerHTML = rows.map(function (r) {
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate(r.created_at)) + '</td>' +
        '<td>' + esc(r.job_title || '—') + '</td>' +
        '<td>' + esc(r.company || '—') + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
      '</tr>';
    }).join('');
  }
})();
