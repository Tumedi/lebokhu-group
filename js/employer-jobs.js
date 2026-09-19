/* ============================================================
   LeKhuBo Connect — employer-jobs.js
   Public page listing ONLY real approved job_posts (no samples).
   Job seekers apply → inserts into the applications table.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.LEBOKHU_SUPABASE;
  var AUTH = window.LEBOKHU_AUTH;

  var listEl = document.getElementById('jobList');
  var countEl = document.getElementById('resultsCount');
  var noRes = document.getElementById('noResults');
  var searchEl = document.getElementById('search');
  var sectorEl = document.getElementById('sector');
  var levelEl = document.getElementById('level');
  var locEl = document.getElementById('loc');

  var JOBS = [];              // approved posts (mapped)
  var FILTERED = [];
  var appliedJobIds = {};

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function relTime(iso) {
    if (!iso) return 'Recently';
    var d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (d <= 0) return 'Today';
    if (d === 1) return '1 day ago';
    if (d < 7) return d + ' days ago';
    if (d < 14) return '1 week ago';
    if (d < 60) return Math.floor(d / 7) + ' weeks ago';
    return Math.floor(d / 30) + ' months ago';
  }

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
      desc: p.description || ''
    };
  }

  function fillSelect(el, values, allLabel) {
    if (!el) return;
    el.length = 0;
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = allLabel; el.appendChild(o0);
    values.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v; el.appendChild(o); });
  }
  function uniq(key) {
    var set = {};
    JOBS.forEach(function (j) { if (j[key]) set[j[key]] = true; });
    return Object.keys(set).sort();
  }
  function buildFilters() {
    fillSelect(sectorEl, uniq('sector'), 'All sectors');
    fillSelect(levelEl, uniq('level'), 'All levels');
    fillSelect(locEl, uniq('loc'), 'All locations');
  }

  function jobCard(job, idx) {
    var already = job.id && appliedJobIds[job.id];
    var btn = already
      ? '<button class="btn btn-outline" disabled>✓ Applied</button>'
      : '<button class="btn btn-primary" data-apply-idx="' + idx + '">Apply Now</button>';
    return '<article class="job-card">' +
      '<div class="job-main">' +
        '<div class="job-head">' +
          '<h3>' + esc(job.title) + '</h3>' +
          (job.company ? '<span class="job-company">' + esc(job.company) + '</span>' : '') +
          '<span class="badge badge-level">' + esc(job.level) + '</span>' +
          '<span class="badge badge-live">● Live</span>' +
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
      if (s && (j.title + ' ' + j.desc + ' ' + j.sector + ' ' + j.company).toLowerCase().indexOf(s) === -1) return false;
      if (sector && j.sector !== sector) return false;
      if (level && j.level !== level) return false;
      if (loc && j.loc !== loc) return false;
      return true;
    });

    listEl.innerHTML = FILTERED.map(jobCard).join('');
    countEl.textContent = FILTERED.length + (FILTERED.length === 1 ? ' job' : ' jobs') + ' found';
    noRes.hidden = FILTERED.length !== 0;

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

  function showModal() { modal.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeApply() { modal.hidden = true; document.body.style.overflow = ''; }
  if (modal) {
    modal.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', closeApply); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeApply(); });
  }

  function openApply(job) {
    roleEl.textContent = job.title + (job.company ? ' — ' + job.company : '');
    var noteEl = document.getElementById('applyNote');

    if (!AUTH || !AUTH.configured()) {
      proceed.href = 'signup.html';
      proceed.textContent = 'Sign up to Apply';
      proceed.style.display = '';
      if (noteEl) noteEl.textContent = 'Create a free job-seeker account to apply.';
      showModal();
      return;
    }

    AUTH.getProfile().then(function (profile) {
      if (!profile) {
        proceed.href = 'login.html?next=' + encodeURIComponent('employer-jobs.html');
        proceed.textContent = 'Log in to Apply';
        proceed.style.display = '';
        if (noteEl) noteEl.textContent = 'You need an account to apply. Log in or sign up — it only takes a minute.';
        showModal();
        return;
      }
      if (profile.role !== 'seeker') {
        proceed.style.display = 'none';
        if (noteEl) noteEl.textContent = 'Applying is for job-seeker accounts. Please sign in with a job-seeker account to apply.';
        showModal();
        return;
      }
      proceed.style.display = 'none';
      if (noteEl) noteEl.textContent = 'Submitting your application…';
      showModal();
      submitApplication(job, profile);
    });
  }

  function findSeekerCv(client, email) {
    if (!email) return Promise.resolve(null);
    return client.from(CFG.TABLE).select('cv_url').eq('email', email).not('cv_url', 'is', null)
      .order('created_at', { ascending: false }).limit(1)
      .then(function (r) { return (r.data && r.data[0] && r.data[0].cv_url) || null; })
      .catch(function () { return null; });
  }

  function submitApplication(job, profile) {
    var noteEl = document.getElementById('applyNote');
    var client = AUTH.client();
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
    });
  }

  function loadMyApplications() {
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

  function loadJobs() {
    if (!CFG || !CFG.isConfigured()) {
      countEl.textContent = '';
      noRes.hidden = false;
      noRes.querySelector('p').textContent = 'Jobs aren\'t available yet — the database connection isn\'t configured.';
      return;
    }
    var client = CFG.client();
    client.from(CFG.POSTS_TABLE).select('*').eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Could not load jobs: ' + res.error.message; return; }
        JOBS = (res.data || []).map(mapPost);
        buildFilters();
        render();
      });
  }

  [searchEl, sectorEl, levelEl, locEl].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  loadMyApplications().then(loadJobs);
  if (AUTH) AUTH.renderHeader('#mainNav');
})();
