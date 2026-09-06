/* ============================================================
   LeBoKhu Group — admin.js
   Password-protected dashboard (Supabase Auth).
   - Login / logout
   - Load all job_seekers
   - Stats + breakdowns (sector / qualification / experience / location / CVs / over time)
   - Search + filter
   - Export to CSV
   - View / download CVs
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.LEBOKHU_SUPABASE;
  var loginView = document.getElementById('loginView');
  var dashView = document.getElementById('dashboardView');
  var loginForm = document.getElementById('loginForm');
  var loginStatus = document.getElementById('loginStatus');
  var logoutBtn = document.getElementById('logoutBtn');
  var adminUser = document.getElementById('adminUser');

  var ALL = [];      // all rows
  var VIEW = [];     // filtered rows

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- Not configured guard ---------- */
  if (!CFG || !CFG.isConfigured()) {
    document.getElementById('notConfigured').hidden = false;
    loginForm.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
    return;
  }
  var client = CFG.client();

  /* ---------- Session handling ---------- */
  function showDashboard(user) {
    loginView.hidden = true;
    dashView.hidden = false;
    logoutBtn.hidden = false;
    adminUser.textContent = user && user.email ? user.email : '';
    loadData();
  }
  function showLogin() {
    dashView.hidden = true;
    loginView.hidden = false;
    logoutBtn.hidden = true;
    adminUser.textContent = '';
  }

  client.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (session) showDashboard(session.user); else showLogin();
  });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginStatus.textContent = '';
    loginStatus.className = 'form-status';
    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    if (!email || !password) {
      loginStatus.textContent = 'Please enter your email and password.';
      loginStatus.className = 'form-status bad';
      return;
    }
    var btn = loginForm.querySelector('button');
    btn.disabled = true; btn.textContent = 'Signing in…';
    client.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        showDashboard(res.data.user);
      })
      .catch(function (err) {
        loginStatus.textContent = 'Login failed: ' + err.message;
        loginStatus.className = 'form-status bad';
      })
      .then(function () { btn.disabled = false; btn.textContent = 'Log In'; });
  });

  logoutBtn.addEventListener('click', function () {
    client.auth.signOut().then(showLogin);
  });

  /* ---------- Load data ---------- */
  function loadData() {
    var count = document.getElementById('count');
    count.textContent = 'Loading…';
    client.from(CFG.TABLE).select('*').order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { count.textContent = 'Error loading data: ' + res.error.message; return; }
        ALL = res.data || [];
        buildFilterOptions();
        applyFilters();
        renderStats();
      });
  }

  /* ---------- Filters ---------- */
  function uniqueSorted(key) {
    var set = {};
    ALL.forEach(function (r) { if (r[key]) set[r[key]] = true; });
    return Object.keys(set).sort();
  }
  function fillSelect(id, values) {
    var sel = document.getElementById(id);
    // keep the first ("All") option
    sel.length = 1;
    values.forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
    });
  }
  function buildFilterOptions() {
    fillSelect('fSector', uniqueSorted('preferred_sector'));
    fillSelect('fQual', uniqueSorted('qualification'));
    fillSelect('fExp', uniqueSorted('experience'));
  }

  function applyFilters() {
    var q = (document.getElementById('q').value || '').trim().toLowerCase();
    var sector = document.getElementById('fSector').value;
    var qual = document.getElementById('fQual').value;
    var exp = document.getElementById('fExp').value;
    var cvF = document.getElementById('fCv').value;

    VIEW = ALL.filter(function (r) {
      if (sector && r.preferred_sector !== sector) return false;
      if (qual && r.qualification !== qual) return false;
      if (exp && r.experience !== exp) return false;
      if (cvF === 'yes' && !r.cv_url) return false;
      if (cvF === 'no' && r.cv_url) return false;
      if (q) {
        var hay = [r.first_name, r.last_name, r.email, r.phone, r.location, r.skills, r.applying_for]
          .join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderTable();
  }

  ['q', 'fSector', 'fQual', 'fExp', 'fCv'].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.getElementById('exportBtn').addEventListener('click', exportCsv);

  /* ---------- Render table ---------- */
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-ZA') + ' ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }
  function renderTable() {
    var tbody = document.getElementById('tbody');
    document.getElementById('count').textContent = VIEW.length + ' of ' + ALL.length + ' registrations';
    document.getElementById('noRows').hidden = VIEW.length !== 0;
    tbody.innerHTML = VIEW.map(function (r) {
      var cv = r.cv_url
        ? '<a href="' + esc(r.cv_url) + '" target="_blank" rel="noopener" class="cv-link">Download</a>'
        : '<span class="muted">—</span>';
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate(r.created_at)) + '</td>' +
        '<td>' + esc((r.first_name || '') + ' ' + (r.last_name || '')) + '</td>' +
        '<td><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a><br><span class="muted">' + esc(r.phone) + '</span></td>' +
        '<td>' + esc(r.location) + '</td>' +
        '<td>' + esc(r.qualification) + '</td>' +
        '<td>' + esc(r.experience) + '</td>' +
        '<td>' + esc(r.preferred_sector) + '</td>' +
        '<td>' + esc(r.applying_for) + '</td>' +
        '<td class="skills-cell">' + esc(r.skills) + '</td>' +
        '<td>' + cv + '</td>' +
      '</tr>';
    }).join('');
  }

  /* ---------- Stats + breakdowns ---------- */
  function countBy(key) {
    var m = {};
    ALL.forEach(function (r) { var k = r[key] || '(not set)'; m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { label: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
  }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d; }

  function renderStats() {
    var total = ALL.length;
    var withCv = ALL.filter(function (r) { return !!r.cv_url; }).length;
    var last7 = ALL.filter(function (r) { return new Date(r.created_at) >= daysAgo(7); }).length;
    var last30 = ALL.filter(function (r) { return new Date(r.created_at) >= daysAgo(30); }).length;

    var cards = [
      { label: 'Total Registrations', value: total },
      { label: 'CVs Uploaded', value: withCv },
      { label: 'Last 7 Days', value: last7 },
      { label: 'Last 30 Days', value: last30 }
    ];
    document.getElementById('statCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');

    var groups = [
      { title: 'By Sector', data: countBy('preferred_sector') },
      { title: 'By Qualification', data: countBy('qualification') },
      { title: 'By Experience', data: countBy('experience') },
      { title: 'By Location', data: countBy('location') }
    ];
    var max = function (arr) { return arr.reduce(function (m, x) { return Math.max(m, x.n); }, 1); };
    document.getElementById('breakdowns').innerHTML = groups.map(function (g) {
      var mx = max(g.data);
      var rows = g.data.slice(0, 8).map(function (d) {
        var pct = Math.round((d.n / mx) * 100);
        return '<div class="bd-row"><span class="bd-label">' + esc(d.label) + '</span>' +
          '<span class="bd-bar"><span class="bd-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="bd-n">' + d.n + '</span></div>';
      }).join('');
      return '<div class="breakdown-card"><h3>' + g.title + '</h3>' + (rows || '<p class="muted">No data</p>') + '</div>';
    }).join('');
  }

  /* ---------- CSV export ---------- */
  function exportCsv() {
    if (!VIEW.length) { alert('Nothing to export with the current filters.'); return; }
    var cols = ['created_at', 'first_name', 'last_name', 'email', 'phone', 'location',
      'right_to_work', 'qualification', 'experience', 'preferred_sector', 'applying_for',
      'skills', 'consent', 'cv_filename', 'cv_url'];
    var head = cols.join(',');
    function cell(v) {
      v = v == null ? '' : String(v);
      if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
      return v;
    }
    var rows = VIEW.map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(','); });
    var csv = '\uFEFF' + head + '\n' + rows.join('\n'); // BOM for Excel
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lebokhu-registrations-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
})();
