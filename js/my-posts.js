/* ============================================================
   LeKhuBo Connect — my-posts.js
   Employer dashboard. Requires a logged-in "Potential Employer"
   (profiles.role = 'homeowner'). Lists the jobs THIS employer
   posted and, under each, every applicant — with actions to
   Shortlist / Reject / Accept.

   Security: the database RLS does the real enforcement —
     • job_posts: "employer reads own posts" (user_id = auth.uid())
     • applications: "employer reads applications to own posts"
       and "employer updates applications to own posts"
   so this page can only ever see/change the current employer's data.

   Button → status mapping (matches the admin pipeline):
     Shortlist → 'shortlisted'   Reject → 'rejected'   Accept → 'hired'
   The applicant is emailed on change via the existing
   send-status-email Edge Function (best-effort, with a mailto fallback).
   ============================================================ */
(function () {
  'use strict';

  var AUTH = window.LEBOKHU_AUTH;
  var CFG = window.LEBOKHU_SUPABASE;

  if (!AUTH || !AUTH.configured()) {
    var nc = document.getElementById('notConfigured');
    if (nc) nc.hidden = false;
    var c0 = document.getElementById('count'); if (c0) c0.textContent = '';
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

  // Action buttons mapped to the hiring pipeline. Each button is hidden when
  // the application is already in that state (no pointless re-click).
  function actionButtons(appId, status) {
    status = status || 'submitted';
    var btns = '';
    if (status !== 'shortlisted')
      btns += '<button class="mini-btn" data-act="shortlisted" data-app="' + esc(appId) + '">Shortlist</button>';
    if (status !== 'hired')
      btns += '<button class="mini-btn approve" data-act="hired" data-app="' + esc(appId) + '">Accept</button>';
    if (status !== 'rejected')
      btns += '<button class="mini-btn decline" data-act="rejected" data-app="' + esc(appId) + '">Reject</button>';
    return btns || '<span class="muted">—</span>';
  }

  var client = AUTH.client();
  var POSTS = [];          // this employer's job posts
  var APPS_BY_JOB = {};    // job_id -> [applications]
  var profile = null;

  // Logout
  var logout = document.getElementById('logoutBtn');
  if (logout) logout.addEventListener('click', function (e) {
    e.preventDefault(); AUTH.signOut().then(function () { location.href = 'index.html'; });
  });
  var refresh = document.getElementById('refreshBtn');
  if (refresh) refresh.addEventListener('click', function () { loadAll(); });

  // Guard: must be a logged-in employer (homeowner). requireAuth redirects
  // guests to login and other roles to their own dashboard.
  AUTH.requireAuth('homeowner').then(function (ctx) {
    profile = ctx.profile;
    AUTH.renderHeader('#mainNav');
    var who = document.getElementById('who');
    if (who) who.textContent = (profile && (profile.full_name || profile.company || profile.email)) || '';
    var lo = document.getElementById('logoutBtn'); if (lo) lo.hidden = false;
    loadAll();
  }).catch(function () { /* requireAuth already redirected */ });

  function loadAll() {
    var countEl = document.getElementById('count');
    countEl.textContent = 'Loading…';
    // 1) Load the employer's own posts (RLS scopes to user_id = auth.uid()).
    client.from(CFG.POSTS_TABLE).select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Could not load your posts: ' + res.error.message; return; }
        POSTS = res.data || [];
        if (!POSTS.length) { render(); return; }
        // 2) Load applications for those posts in one query.
        var jobIds = POSTS.map(function (p) { return p.id; });
        client.from('applications').select('*')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false })
          .then(function (ares) {
            if (ares.error) { countEl.textContent = 'Could not load applicants: ' + ares.error.message; return; }
            APPS_BY_JOB = {};
            (ares.data || []).forEach(function (a) {
              var k = a.job_id;
              (APPS_BY_JOB[k] = APPS_BY_JOB[k] || []).push(a);
            });
            render();
          });
      });
  }

  function totalApps() {
    return Object.keys(APPS_BY_JOB).reduce(function (n, k) { return n + APPS_BY_JOB[k].length; }, 0);
  }
  function countStatus(s) {
    var n = 0;
    Object.keys(APPS_BY_JOB).forEach(function (k) {
      APPS_BY_JOB[k].forEach(function (a) { if ((a.status || 'submitted') === s) n++; });
    });
    return n;
  }

  function render() {
    var countEl = document.getElementById('count');
    var postsEl = document.getElementById('posts');
    var noRows = document.getElementById('noRows');

    document.getElementById('statCards').innerHTML = [
      { label: 'Job Posts', value: POSTS.length },
      { label: 'Total Applicants', value: totalApps() },
      { label: 'Shortlisted', value: countStatus('shortlisted') },
      { label: 'Accepted', value: countStatus('hired') }
    ].map(function (c) {
      return '<div class="stat-card"><span class="stat-num">' + c.value + '</span><span class="stat-label">' + c.label + '</span></div>';
    }).join('');

    if (!POSTS.length) {
      countEl.textContent = '';
      postsEl.innerHTML = '';
      noRows.hidden = false;
      return;
    }
    noRows.hidden = true;
    countEl.textContent = POSTS.length + (POSTS.length === 1 ? ' job post' : ' job posts') +
      ' · ' + totalApps() + (totalApps() === 1 ? ' applicant' : ' applicants');

    postsEl.innerHTML = POSTS.map(renderPostBlock).join('');

    // Wire up action buttons
    postsEl.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        setStatus(b.getAttribute('data-app'), b.getAttribute('data-act'));
      });
    });
  }

  function postStatusBadge(s) {
    var cls = s === 'approved' ? 'badge-approved'
      : (s === 'closed' ? 'badge-closed'
      : (s === 'declined' ? 'badge-declined' : 'badge-pending'));
    return '<span class="badge ' + cls + '">' + esc(s || 'pending') + '</span>';
  }

  function renderPostBlock(post) {
    var apps = APPS_BY_JOB[post.id] || [];
    var head =
      '<div class="dash-head" style="margin-top:28px">' +
        '<div>' +
          '<h2 style="margin:0">' + esc(post.title || 'Untitled role') + '</h2>' +
          '<p class="muted" style="margin:4px 0 0">' + postStatusBadge(post.status) + ' &nbsp; ' +
            esc(post.sector || '—') + ' · ' + esc(post.location || '—') + ' · ' +
            esc(post.job_type || '—') + ' · posted ' + esc(fmtDate(post.created_at)) + '</p>' +
        '</div>' +
        '<div class="dash-actions"><span class="results-count" style="margin:0">' +
          apps.length + (apps.length === 1 ? ' applicant' : ' applicants') + '</span></div>' +
      '</div>';

    if (!apps.length) {
      return head +
        '<div class="no-results"><p>No applications yet for this job. ' +
        'We\'ll email you (and show them here) as soon as someone applies.</p></div>';
    }

    var rows = apps.map(function (a) {
      var cv = a.cv_url
        ? '<a href="' + esc(a.cv_url) + '" target="_blank" rel="noopener" class="cv-link">Download</a>'
        : '<span class="muted">—</span>';
      var contact =
        (a.seeker_email ? '<a href="mailto:' + esc(a.seeker_email) + '">' + esc(a.seeker_email) + '</a>' : '') +
        (a.seeker_phone ? '<br><span class="muted">' + esc(a.seeker_phone) + '</span>' : '');
      return '<tr>' +
        '<td class="nowrap">' + esc(fmtDate(a.created_at)) + '</td>' +
        '<td>' + esc(a.seeker_name || '—') + '</td>' +
        '<td>' + (contact || '<span class="muted">—</span>') + '</td>' +
        '<td>' + cv + '</td>' +
        '<td>' + statusBadge(a.status) + '</td>' +
        '<td class="actions-cell">' + actionButtons(a.id, a.status) + '</td>' +
      '</tr>';
    }).join('');

    return head +
      '<div class="table-wrap"><table class="data-table">' +
        '<thead><tr><th>Applied</th><th>Applicant</th><th>Contact</th><th>CV</th>' +
          '<th>Status</th><th>Action</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  // Find an application across the grouped structure.
  function findApp(id) {
    var found = null;
    Object.keys(APPS_BY_JOB).some(function (k) {
      var hit = APPS_BY_JOB[k].filter(function (a) { return String(a.id) === String(id); })[0];
      if (hit) { found = hit; return true; }
      return false;
    });
    return found;
  }

  function setStatus(appId, status) {
    client.from('applications').update({ status: status }).eq('id', appId)
      .then(function (res) {
        if (res.error) { alert('Update failed: ' + res.error.message); return; }
        var a = findApp(appId);
        if (a) a.status = status;
        render();

        // Offer to email the applicant about the new status (same behaviour
        // as the admin dashboard: auto via Edge Function, else mailto).
        if (a && a.seeker_email &&
            confirm('Status set to "' + status + '".\n\nEmail ' + a.seeker_email +
              ' to let them know?')) {
          sendStatusEmailAuto(a, status).then(function (r) {
            if (r.sent) alert('✓ ' + a.seeker_email + ' has been notified.');
            else openStatusMailto(a, status);
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
      return { sent: !!(res && !res.error && res.data && res.data.success) };
    }).catch(function () { return { sent: false }; });
  }

  function openStatusMailto(app, status) {
    var name = app.seeker_name || 'there';
    var role = (app.job_title || 'your application') + (app.company ? ' at ' + app.company : '');
    var lines = {
      reviewed: 'Your application for ' + role + ' is now being reviewed.',
      shortlisted: 'Great news — you have been shortlisted for ' + role + '! We may contact you shortly.',
      hired: 'Congratulations — you have been selected for ' + role + '! We will be in touch with the details.',
      rejected: 'Thank you for your interest in ' + role + '. This role has moved forward with other candidates, but we will keep your details for future opportunities.',
      submitted: 'Your application for ' + role + ' has been received.'
    };
    var subject = 'Update on your application — LeKhuBo Connect';
    var body = 'Hi ' + name + ',\n\n' + (lines[status] || lines.submitted) +
      '\n\nView your applications: https://lekhubo-connect.co.za/my-applications.html\n\n' +
      'Kind regards,\nLeKhuBo Connect\ninfo@lekhubo-connect.co.za | 081 798 6359';
    window.location.href = 'mailto:' + encodeURIComponent(app.seeker_email) +
      '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
})();
