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
    loadPosts();
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
  document.getElementById('refreshBtn').addEventListener('click', function () {
    if (activeTab === 'posts') loadPosts(); else loadData();
  });
  document.getElementById('exportBtn').addEventListener('click', function () {
    if (activeTab === 'posts') exportPostsCsv(); else exportCsv();
  });

  /* ---------- Tab switching ---------- */
  var activeTab = 'seekers';
  var tabSeekers = document.getElementById('tabSeekers');
  var tabPosts = document.getElementById('tabPosts');
  var panelSeekers = document.getElementById('panelSeekers');
  var panelPosts = document.getElementById('panelPosts');
  function switchTab(tab) {
    activeTab = tab;
    var isPosts = tab === 'posts';
    tabPosts.classList.toggle('active', isPosts);
    tabSeekers.classList.toggle('active', !isPosts);
    tabPosts.setAttribute('aria-selected', isPosts ? 'true' : 'false');
    tabSeekers.setAttribute('aria-selected', !isPosts ? 'true' : 'false');
    panelPosts.hidden = !isPosts;
    panelSeekers.hidden = isPosts;
  }
  tabSeekers.addEventListener('click', function () { switchTab('seekers'); });
  tabPosts.addEventListener('click', function () { switchTab('posts'); });

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
    downloadCsv(csv, 'lebokhu-registrations');
  }

  function downloadCsv(csv, base) {
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = base + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function csvCell(v) {
    v = v == null ? '' : String(v);
    if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }
  function fmtDate2(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('en-ZA') + ' ' + d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  /* ============================================================
     JOB POSTS (employer submissions)
     ============================================================ */
  var POSTS = [];       // all posts
  var POSTS_VIEW = [];  // filtered

  function loadPosts() {
    var count = document.getElementById('postCount');
    count.textContent = 'Loading…';
    client.from(CFG.POSTS_TABLE).select('*').order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { count.textContent = 'Error loading posts: ' + res.error.message; return; }
        POSTS = res.data || [];
        buildPostFilterOptions();
        applyPostFilters();
        renderPostStats();
      });
  }

  function postUnique(key) {
    var set = {};
    POSTS.forEach(function (r) { if (r[key]) set[r[key]] = true; });
    return Object.keys(set).sort();
  }
  function buildPostFilterOptions() {
    fillSelect('pSector', postUnique('sector'));
    fillSelect('pLevel', postUnique('level'));
    fillSelect('pLoc', postUnique('location'));
  }

  function applyPostFilters() {
    var q = (document.getElementById('pq').value || '').trim().toLowerCase();
    var st = document.getElementById('pStatus').value;
    var sector = document.getElementById('pSector').value;
    var level = document.getElementById('pLevel').value;
    var loc = document.getElementById('pLoc').value;

    POSTS_VIEW = POSTS.filter(function (r) {
      if (st && r.status !== st) return false;
      if (sector && r.sector !== sector) return false;
      if (level && r.level !== level) return false;
      if (loc && r.location !== loc) return false;
      if (q) {
        var hay = [r.company, r.title, r.contact_name, r.contact_email, r.description]
          .join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderPostTable();
  }

  ['pq', 'pStatus', 'pSector', 'pLevel', 'pLoc'].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('input', applyPostFilters);
    el.addEventListener('change', applyPostFilters);
  });

  function statusBadge(s) {
    var cls = s === 'approved' ? 'badge-approved' : (s === 'closed' ? 'badge-closed' : 'badge-pending');
    return '<span class="badge ' + cls + '">' + esc(s || 'pending') + '</span>';
  }

  function renderPostTable() {
    var tbody = document.getElementById('postTbody');
    document.getElementById('postCount').textContent =
      POSTS_VIEW.length + ' of ' + POSTS.length + ' job posts';
    document.getElementById('postNoRows').hidden = POSTS_VIEW.length !== 0;
    tbody.innerHTML = POSTS_VIEW.map(function (r) {
      var actions = '';
      if (r.status !== 'approved') actions += '<button class="mini-btn approve" data-approve="' + r.id + '">Approve</button>';
      if (r.status === 'approved' && r.contact_email) actions += '<button class="mini-btn email" data-email="' + r.id + '">✉ Email</button>';
      if (r.status !== 'closed') actions += '<button class="mini-btn close" data-close="' + r.id + '">Close</button>';
      if (r.status !== 'pending') actions += '<button class="mini-btn" data-pending="' + r.id + '">Set pending</button>';
      actions += '<button class="mini-btn danger" data-del="' + r.id + '">Delete</button>';
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate2(r.created_at)) + '</td>' +
        '<td>' + statusBadge(r.status) + '</td>' +
        '<td>' + esc(r.company) + '</td>' +
        '<td>' + esc(r.title) + '</td>' +
        '<td>' + esc(r.sector) + '</td>' +
        '<td>' + esc(r.level) + '</td>' +
        '<td>' + esc(r.location) + '</td>' +
        '<td>' + esc(r.job_type) + '</td>' +
        '<td><a href="mailto:' + esc(r.contact_email) + '">' + esc(r.contact_email) + '</a>' +
          (r.contact_phone ? '<br><span class="muted">' + esc(r.contact_phone) + '</span>' : '') + '</td>' +
        '<td class="skills-cell">' + esc(r.description) + '</td>' +
        '<td class="actions-cell">' + actions + '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-approve]').forEach(function (b) {
      b.addEventListener('click', function () { setStatus(b.getAttribute('data-approve'), 'approved'); });
    });
    tbody.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { setStatus(b.getAttribute('data-close'), 'closed'); });
    });
    tbody.querySelectorAll('[data-pending]').forEach(function (b) {
      b.addEventListener('click', function () { setStatus(b.getAttribute('data-pending'), 'pending'); });
    });
    tbody.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { deletePost(b.getAttribute('data-del')); });
    });
    tbody.querySelectorAll('[data-email]').forEach(function (b) {
      b.addEventListener('click', function () { window.__lebokhuEmailApproved(b.getAttribute('data-email')); });
    });
  }

  // Build a pre-filled approval email (opens in the admin's own mail app).
  // This is free and reliable — it sends from YOUR real address, so the
  // employer sees it genuinely comes from LeBoKhu Group.
  function openApprovalEmail(post) {
    if (!post || !post.contact_email) {
      alert('This post has no contact email on record, so no email could be prepared.');
      return;
    }
    var name = post.contact_name || post.company || 'there';
    var subject = 'Your job post has been approved — LeBoKhu Group';
    var body =
      'Hi ' + name + ',\n\n' +
      'Good news! Your job post with LeBoKhu Group has been APPROVED and is now live on our Jobs page.\n\n' +
      'Post details:\n' +
      '- Job title: ' + (post.title || '') + '\n' +
      '- Company: ' + (post.company || '') + '\n' +
      '- Sector: ' + (post.sector || '') + '\n' +
      '- Location: ' + (post.location || '') + '\n' +
      '- Type: ' + (post.job_type || '') + '\n\n' +
      'Job seekers can now view and apply for this role. We will be in touch as suitable candidates come through.\n\n' +
      'Thank you for partnering with us to connect people, resources and opportunity.\n\n' +
      'Kind regards,\n' +
      'LeBoKhu Group\n' +
      'Tbmadihlaba@gmail.com | 081 798 6359';

    var href = 'mailto:' + encodeURIComponent(post.contact_email) +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    window.location.href = href;
  }

  // Try to send the approval email automatically via the Supabase Edge
  // Function (Resend). Resolves { sent:true } on success, or { sent:false }
  // if the function isn't deployed / errors — so the caller can fall back.
  function sendApprovalAuto(post) {
    if (!post || !post.contact_email || !client.functions) {
      return Promise.resolve({ sent: false });
    }
    return client.functions.invoke('send-approval-email', {
      body: {
        contact_email: post.contact_email,
        contact_name: post.contact_name || '',
        company: post.company || '',
        title: post.title || '',
        sector: post.sector || '',
        location: post.location || '',
        job_type: post.job_type || ''
      }
    }).then(function (res) {
      var ok = res && !res.error && res.data && res.data.success;
      return { sent: !!ok, error: res && res.error };
    }).catch(function () { return { sent: false }; });
  }

  function setStatus(id, status) {
    client.from(CFG.POSTS_TABLE).update({ status: status }).eq('id', id)
      .then(function (res) {
        if (res.error) { alert('Update failed: ' + res.error.message); return; }
        var p = POSTS.filter(function (x) { return x.id === id; })[0];
        if (p) p.status = status;
        applyPostFilters(); renderPostStats();

        // On approval, notify the employer — automatically if the Edge
        // Function is available, otherwise via a pre-filled email.
        if (status === 'approved' && p && p.contact_email) {
          sendApprovalAuto(p).then(function (r) {
            if (r.sent) {
              alert('Approved ✓ — a confirmation email was sent automatically to ' + p.contact_email);
            } else if (confirm('Approved ✓\n\nAutomatic email is not available yet.\n' +
                'Click OK to open a ready-to-send email to ' + p.contact_email + '.')) {
              openApprovalEmail(p);
            }
          });
        }
      });
  }

  // Re-send the approval email any time from a row button (auto first, else mailto)
  window.__lebokhuEmailApproved = function (id) {
    var p = POSTS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    sendApprovalAuto(p).then(function (r) {
      if (r.sent) alert('A confirmation email was sent automatically to ' + p.contact_email);
      else openApprovalEmail(p);
    });
  };
  function deletePost(id) {
    if (!confirm('Delete this job post permanently?')) return;
    client.from(CFG.POSTS_TABLE).delete().eq('id', id)
      .then(function (res) {
        if (res.error) { alert('Delete failed: ' + res.error.message); return; }
        POSTS = POSTS.filter(function (x) { return x.id !== id; });
        applyPostFilters(); renderPostStats();
      });
  }

  function renderPostStats() {
    var total = POSTS.length;
    var pending = POSTS.filter(function (r) { return r.status === 'pending'; }).length;
    var approved = POSTS.filter(function (r) { return r.status === 'approved'; }).length;
    var last30 = POSTS.filter(function (r) { return new Date(r.created_at) >= daysAgo(30); }).length;
    var cards = [
      { label: 'Total Job Posts', value: total },
      { label: 'Pending Review', value: pending },
      { label: 'Approved (live)', value: approved },
      { label: 'Last 30 Days', value: last30 }
    ];
    document.getElementById('postStatCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');
  }

  function exportPostsCsv() {
    if (!POSTS_VIEW.length) { alert('Nothing to export with the current filters.'); return; }
    var cols = ['created_at', 'status', 'company', 'contact_name', 'contact_email', 'contact_phone',
      'title', 'sector', 'level', 'location', 'job_type', 'closing_date', 'description'];
    var head = cols.join(',');
    var rows = POSTS_VIEW.map(function (r) { return cols.map(function (c) { return csvCell(r[c]); }).join(','); });
    var csv = '\uFEFF' + head + '\n' + rows.join('\n');
    downloadCsv(csv, 'lebokhu-job-posts');
  }
})();
