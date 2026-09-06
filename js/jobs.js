/* ============================================================
   LeBoKhu Group — jobs.js
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

  function jobCard(job) {
    var q = encodeURIComponent(job.title);
    var liveBadge = job.live ? '<span class="badge badge-live">● Live</span>' : '';
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
        '<div class="job-actions">' +
          '<button class="btn btn-primary" data-apply="' + q + '">Apply Now</button>' +
        '</div>' +
      '</article>';
  }

  function render() {
    var s = (searchEl.value || '').trim().toLowerCase();
    var sector = sectorEl.value, level = levelEl.value, loc = locEl.value;

    var filtered = JOBS.filter(function (j) {
      if (s && (j.title + ' ' + j.desc + ' ' + j.sector).toLowerCase().indexOf(s) === -1) return false;
      if (sector && j.sector !== sector) return false;
      if (level && j.level !== level) return false;
      if (loc && j.loc !== loc) return false;
      return true;
    });

    listEl.innerHTML = filtered.map(jobCard).join('');
    countEl.textContent = filtered.length + (filtered.length === 1 ? ' job' : ' jobs') + ' found';
    noRes.hidden = filtered.length !== 0;

    // Wire apply buttons
    listEl.querySelectorAll('[data-apply]').forEach(function (btn) {
      btn.addEventListener('click', function () { openApply(decodeURIComponent(btn.getAttribute('data-apply'))); });
    });
  }

  /* ---- Apply modal ---- */
  var modal = document.getElementById('applyModal');
  var roleEl = document.getElementById('applyRole');
  var proceed = document.getElementById('applyProceed');

  function openApply(title) {
    roleEl.textContent = title;
    proceed.href = 'register.html?role=' + encodeURIComponent(title);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
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

  // Initial render (samples), then upgrade with live posts when they arrive
  render();
  loadLiveJobs();
})();
