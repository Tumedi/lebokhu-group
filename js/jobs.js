/* ============================================================
   LeKhuBo Connect — jobs.js
   Loads LIVE approved job posts from Supabase (job_posts table)
   and merges them with the built-in SAMPLE_JOBS below so the page
   is never empty. Live posts appear first and are tagged "Live".
   Includes client-side search/filter + the apply modal.
   ============================================================ */
(function () {
  'use strict';

  var SAMPLE_JOBS = [
    { title: 'General Warehouse Assistant', sector: 'Logistics & Warehousing', level: 'Entry-level / No experience', loc: 'Johannesburg', type: 'Full-time', posted: '2 days ago',
      desc: 'Assist with picking, packing, loading and stock control. No experience required — full training provided. A great first job.' },
    { title: 'Retail Sales Assistant', sector: 'Retail', level: 'Entry-level / No experience', loc: 'Pretoria / Tshwane', type: 'Full-time', posted: '3 days ago',
      desc: 'Serve customers, handle the till and keep the store looking great. Friendly attitude matters more than experience.' },
    { title: 'Call Centre Agent', sector: 'Call Centre', level: 'Entry-level / No experience', loc: 'Remote', type: 'Full-time', posted: '1 day ago',
      desc: 'Handle inbound customer queries by phone and email. Matric advantageous. Training and headset provided.' },
    { title: 'Junior Software Developer', sector: 'Information Technology', level: 'Graduate', loc: 'Pretoria / Tshwane', type: 'Full-time', posted: '4 days ago',
      desc: 'Join a growing dev team building web applications. Diploma/degree in IT or equivalent portfolio. Mentorship offered.' },
    { title: 'IT Support Technician', sector: 'Information Technology', level: 'Skilled / Experienced', loc: 'Johannesburg', type: 'Full-time', posted: '5 days ago',
      desc: 'Provide 1st/2nd line support, troubleshoot hardware and software, manage tickets. A+ / N+ advantageous.' },
    { title: 'Bookkeeper', sector: 'Finance', level: 'Skilled / Experienced', loc: 'Cape Town', type: 'Full-time', posted: '1 week ago',
      desc: 'Capture transactions, reconcile accounts and assist with monthly reporting. Pastel/Sage experience required.' },
    { title: 'Data Capturer', sector: 'Administration', level: 'Entry-level / No experience', loc: 'Durban', type: 'Contract', posted: '2 days ago',
      desc: 'Accurately capture data into our systems. Attention to detail and basic computer skills needed.' },
    { title: 'Waiter / Waitress', sector: 'Hospitality', level: 'Entry-level / No experience', loc: 'Cape Town', type: 'Part-time', posted: '6 days ago',
      desc: 'Take orders, serve food and create a great guest experience. Weekend availability required.' },
    { title: 'Construction General Worker', sector: 'Construction', level: 'Entry-level / No experience', loc: 'Johannesburg', type: 'Contract', posted: '3 days ago',
      desc: 'Support on-site construction activities. Physically fit and reliable. PPE and induction provided.' },
    { title: 'Office Administrator', sector: 'Administration', level: 'Skilled / Experienced', loc: 'Pretoria / Tshwane', type: 'Full-time', posted: '1 week ago',
      desc: 'Manage front-desk, scheduling, filing and office coordination. MS Office proficiency required.' },
    { title: 'Delivery Driver (Code 10)', sector: 'Logistics & Warehousing', level: 'Skilled / Experienced', loc: 'Durban', type: 'Full-time', posted: '4 days ago',
      desc: 'Deliver goods safely and on time. Valid Code 10 licence and PrDP required. Clean driving record.' },
    { title: 'Graduate Business Analyst', sector: 'Finance', level: 'Graduate', loc: 'Johannesburg', type: 'Full-time', posted: '2 days ago',
      desc: 'Kick-start your career analysing processes and data. Relevant degree required. Structured graduate programme.' }
  ];

  // The list actually rendered. Starts with samples; live posts are
  // prepended once loaded from the database.
  var JOBS = SAMPLE_JOBS.slice();

  var listEl = document.getElementById('jobList');
  var countEl = document.getElementById('resultsCount');
  var noRes = document.getElementById('noResults');
  var searchEl = document.getElementById('search');
  var sectorEl = document.getElementById('sector');
  var levelEl = document.getElementById('level');
  var locEl = document.getElementById('loc');

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  var FILTERED = [];          // current filtered jobs (apply buttons index into this)
  var appliedJobIds = {};     // job_id -> true, for the logged-in seeker

  function jobCard(job, idx) {
    var liveBadge = job.live ? '<span class="badge badge-live">● Live</span>' : '';
    var already = job.id && appliedJobIds[job.id];
    var btn = already
      ? '<button class="btn btn-outline" disabled>✓ Applied</button>'
      : '<button class="btn btn-primary" data-apply-idx="' + idx + '">Apply Now</button>';
    return '' +
      '<article class="job-card">' +
        '<div class="job-main">' +
          '<div class="job-head">' +
            '<h3>' + esc(job.title) + '</h3>' +
            (job.company ? '<span class="job-company">' + esc(job.company) + '</span>' : '') +
            '<span class="badge badge-level">' + esc(job.level) + '</span>' +
            liveBadge +
          '</div>' +
          '<p class="job-meta">' +
            '<span>🏢 ' + esc(job.sector) + '</span>' +
            '<span>📍 ' + esc(job.loc) + '</span>' +
            '<span>🕒 ' + esc(job.type) + '</span>' +
            '<span>📅 ' + esc(job.posted) + '</span>' +
          '</p>' +
          '<p class="job-desc">' + esc(job.desc) + '</p>' +
        '</div>' +
        '<div class="job-actions">' + btn + '</div>' +
      '</article>';
  }

  function render() {
    var s = (searchEl.value || '').trim().toLowerCase();
    var sector = sectorEl.value, level = levelEl.value, loc = locEl.value;

    FILTERED = JOBS.filter(function (j) {
      if (s && (j.title + ' ' + j.desc + ' ' + j.sector).toLowerCase().indexOf(s) === -1) return false;
      if (sector && j.sector !== sector) return false;
      if (level && j.level !== level) return false;
      if (loc && j.loc !== loc) return false;
      return true;
    });

    listEl.innerHTML = FILTERED.map(jobCard).join('');
    countEl.textContent = FILTERED.length + (FILTERED.length === 1 ? ' job' : ' jobs') + ' found';
    noRes.hidden = FILTERED.length !== 0;

    // Wire apply buttons
    listEl.querySelectorAll('[data-apply-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openApply(FILTERED[parseInt(btn.getAttribute('data-apply-idx'), 10)]);
      });
    });
  }

  /* ---- Apply modal ---- */
  var modal = document.getElementById('applyModal');
  var roleEl = document.getElementById('applyRole');
  var proceed = document.getElementById('applyProceed');
  var currentJob = null;

  function openApply(job) {
    currentJob = job;
    roleEl.textContent = job.title + (job.company ? ' — ' + job.company : '');

    var AUTH = window.LEBOKHU_AUTH;
    var noteEl = document.getElementById('applyNote');

    // Not configured (no DB): fall back to old behaviour (register page)
    if (!AUTH || !AUTH.configured()) {
      proceed.href = 'register.html?role=' + encodeURIComponent(job.title);
      proceed.textContent = 'Continue to Application';
      proceed.style.display = '';
      if (noteEl) noteEl.textContent = 'This takes you to our registration form with the role pre-filled.';
      showModal();
      return;
    }

    // Configured: check auth + role
    AUTH.getProfile().then(function (profile) {
      if (!profile) {
        // Not logged in → send to login, returning to jobs after
        proceed.href = 'login.html?next=' + encodeURIComponent('jobs.html');
        proceed.textContent = 'Log in to Apply';
        proceed.style.display = '';
        if (noteEl) noteEl.textContent = 'You need an account to apply. Log in or sign up — it only takes a minute.';
        showModal();
        return;
      }
      if (profile.role === 'employer') {
        proceed.style.display = 'none';
        if (noteEl) noteEl.textContent = 'You are logged in as an employer. Applying is for job-seeker accounts.';
        showModal();
        return;
      }
      // Logged-in seeker → submit application directly
      proceed.style.display = 'none';
      if (noteEl) noteEl.textContent = 'Submitting your application…';
      showModal();
      submitApplication(job, profile);
    });
  }

  // Look up the seeker's most recent CV (from a prior registration by email).
  function findSeekerCv(client, email) {
    if (!email) return Promise.resolve(null);
    return client.from(window.LEBOKHU_SUPABASE.TABLE)
      .select('cv_url').eq('email', email).not('cv_url', 'is', null)
      .order('created_at', { ascending: false }).limit(1)
      .then(function (r) { return (r.data && r.data[0] && r.data[0].cv_url) || null; })
      .catch(function () { return null; });
  }

  function submitApplication(job, profile) {
    var noteEl = document.getElementById('applyNote');
    var client = window.LEBOKHU_AUTH.client();

    findSeekerCv(client, profile.email).then(function (cvUrl) {
    var record = {
      seeker_id: profile.id,
      job_id: job.id || null,
      job_title: job.title || '',
      company: job.company || '',
      seeker_name: profile.full_name || '',
      seeker_email: profile.email || '',
      seeker_phone: profile.phone || '',
      cv_url: cvUrl,
      status: 'submitted'
    };
    client.from('applications').insert([record]).then(function (res) {
      if (res.error) {
        // Unique-constraint violation => already applied
        if ((res.error.code === '23505') || /duplicate|unique/i.test(res.error.message || '')) {
          if (job.id) appliedJobIds[job.id] = true;
          if (noteEl) noteEl.innerHTML = 'You have already applied for this role. ' +
            'See your <a href="my-applications.html">applications</a>.';
        } else {
          if (noteEl) noteEl.textContent = 'Sorry, could not submit: ' + res.error.message;
        }
        render();
        return;
      }
      if (job.id) appliedJobIds[job.id] = true;
      if (noteEl) noteEl.innerHTML = '✓ Application submitted! Track it under ' +
        '<a href="my-applications.html">My Applications</a>.';
      render();
    });
    }); // end findSeekerCv
  }

  function showModal() { modal.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeApply() { modal.hidden = true; document.body.style.overflow = ''; }
  if (modal) {
    modal.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', closeApply); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeApply(); });
  }

  [searchEl, sectorEl, levelEl, locEl].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  /* ---- Relative "posted" time from an ISO date ---- */
  function relTime(iso) {
    if (!iso) return 'Recently';
    var diff = Date.now() - new Date(iso).getTime();
    var day = 86400000;
    var d = Math.floor(diff / day);
    if (d <= 0) return 'Today';
    if (d === 1) return '1 day ago';
    if (d < 7) return d + ' days ago';
    if (d < 14) return '1 week ago';
    if (d < 60) return Math.floor(d / 7) + ' weeks ago';
    return Math.floor(d / 30) + ' months ago';
  }

  /* ---- Map a DB job_posts row to the card model ---- */
  function mapPost(p) {
    return {
      id: p.id,
      title: p.title || 'Untitled role',
      company: p.company || '',
      sector: p.sector || 'Other',
      level: p.level || 'Entry-level / No experience',
      loc: p.location || 'Other',
      type: p.job_type || 'Full-time',
      posted: relTime(p.created_at),
      desc: p.description || '',
      live: true
    };
  }

  /* ---- Load the seeker's existing applications (to show "Applied") ---- */
  function loadMyApplications() {
    var AUTH = window.LEBOKHU_AUTH;
    if (!AUTH || !AUTH.configured()) return Promise.resolve();
    return AUTH.getProfile().then(function (profile) {
      if (!profile || profile.role !== 'seeker') return;
      var client = AUTH.client();
      return client.from('applications').select('job_id').eq('seeker_id', profile.id)
        .then(function (res) {
          if (res.data) res.data.forEach(function (a) { if (a.job_id) appliedJobIds[a.job_id] = true; });
        });
    }).catch(function () { /* ignore */ });
  }

  /* ---- Load live approved posts from Supabase, then merge ---- */
  function loadLiveJobs() {
    var CFG = window.LEBOKHU_SUPABASE;
    if (!CFG || !CFG.isConfigured()) return; // no DB yet → samples only
    var client = CFG.client();
    if (!client) return;

    client.from(CFG.POSTS_TABLE)
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error || !res.data || !res.data.length) return; // keep samples on error/empty
        var live = res.data.map(mapPost);
        // Live posts first, then the sample listings as extra content
        JOBS = live.concat(SAMPLE_JOBS);
        render();
      })
      .catch(function () { /* keep samples */ });
  }

  // Initial render (samples), load applied set + live posts, update header
  render();
  loadMyApplications().then(loadLiveJobs);
  if (window.LEBOKHU_AUTH) window.LEBOKHU_AUTH.renderHeader('#mainNav');
})();
