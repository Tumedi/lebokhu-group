/* ============================================================
   LeKhuBo Connect — admin.js
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

  // Always start with Log out hidden — only shown once a session is confirmed.
  if (logoutBtn) logoutBtn.hidden = true;

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
  // Verify the logged-in user is actually an admin before showing the
  // dashboard. Non-admins are refused (and signed out of this page).
  function gateAndShow(user) {
    return client.from('profiles').select('role').eq('id', user.id).single()
      .then(function (res) {
        var role = res.data && res.data.role;
        if (role === 'admin') {
          showDashboard(user);
        } else {
          denyAccess();
        }
      })
      .catch(function () { denyAccess(); });
  }

  function denyAccess() {
    // Not an admin (e.g. a job seeker or homeowner account) — never show the
    // dashboard. Hide it, show the login view with a clear message, clear the
    // form, and sign this session out of the admin context.
    showLogin();
    var email = document.getElementById('loginEmail');
    var pwd = document.getElementById('loginPassword');
    if (email) email.value = '';
    if (pwd) pwd.value = '';
    loginStatus.textContent = 'Access denied: this account is not an administrator. ' +
      'Job seeker and homeowner accounts cannot open the admin dashboard.';
    loginStatus.className = 'form-status bad';
    client.auth.signOut().catch(function () {});
  }

  function showDashboard(user) {
    loginView.hidden = true;
    dashView.hidden = false;
    logoutBtn.hidden = false;
    adminUser.textContent = user && user.email ? user.email : '';
    loadData();
    loadPosts();
    loadApps();
    loadProviders();
    loadRequests();
    loadReviews();
  }
  function showLogin() {
    dashView.hidden = true;
    loginView.hidden = false;
    logoutBtn.hidden = true;
    adminUser.textContent = '';
  }

  client.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (session) gateAndShow(session.user); else showLogin();
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
        return gateAndShow(res.data.user);
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
    if (activeTab === 'posts') loadPosts();
    else if (activeTab === 'apps') loadApps();
    else if (activeTab === 'providers') loadProviders();
    else if (activeTab === 'requests') loadRequests();
    else if (activeTab === 'reviews') loadReviews();
    else loadData();
  });
  document.getElementById('exportBtn').addEventListener('click', function () {
    if (activeTab === 'posts') exportPostsCsv();
    else if (activeTab === 'apps') exportAppsCsv();
    else if (activeTab === 'providers') exportProvidersCsv();
    else if (activeTab === 'requests') exportRequestsCsv();
    else if (activeTab === 'reviews') exportReviewsCsv();
    else exportCsv();
  });

  /* ---------- Tab switching ---------- */
  var activeTab = 'seekers';
  var tabs = {
    seekers: document.getElementById('tabSeekers'),
    posts: document.getElementById('tabPosts'),
    apps: document.getElementById('tabApps'),
    providers: document.getElementById('tabProviders'),
    requests: document.getElementById('tabRequests'),
    reviews: document.getElementById('tabReviews')
  };
  var panels = {
    seekers: document.getElementById('panelSeekers'),
    posts: document.getElementById('panelPosts'),
    apps: document.getElementById('panelApps'),
    providers: document.getElementById('panelProviders'),
    requests: document.getElementById('panelRequests'),
    reviews: document.getElementById('panelReviews')
  };
  function switchTab(tab) {
    activeTab = tab;
    Object.keys(tabs).forEach(function (k) {
      if (!tabs[k]) return;
      var on = (k === tab);
      tabs[k].classList.toggle('active', on);
      tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
      if (panels[k]) panels[k].hidden = !on;
    });
  }
  Object.keys(tabs).forEach(function (k) {
    if (tabs[k]) tabs[k].addEventListener('click', function () { switchTab(k); });
  });

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
      var notify = r.email
        ? '<button class="mini-btn match" data-notify="' + esc(r.id) + '">Notify</button>'
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
        '<td>' + notify + '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-notify]').forEach(function (b) {
      b.addEventListener('click', function () { openMatch(b.getAttribute('data-notify')); });
    });
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
    var cls = s === 'approved' ? 'badge-approved'
      : (s === 'closed' ? 'badge-closed'
      : (s === 'declined' ? 'badge-declined' : 'badge-pending'));
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
      if (r.status !== 'declined') actions += '<button class="mini-btn decline" data-decline="' + r.id + '">Decline</button>';
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
    tbody.querySelectorAll('[data-decline]').forEach(function (b) {
      b.addEventListener('click', function () { declinePost(b.getAttribute('data-decline')); });
    });
  }

  // Build a pre-filled approval email (opens in the admin's own mail app).
  // This is free and reliable — it sends from YOUR real address, so the
  // employer sees it genuinely comes from LeKhuBo Connect.
  function openApprovalEmail(post) {
    if (!post || !post.contact_email) {
      alert('This post has no contact email on record, so no email could be prepared.');
      return;
    }
    var name = post.contact_name || post.company || 'there';
    var subject = 'Your job post has been approved — LeKhuBo Connect';
    var body =
      'Hi ' + name + ',\n\n' +
      'Good news! Your job post with LeKhuBo Connect has been APPROVED and is now live on our Jobs page.\n\n' +
      'Post details:\n' +
      '- Job title: ' + (post.title || '') + '\n' +
      '- Company: ' + (post.company || '') + '\n' +
      '- Sector: ' + (post.sector || '') + '\n' +
      '- Location: ' + (post.location || '') + '\n' +
      '- Type: ' + (post.job_type || '') + '\n\n' +
      'Job seekers can now view and apply for this role. We will be in touch as suitable candidates come through.\n\n' +
      'Thank you for partnering with us to connect people, resources and opportunity.\n\n' +
      'Kind regards,\n' +
      'LeKhuBo Connect\n' +
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

  // Decline a post: set status to 'declined' and notify the employer.
  function declinePost(id) {
    var p = POSTS.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (!confirm('Decline this job post?\n\n"' + (p.title || '') + '" from ' + (p.company || '') +
        '\n\nThe employer will be notified by email.')) return;
    var reason = prompt('Optional: add a short reason to include in the email to the employer ' +
      '(leave blank to send a general message).', '') || '';

    client.from(CFG.POSTS_TABLE).update({ status: 'declined' }).eq('id', id)
      .then(function (res) {
        if (res.error) { alert('Update failed: ' + res.error.message); return; }
        p.status = 'declined';
        applyPostFilters(); renderPostStats();

        if (!p.contact_email) { alert('Declined ✓ (no contact email on record to notify).'); return; }
        sendDeclinedAuto(p, reason).then(function (r) {
          if (r.sent) {
            alert('Declined ✓ — the employer was notified automatically at ' + p.contact_email);
          } else if (confirm('Declined ✓\n\nAutomatic email is not available.\n' +
              'Click OK to open a ready-to-send email to ' + p.contact_email + '.')) {
            openDeclinedEmail(p, reason);
          }
        });
      });
  }

  function sendDeclinedAuto(post, reason) {
    if (!post || !post.contact_email || !client.functions) return Promise.resolve({ sent: false });
    return client.functions.invoke('send-declined-email', {
      body: {
        contact_email: post.contact_email,
        contact_name: post.contact_name || '',
        company: post.company || '',
        title: post.title || '',
        reason: reason || ''
      }
    }).then(function (res) {
      var ok = res && !res.error && res.data && res.data.success;
      return { sent: !!ok };
    }).catch(function () { return { sent: false }; });
  }

  function openDeclinedEmail(post, reason) {
    var name = post.contact_name || post.company || 'there';
    var subject = 'Update on your job post — LeKhuBo Connect';
    var body =
      'Hi ' + name + ',\n\n' +
      'Thank you for submitting your job post "' + (post.title || '') + '"' +
      (post.company ? ' for ' + post.company : '') + ' with LeKhuBo Connect.\n\n' +
      'After review, we\'re unable to publish this post in its current form.\n' +
      (reason ? '\nNote from our team: ' + reason + '\n' : '') +
      '\nWe\'d love to help you find the right people. Please feel free to submit an updated post ' +
      'or reply to this email and our team will assist you.\n\n' +
      'Kind regards,\nLeKhuBo Connect\nTbmadihlaba@gmail.com | 081 798 6359';
    window.location.href = 'mailto:' + encodeURIComponent(post.contact_email) +
      '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
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

  /* ============================================================
     APPLICATIONS — view & manage statuses (admin)
     ============================================================ */
  var APPS = [];
  var APPS_VIEW = [];
  var APP_STATUSES = ['submitted', 'reviewed', 'shortlisted', 'rejected', 'hired'];

  function loadApps() {
    var countEl = document.getElementById('appCount');
    if (!countEl) return;
    countEl.textContent = 'Loading…';
    client.from('applications').select('*').order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) {
          countEl.textContent = 'Error loading applications: ' + res.error.message +
            ' (make sure your account role is set to admin — see supabase-auth.sql).';
          return;
        }
        APPS = res.data || [];
        applyAppFilters();
        renderAppStats();
      });
  }

  function applyAppFilters() {
    var q = (document.getElementById('aq').value || '').trim().toLowerCase();
    var st = document.getElementById('aStatus').value;
    APPS_VIEW = APPS.filter(function (r) {
      if (st && (r.status || 'submitted') !== st) return false;
      if (q) {
        var hay = [r.seeker_name, r.seeker_email, r.seeker_phone, r.job_title, r.company]
          .join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderAppTable();
  }
  ['aq', 'aStatus'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', applyAppFilters); el.addEventListener('change', applyAppFilters); }
  });

  function appStatusBadge(s) {
    s = s || 'submitted';
    return '<span class="badge app-' + esc(s) + '">' + esc(s) + '</span>';
  }

  function renderAppTable() {
    var tbody = document.getElementById('appTbody');
    document.getElementById('appCount').textContent =
      APPS_VIEW.length + ' of ' + APPS.length + ' applications';
    document.getElementById('appNoRows').hidden = APPS_VIEW.length !== 0;
    tbody.innerHTML = APPS_VIEW.map(function (r) {
      var opts = APP_STATUSES.map(function (s) {
        return '<option value="' + s + '"' + ((r.status || 'submitted') === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      var jobCell = r.job_id
        ? '<a href="jobs.html" target="_blank" rel="noopener">' + esc(r.job_title || 'View') + '</a>'
        : esc(r.job_title || '—');
      var cvCell = r.cv_url
        ? '<a href="' + esc(r.cv_url) + '" target="_blank" rel="noopener" class="cv-link">Download</a>'
        : '<span class="muted">—</span>';
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate2(r.created_at)) + '</td>' +
        '<td>' + esc(r.seeker_name || '—') + '</td>' +
        '<td><a href="mailto:' + esc(r.seeker_email) + '">' + esc(r.seeker_email) + '</a>' +
          (r.seeker_phone ? '<br><span class="muted">' + esc(r.seeker_phone) + '</span>' : '') + '</td>' +
        '<td>' + jobCell + '</td>' +
        '<td>' + esc(r.company || '—') + '</td>' +
        '<td>' + cvCell + '</td>' +
        '<td>' + appStatusBadge(r.status) + '</td>' +
        '<td><select class="status-select" data-app="' + esc(r.id) + '">' + opts + '</select></td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-app]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        setAppStatus(sel.getAttribute('data-app'), sel.value);
      });
    });
  }

  function setAppStatus(id, status) {
    client.from('applications').update({ status: status }).eq('id', id)
      .then(function (res) {
        if (res.error) { alert('Update failed: ' + res.error.message); return; }
        var a = APPS.filter(function (x) { return x.id === id; })[0];
        if (a) a.status = status;
        applyAppFilters(); renderAppStats();

        // Offer to notify the applicant of the new status
        if (a && a.seeker_email &&
            confirm('Status set to "' + status + '".\n\nEmail ' + a.seeker_email +
              ' to let them know?')) {
          sendStatusEmailAuto(a, status).then(function (r) {
            if (r.sent) {
              alert('✓ ' + a.seeker_email + ' has been notified.');
            } else {
              openStatusMailto(a, status);
            }
          });
        }
      });
  }

  function sendStatusEmailAuto(app, status) {
    if (!app || !app.seeker_email || !client.functions) return Promise.resolve({ sent: false });
    return client.functions.invoke('send-status-email', {
      body: {
        seeker_email: app.seeker_email,
        seeker_name: app.seeker_name || '',
        job_title: app.job_title || '',
        company: app.company || '',
        status: status
      }
    }).then(function (res) {
      var ok = res && !res.error && res.data && res.data.success;
      return { sent: !!ok };
    }).catch(function () { return { sent: false }; });
  }

  function openStatusMailto(app, status) {
    var name = app.seeker_name || 'there';
    var role = (app.job_title || 'your application') + (app.company ? ' at ' + app.company : '');
    var lines = {
      reviewed: 'Your application for ' + role + ' is now being reviewed by our team.',
      shortlisted: 'Great news — you have been shortlisted for ' + role + '! We may contact you shortly.',
      hired: 'Congratulations — you have been selected for ' + role + '! We will be in touch with the details.',
      rejected: 'Thank you for your interest in ' + role + '. This role has moved forward with other candidates, but we will keep your details for future opportunities.',
      submitted: 'Your application for ' + role + ' has been received.'
    };
    var subject = 'Update on your application — LeKhuBo Connect';
    var body = 'Hi ' + name + ',\n\n' + (lines[status] || lines.submitted) +
      '\n\nView your applications: https://tumedi.github.io/lebokhu-group/my-applications.html\n\n' +
      'Kind regards,\nLeKhuBo Connect\nTbmadihlaba@gmail.com | 081 798 6359';
    window.location.href = 'mailto:' + encodeURIComponent(app.seeker_email) +
      '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function renderAppStats() {
    function cs(s) { return APPS.filter(function (r) { return (r.status || 'submitted') === s; }).length; }
    var cards = [
      { label: 'Total Applications', value: APPS.length },
      { label: 'Submitted', value: cs('submitted') },
      { label: 'Shortlisted', value: cs('shortlisted') },
      { label: 'Hired', value: cs('hired') }
    ];
    document.getElementById('appStatCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');

    // Status breakdown chart (bars, colour-coded per status)
    var order = ['submitted', 'reviewed', 'shortlisted', 'rejected', 'hired'];
    var total = APPS.length || 1;
    var max = order.reduce(function (m, s) { return Math.max(m, cs(s)); }, 1);
    var rows = order.map(function (s) {
      var n = cs(s);
      var pct = Math.round((n / max) * 100);
      var share = Math.round((n / total) * 100);
      return '<div class="bd-row">' +
        '<span class="bd-label"><span class="badge app-' + s + '">' + s + '</span></span>' +
        '<span class="bd-bar"><span class="bd-fill app-fill-' + s + '" style="width:' + pct + '%"></span></span>' +
        '<span class="bd-n">' + n + ' <span class="muted">(' + share + '%)</span></span>' +
      '</div>';
    }).join('');
    document.getElementById('appBreakdown').innerHTML =
      '<div class="breakdown-card" style="grid-column:1/-1"><h3>Applications by Status</h3>' +
      (APPS.length ? rows : '<p class="muted">No applications yet</p>') + '</div>';
  }

  function exportAppsCsv() {
    if (!APPS_VIEW.length) { alert('Nothing to export with the current filters.'); return; }
    var cols = ['created_at', 'seeker_name', 'seeker_email', 'seeker_phone', 'job_title', 'company', 'status', 'cv_url'];
    var head = cols.join(',');
    var rows = APPS_VIEW.map(function (r) { return cols.map(function (c) { return csvCell(r[c]); }).join(','); });
    var csv = '\uFEFF' + head + '\n' + rows.join('\n');
    downloadCsv(csv, 'lebokhu-applications');
  }

  /* ============================================================
     CANDIDATE MATCH — notify a job seeker about an approved job
     ============================================================ */
  var matchModal = document.getElementById('matchModal');
  var matchSeekerEl = document.getElementById('matchSeeker');
  var matchSelect = document.getElementById('matchSelect');
  var matchStatus = document.getElementById('matchStatus');
  var matchSendBtn = document.getElementById('matchSend');
  var currentSeeker = null;

  function openMatch(seekerId) {
    var s = ALL.filter(function (x) { return String(x.id) === String(seekerId); })[0];
    if (!s) return;
    currentSeeker = s;
    matchSeekerEl.textContent = (s.first_name || '') + ' ' + (s.last_name || '') + ' <' + s.email + '>';
    matchStatus.textContent = '';
    matchStatus.className = 'form-status';

    // Approved jobs only; sector matches first, each tagged
    var approved = POSTS.filter(function (p) { return p.status === 'approved'; });
    var seekerSector = (s.preferred_sector || '').toLowerCase();
    approved.sort(function (a, b) {
      var am = (a.sector || '').toLowerCase() === seekerSector ? 0 : 1;
      var bm = (b.sector || '').toLowerCase() === seekerSector ? 0 : 1;
      if (am !== bm) return am - bm;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    if (!approved.length) {
      matchSelect.innerHTML = '<option value="">No approved jobs available yet</option>';
    } else {
      matchSelect.innerHTML = approved.map(function (p) {
        var isMatch = (p.sector || '').toLowerCase() === seekerSector && seekerSector;
        var label = (isMatch ? '★ ' : '') + (p.title || 'Untitled') +
          (p.company ? ' — ' + p.company : '') + (p.sector ? ' (' + p.sector + ')' : '');
        return '<option value="' + esc(p.id) + '">' + esc(label) + '</option>';
      }).join('');
    }

    matchModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeMatch() { matchModal.hidden = true; document.body.style.overflow = ''; }
  if (matchModal) {
    matchModal.querySelectorAll('[data-mclose]').forEach(function (el) { el.addEventListener('click', closeMatch); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMatch(); });
  }

  if (matchSendBtn) {
    matchSendBtn.addEventListener('click', function () {
      var jobId = matchSelect.value;
      if (!currentSeeker || !jobId) {
        matchStatus.textContent = 'Please select a job first.';
        matchStatus.className = 'form-status bad';
        return;
      }
      var job = POSTS.filter(function (x) { return String(x.id) === String(jobId); })[0];
      if (!job) return;

      matchSendBtn.disabled = true; matchSendBtn.textContent = 'Sending…';
      matchStatus.textContent = ''; matchStatus.className = 'form-status';

      var payload = {
        seeker_email: currentSeeker.email,
        seeker_name: currentSeeker.first_name || '',
        title: job.title || '',
        company: job.company || '',
        sector: job.sector || '',
        level: job.level || '',
        location: job.location || '',
        job_type: job.job_type || '',
        description: job.description || ''
      };

      var canAuto = client.functions && true;
      var p = canAuto
        ? client.functions.invoke('send-match-email', { body: payload })
            .then(function (res) { return res && !res.error && res.data && res.data.success; })
            .catch(function () { return false; })
        : Promise.resolve(false);

      p.then(function (sent) {
        if (sent) {
          matchStatus.textContent = 'Sent ✓ — ' + currentSeeker.email + ' was notified about "' + job.title + '".';
          matchStatus.className = 'form-status ok';
          setTimeout(closeMatch, 1600);
        } else {
          // Fallback: open a pre-filled email
          openMatchMailto(currentSeeker, job);
          matchStatus.textContent = 'Automatic email unavailable — opened a ready-to-send email instead.';
          matchStatus.className = 'form-status ok';
        }
      }).then(function () {
        matchSendBtn.disabled = false; matchSendBtn.textContent = 'Send Notification';
      });
    });
  }

  function openMatchMailto(seeker, job) {
    var subject = 'A job matching your profile — LeKhuBo Connect';
    var applyUrl = 'https://tumedi.github.io/lebokhu-group/register.html?role=' + encodeURIComponent(job.title || '');
    var body =
      'Hi ' + (seeker.first_name || 'there') + ',\n\n' +
      'Good news — we found a job opportunity that matches your profile!\n\n' +
      (job.title || '') + '\n' +
      (job.company ? 'Company: ' + job.company + '\n' : '') +
      (job.sector ? 'Sector: ' + job.sector + '\n' : '') +
      (job.level ? 'Level: ' + job.level + '\n' : '') +
      (job.location ? 'Location: ' + job.location + '\n' : '') +
      (job.job_type ? 'Type: ' + job.job_type + '\n' : '') +
      (job.description ? '\n' + job.description + '\n' : '') +
      '\nInterested? Apply / confirm here: ' + applyUrl + '\nOr reply to this email.\n\n' +
      'Kind regards,\nLeKhuBo Connect\nTbmadihlaba@gmail.com | 081 798 6359';
    window.location.href = 'mailto:' + encodeURIComponent(seeker.email) +
      '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  /* ============================================================
     SERVICE PROVIDERS (admin) — approve / reject / delete
     ============================================================ */
  var PROVIDERS = [], PROVIDERS_VIEW = [];

  function loadProviders() {
    var countEl = document.getElementById('provCount');
    if (!countEl) return;
    countEl.textContent = 'Loading…';
    client.from(CFG.PROVIDERS_TABLE).select('*').order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Error loading providers: ' + res.error.message; return; }
        PROVIDERS = res.data || [];
        fillSelect('pvService', (function () {
          var set = {}; PROVIDERS.forEach(function (p) { if (p.service) set[p.service] = 1; });
          return Object.keys(set).sort();
        })());
        applyProvFilters();
        renderProvStats();
      });
  }
  ['pvq', 'pvStatus', 'pvService'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', applyProvFilters); el.addEventListener('change', applyProvFilters); }
  });
  function applyProvFilters() {
    var q = (document.getElementById('pvq').value || '').trim().toLowerCase();
    var st = document.getElementById('pvStatus').value;
    var svc = document.getElementById('pvService').value;
    PROVIDERS_VIEW = PROVIDERS.filter(function (p) {
      if (st && (p.status || 'pending') !== st) return false;
      if (svc && p.service !== svc) return false;
      if (q) {
        var hay = [p.full_name, p.service, p.location, p.bio].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderProvTable();
  }
  function provBadge(s) {
    s = s || 'pending';
    var cls = s === 'approved' ? 'badge-approved' : (s === 'rejected' ? 'badge-declined' : 'badge-pending');
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }
  function renderProvTable() {
    var tbody = document.getElementById('provTbody');
    document.getElementById('provCount').textContent = PROVIDERS_VIEW.length + ' of ' + PROVIDERS.length + ' providers';
    document.getElementById('provNoRows').hidden = PROVIDERS_VIEW.length !== 0;
    tbody.innerHTML = PROVIDERS_VIEW.map(function (p) {
      var actions = '';
      if (p.status !== 'approved') actions += '<button class="mini-btn approve" data-pv-approve="' + esc(p.id) + '">Approve</button>';
      if (p.status !== 'rejected') actions += '<button class="mini-btn decline" data-pv-reject="' + esc(p.id) + '">Reject</button>';
      actions += '<button class="mini-btn danger" data-pv-del="' + esc(p.id) + '">Delete</button>';
      var contact = (p.phone ? esc(p.phone) : '') + (p.email ? '<br><span class="muted">' + esc(p.email) + '</span>' : '');
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate2(p.created_at)) + '</td>' +
        '<td>' + provBadge(p.status) + '</td>' +
        '<td>' + esc(p.full_name) + '</td>' +
        '<td>' + esc(p.service) + '</td>' +
        '<td>' + esc(p.location) + '</td>' +
        '<td>' + contact + '</td>' +
        '<td>' + esc(p.rate || '—') + '</td>' +
        '<td class="skills-cell">' + esc(p.bio || '') + '</td>' +
        '<td class="actions-cell">' + actions + '</td>' +
      '</tr>';
    }).join('');
    tbody.querySelectorAll('[data-pv-approve]').forEach(function (b) {
      b.addEventListener('click', function () { setProvStatus(b.getAttribute('data-pv-approve'), 'approved'); });
    });
    tbody.querySelectorAll('[data-pv-reject]').forEach(function (b) {
      b.addEventListener('click', function () { setProvStatus(b.getAttribute('data-pv-reject'), 'rejected'); });
    });
    tbody.querySelectorAll('[data-pv-del]').forEach(function (b) {
      b.addEventListener('click', function () { delProvider(b.getAttribute('data-pv-del')); });
    });
  }
  function setProvStatus(id, status) {
    client.from(CFG.PROVIDERS_TABLE).update({ status: status }).eq('id', id).then(function (res) {
      if (res.error) { alert('Update failed: ' + res.error.message); return; }
      var p = PROVIDERS.filter(function (x) { return x.id === id; })[0];
      if (p) p.status = status;
      applyProvFilters(); renderProvStats();

      // On approval, offer to notify the provider their listing is live
      if (status === 'approved' && p && p.email &&
          confirm('Provider approved ✓\n\nEmail ' + p.email + ' to let them know their listing is live?')) {
        sendProviderApprovedAuto(p).then(function (r) {
          if (r.sent) alert('✓ ' + p.email + ' has been notified.');
          else openProviderApprovedMailto(p);
        });
      }
    });
  }

  function sendProviderApprovedAuto(p) {
    if (!p || !p.email || !client.functions) return Promise.resolve({ sent: false });
    return client.functions.invoke('send-provider-approved', {
      body: {
        provider_email: p.email,
        provider_name: p.full_name || '',
        service: p.service || '',
        location: p.location || ''
      }
    }).then(function (res) {
      return { sent: !!(res && !res.error && res.data && res.data.success) };
    }).catch(function () { return { sent: false }; });
  }

  function openProviderApprovedMailto(p) {
    var subject = 'Your service listing is approved — LeKhuBo Connect';
    var body = 'Hi ' + (p.full_name || 'there') + ',\n\n' +
      'Great news! Your service listing (' + (p.service || '') + ') has been approved and is now ' +
      'live in the LeKhuBo Connect directory. Homeowners in your area can now find and contact you.\n\n' +
      'View the directory: https://tumedi.github.io/lebokhu-group/services-directory.html\n\n' +
      'Kind regards,\nLeKhuBo Connect\nTbmadihlaba@gmail.com | 081 798 6359';
    window.location.href = 'mailto:' + encodeURIComponent(p.email) +
      '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function delProvider(id) {
    if (!confirm('Delete this provider listing permanently?')) return;
    client.from(CFG.PROVIDERS_TABLE).delete().eq('id', id).then(function (res) {
      if (res.error) { alert('Delete failed: ' + res.error.message); return; }
      PROVIDERS = PROVIDERS.filter(function (x) { return x.id !== id; });
      applyProvFilters(); renderProvStats();
    });
  }
  function renderProvStats() {
    function cs(s) { return PROVIDERS.filter(function (p) { return (p.status || 'pending') === s; }).length; }
    var cards = [
      { label: 'Total Providers', value: PROVIDERS.length },
      { label: 'Pending', value: cs('pending') },
      { label: 'Approved (live)', value: cs('approved') },
      { label: 'Rejected', value: cs('rejected') }
    ];
    document.getElementById('provStatCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');
  }
  function exportProvidersCsv() {
    if (!PROVIDERS_VIEW.length) { alert('Nothing to export with the current filters.'); return; }
    var cols = ['created_at', 'status', 'full_name', 'service', 'location', 'phone', 'email', 'whatsapp', 'rate', 'experience', 'bio'];
    var csv = '\uFEFF' + cols.join(',') + '\n' +
      PROVIDERS_VIEW.map(function (r) { return cols.map(function (c) { return csvCell(r[c]); }).join(','); }).join('\n');
    downloadCsv(csv, 'lebokhu-providers');
  }

  /* ============================================================
     SERVICE REQUESTS (admin) — manage statuses
     ============================================================ */
  var REQS = [], REQS_VIEW = [];
  var REQ_STATUSES = ['new', 'contacted', 'completed', 'closed'];

  function loadRequests() {
    var countEl = document.getElementById('reqCount');
    if (!countEl) return;
    countEl.textContent = 'Loading…';
    client.from(CFG.REQUESTS_TABLE).select('*').order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Error loading requests: ' + res.error.message; return; }
        REQS = res.data || [];
        applyReqFilters();
        renderReqStats();
      });
  }
  ['rqq', 'rqStatus'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', applyReqFilters); el.addEventListener('change', applyReqFilters); }
  });
  function applyReqFilters() {
    var q = (document.getElementById('rqq').value || '').trim().toLowerCase();
    var st = document.getElementById('rqStatus').value;
    REQS_VIEW = REQS.filter(function (r) {
      if (st && (r.status || 'new') !== st) return false;
      if (q) {
        var hay = [r.homeowner_name, r.homeowner_phone, r.provider_name, r.service, r.location, r.details].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderReqTable();
  }
  function reqBadge(s) {
    s = s || 'new';
    var cls = s === 'completed' ? 'badge-approved' : (s === 'closed' ? 'badge-closed'
      : (s === 'contacted' ? 'badge-pending' : 'badge-live'));
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }
  function renderReqTable() {
    var tbody = document.getElementById('reqTbody');
    document.getElementById('reqCount').textContent = REQS_VIEW.length + ' of ' + REQS.length + ' requests';
    document.getElementById('reqNoRows').hidden = REQS_VIEW.length !== 0;
    tbody.innerHTML = REQS_VIEW.map(function (r) {
      var opts = REQ_STATUSES.map(function (s) {
        return '<option value="' + s + '"' + ((r.status || 'new') === s ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate2(r.created_at)) + '</td>' +
        '<td>' + esc(r.homeowner_name || '—') + '</td>' +
        '<td><a href="tel:' + esc(r.homeowner_phone) + '">' + esc(r.homeowner_phone) + '</a>' +
          (r.homeowner_email ? '<br><span class="muted">' + esc(r.homeowner_email) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.service || '—') + '</td>' +
        '<td>' + esc(r.provider_name || '—') + '</td>' +
        '<td>' + esc(r.location || '—') + '</td>' +
        '<td class="skills-cell">' + esc(r.details || '') + '</td>' +
        '<td>' + reqBadge(r.status) + '</td>' +
        '<td><select class="status-select" data-rq="' + esc(r.id) + '">' + opts + '</select></td>' +
        '<td><button class="mini-btn" data-rq-chat="' + esc(r.id) + '" data-rq-who="' +
          esc((r.homeowner_name || 'homeowner') + ' ↔ ' + (r.provider_name || 'provider')) + '">💬 Chat</button></td>' +
      '</tr>';
    }).join('');
    tbody.querySelectorAll('[data-rq]').forEach(function (sel) {
      sel.addEventListener('change', function () { setReqStatus(sel.getAttribute('data-rq'), sel.value); });
    });
    tbody.querySelectorAll('[data-rq-chat]').forEach(function (b) {
      b.addEventListener('click', function () {
        openAdminChat(b.getAttribute('data-rq-chat'), b.getAttribute('data-rq-who'));
      });
    });
  }

  /* ---- Admin chat modal ---- */
  var admChatModal = document.getElementById('admChatModal');
  var admChatWith = document.getElementById('admChatWith');
  var admChatMount = document.getElementById('admChatMount');
  var admChatWidget = null;
  function openAdminChat(requestId, who) {
    if (!admChatModal || !window.LEBOKHU_CHAT) return;
    if (admChatWidget) admChatWidget.stop();
    admChatWith.textContent = who || '';
    admChatMount.innerHTML = '';
    admChatModal.hidden = false;
    document.body.style.overflow = 'hidden';
    admChatWidget = window.LEBOKHU_CHAT.mount({
      container: admChatMount,
      requestId: requestId,
      sender: 'admin',
      senderName: 'LeKhuBo Connect'
    });
  }
  function closeAdminChat() {
    if (admChatWidget) { admChatWidget.stop(); admChatWidget = null; }
    if (admChatModal) admChatModal.hidden = true;
    document.body.style.overflow = '';
  }
  if (admChatModal) {
    admChatModal.querySelectorAll('[data-acclose]').forEach(function (el) { el.addEventListener('click', closeAdminChat); });
  }
  function setReqStatus(id, status) {
    client.from(CFG.REQUESTS_TABLE).update({ status: status }).eq('id', id).then(function (res) {
      if (res.error) { alert('Update failed: ' + res.error.message); return; }
      var r = REQS.filter(function (x) { return x.id === id; })[0];
      if (r) r.status = status;
      applyReqFilters(); renderReqStats();
    });
  }
  function renderReqStats() {
    function cs(s) { return REQS.filter(function (r) { return (r.status || 'new') === s; }).length; }
    var cards = [
      { label: 'Total Requests', value: REQS.length },
      { label: 'New', value: cs('new') },
      { label: 'Contacted', value: cs('contacted') },
      { label: 'Completed', value: cs('completed') }
    ];
    document.getElementById('reqStatCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');
  }
  function exportRequestsCsv() {
    if (!REQS_VIEW.length) { alert('Nothing to export with the current filters.'); return; }
    var cols = ['created_at', 'status', 'homeowner_name', 'homeowner_phone', 'homeowner_email', 'service', 'provider_name', 'location', 'details'];
    var csv = '\uFEFF' + cols.join(',') + '\n' +
      REQS_VIEW.map(function (r) { return cols.map(function (c) { return csvCell(r[c]); }).join(','); }).join('\n');
    downloadCsv(csv, 'lebokhu-service-requests');
  }

  /* ============================================================
     REVIEWS (admin moderation) — view + delete
     ============================================================ */
  var REVIEWS = [], REVIEWS_VIEW = [];

  function starsText(n) {
    n = Number(n) || 0;
    var out = '';
    for (var i = 1; i <= 5; i++) out += (i <= n ? '★' : '☆');
    return '<span class="stars">' + out + '</span>';
  }
  function providerName(id) {
    var p = PROVIDERS.filter(function (x) { return x.id === id; })[0];
    return p ? (p.full_name + (p.service ? ' (' + p.service + ')' : '')) : '(provider)';
  }

  function loadReviews() {
    var countEl = document.getElementById('revCount');
    if (!countEl) return;
    countEl.textContent = 'Loading…';
    client.from(CFG.REVIEWS_TABLE).select('*').order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Error loading reviews: ' + res.error.message; return; }
        REVIEWS = res.data || [];
        applyRevFilters();
        renderRevStats();
      });
  }
  ['rvq', 'rvRating'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.addEventListener('input', applyRevFilters); el.addEventListener('change', applyRevFilters); }
  });
  function applyRevFilters() {
    var q = (document.getElementById('rvq').value || '').trim().toLowerCase();
    var rating = document.getElementById('rvRating').value;
    REVIEWS_VIEW = REVIEWS.filter(function (r) {
      if (rating && String(r.rating) !== rating) return false;
      if (q) {
        var hay = [providerName(r.provider_id), r.reviewer_name, r.comment].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    renderRevTable();
  }
  function renderRevTable() {
    var tbody = document.getElementById('rvTbody');
    document.getElementById('revCount').textContent = REVIEWS_VIEW.length + ' of ' + REVIEWS.length + ' reviews';
    document.getElementById('rvNoRows').hidden = REVIEWS_VIEW.length !== 0;
    tbody.innerHTML = REVIEWS_VIEW.map(function (r) {
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate2(r.created_at)) + '</td>' +
        '<td>' + esc(providerName(r.provider_id)) + '</td>' +
        '<td>' + starsText(r.rating) + '</td>' +
        '<td>' + esc(r.reviewer_name || 'Anonymous') + '</td>' +
        '<td class="skills-cell">' + esc(r.comment || '') + '</td>' +
        '<td class="actions-cell"><button class="mini-btn danger" data-rv-del="' + esc(r.id) + '">Delete</button></td>' +
      '</tr>';
    }).join('');
    tbody.querySelectorAll('[data-rv-del]').forEach(function (b) {
      b.addEventListener('click', function () { delReview(b.getAttribute('data-rv-del')); });
    });
  }
  function delReview(id) {
    if (!confirm('Delete this review permanently? This will update the provider\'s average rating.')) return;
    client.from(CFG.REVIEWS_TABLE).delete().eq('id', id).then(function (res) {
      if (res.error) { alert('Delete failed: ' + res.error.message); return; }
      REVIEWS = REVIEWS.filter(function (x) { return x.id !== id; });
      applyRevFilters(); renderRevStats();
      loadProviders(); // refresh averages shown in providers tab
    });
  }
  function renderRevStats() {
    var n = REVIEWS.length;
    var avg = n ? (REVIEWS.reduce(function (s, r) { return s + (r.rating || 0); }, 0) / n) : 0;
    function cs(x) { return REVIEWS.filter(function (r) { return r.rating === x; }).length; }
    var cards = [
      { label: 'Total Reviews', value: n },
      { label: 'Average Rating', value: n ? avg.toFixed(1) + ' ★' : '—' },
      { label: '5-Star', value: cs(5) },
      { label: '1-Star', value: cs(1) }
    ];
    document.getElementById('revStatCards').innerHTML = cards.map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');
  }
  function exportReviewsCsv() {
    if (!REVIEWS_VIEW.length) { alert('Nothing to export with the current filters.'); return; }
    var cols = ['created_at', 'rating', 'reviewer_name', 'comment'];
    var head = ['created_at', 'provider', 'rating', 'reviewer_name', 'comment'].join(',');
    var rows = REVIEWS_VIEW.map(function (r) {
      return [csvCell(r.created_at), csvCell(providerName(r.provider_id)), csvCell(r.rating),
        csvCell(r.reviewer_name), csvCell(r.comment)].join(',');
    });
    downloadCsv('\uFEFF' + head + '\n' + rows.join('\n'), 'lebokhu-reviews');
  }
})();
