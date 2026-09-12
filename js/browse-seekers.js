/* ============================================================
   LeKhuBo Connect — browse-seekers.js
   Provider-only page: browse people who registered as job seekers
   (job_seekers table) so a provider can hire extra hands. Read
   access is restricted to admins + providers by RLS
   (see supabase-browse-seekers.sql).
   ============================================================ */
(function () {
  'use strict';

  var AUTH = window.LEBOKHU_AUTH;
  var CFG = window.LEBOKHU_SUPABASE;

  if (!(AUTH && AUTH.configured())) {
    var nc = document.getElementById('notConfigured');
    if (nc) nc.hidden = false;
    var c0 = document.getElementById('count'); if (c0) c0.textContent = '';
    return;
  }

  var client = AUTH.client();
  var ALL = [];
  var VIEW = [];

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

  var logout = document.getElementById('logoutBtn');
  if (logout) logout.addEventListener('click', function (e) {
    e.preventDefault(); AUTH.signOut().then(function () { location.href = 'index.html'; });
  });

  // Provider-only page.
  AUTH.requireAuth('provider').then(function (ctx) {
    var who = document.getElementById('who');
    if (who) who.textContent = (ctx.profile && (ctx.profile.full_name || ctx.profile.email)) || '';
    var lo = document.getElementById('logoutBtn'); if (lo) lo.hidden = false;
    // NOTE: do NOT call renderHeader here — this page has its own static nav +
    // logout, like the other dashboards. renderHeader would inject a duplicate
    // dashboard link and Log Out.
    load();
  }).catch(function () { /* requireAuth redirected */ });

  function load() {
    var countEl = document.getElementById('count');
    client.from(CFG.TABLE).select('*').order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) {
          // If RLS blocks the read, guide the provider rather than showing nothing.
          countEl.textContent = 'Could not load job seekers: ' + res.error.message;
          return;
        }
        ALL = res.data || [];
        buildFilters();
        applyFilters();
      });
  }

  function uniqueSorted(key) {
    var set = {};
    ALL.forEach(function (r) { if (r[key]) set[r[key]] = true; });
    return Object.keys(set).sort();
  }
  function fillSelect(id, values) {
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.length = 1;   // keep the first ("All") option
    values.forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
    });
  }
  function buildFilters() {
    fillSelect('fSector', uniqueSorted('preferred_sector'));
    fillSelect('fExp', uniqueSorted('experience'));
  }

  function applyFilters() {
    var q = (document.getElementById('q').value || '').trim().toLowerCase();
    var sector = document.getElementById('fSector').value;
    var exp = document.getElementById('fExp').value;
    var cvF = document.getElementById('fCv').value;

    VIEW = ALL.filter(function (r) {
      if (sector && r.preferred_sector !== sector) return false;
      if (exp && r.experience !== exp) return false;
      if (cvF === 'yes' && !r.cv_url) return false;
      if (cvF === 'no' && r.cv_url) return false;
      if (q) {
        var hay = [r.first_name, r.last_name, r.location, r.skills, r.qualification,
          r.preferred_sector, r.applying_for].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    render();
  }

  ['q', 'fSector', 'fExp', 'fCv'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  function render() {
    var grid = document.getElementById('seekerGrid');
    var countEl = document.getElementById('count');
    countEl.textContent = VIEW.length + ' of ' + ALL.length +
      (ALL.length === 1 ? ' job seeker' : ' job seekers');
    document.getElementById('noRows').hidden = VIEW.length !== 0;

    grid.innerHTML = VIEW.map(function (r) {
      var name = ((r.first_name || '') + ' ' + (r.last_name || '')).trim() || 'Job seeker';
      var meta = [];
      if (r.location) meta.push('📍 ' + esc(r.location));
      if (r.experience) meta.push('🧰 ' + esc(r.experience));
      if (r.preferred_sector) meta.push('🏷️ ' + esc(r.preferred_sector));
      if (r.qualification) meta.push('🎓 ' + esc(r.qualification));

      var contact = [];
      if (r.phone) contact.push('<a href="tel:' + esc(r.phone) + '">📞 ' + esc(r.phone) + '</a>');
      if (r.email) contact.push('<a href="mailto:' + esc(r.email) + '">✉️ ' + esc(r.email) + '</a>');

      var cv = r.cv_url
        ? '<a class="btn btn-outline btn-sm" href="' + esc(r.cv_url) + '" target="_blank" rel="noopener">📄 View CV</a>'
        : '';
      var waLink = r.phone
        ? '<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="https://wa.me/' +
            esc(String(r.phone).replace(/[^0-9]/g, '')) + '?text=' +
            encodeURIComponent('Hi ' + name + ', I found your profile on LeKhuBo Connect and I have work you might be interested in.') +
          '">💬 WhatsApp</a>'
        : '';

      return '<article class="seeker-card">' +
        '<div class="seeker-head">' +
          '<h3>' + esc(name) + '</h3>' +
          '<span class="muted seeker-date">' + esc(fmtDate(r.created_at)) + '</span>' +
        '</div>' +
        (meta.length ? '<p class="seeker-meta">' + meta.join(' &middot; ') + '</p>' : '') +
        (r.skills ? '<p class="seeker-skills"><strong>Skills:</strong> ' + esc(r.skills) + '</p>' : '') +
        (r.applying_for ? '<p class="seeker-skills"><strong>Looking for:</strong> ' + esc(r.applying_for) + '</p>' : '') +
        (contact.length ? '<p class="seeker-contact">' + contact.join(' &nbsp; ') + '</p>' : '') +
        '<div class="seeker-actions">' + waLink + cv + '</div>' +
      '</article>';
    }).join('');
  }
})();
