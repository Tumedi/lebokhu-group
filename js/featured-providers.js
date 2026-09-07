/* ============================================================
   LeKhuBo Connect — featured-providers.js
   Homepage: shows the top-rated approved service providers.
   Silently does nothing if the DB isn't configured or none exist.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.LEBOKHU_SUPABASE;
  var wrap = document.getElementById('featuredProviders');
  var grid = document.getElementById('featuredGrid');
  if (!wrap || !grid || !CFG || !CFG.isConfigured()) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function stars(avg) {
    avg = Number(avg) || 0;
    var out = '';
    for (var i = 1; i <= 5; i++) {
      if (avg >= i) out += '<span class="star full">★</span>';
      else if (avg >= i - 0.5) out += '<span class="star half">★</span>';
      else out += '<span class="star empty">★</span>';
    }
    return out;
  }

  var client = CFG.client();
  if (!client) return;

  // Prefer providers that have at least one review, ordered by rating then count.
  client.from(CFG.PROVIDERS_TABLE)
    .select('*')
    .eq('status', 'approved')
    .order('rating_avg', { ascending: false })
    .order('rating_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(6)
    .then(function (res) {
      var rows = (res && res.data) || [];
      // Show the section only if we have providers to feature.
      if (!rows.length) return;

      grid.innerHTML = rows.map(function (p) {
        var avatar = p.photo_url
          ? '<img class="prov-photo" src="' + esc(p.photo_url) + '" alt="' + esc(p.full_name) + '">'
          : '<span class="prov-avatar">' + esc((p.full_name || '?').charAt(0).toUpperCase()) + '</span>';
        var rating = p.rating_count
          ? '<div class="prov-rating"><span class="stars">' + stars(p.rating_avg) + '</span>' +
            '<span class="rating-text">' + Number(p.rating_avg).toFixed(1) + ' (' + p.rating_count + ')</span></div>'
          : '<div class="prov-rating"><span class="rating-text">New provider</span></div>';
        return '<a class="featured-card" href="services-directory.html">' +
          '<div class="prov-head">' + avatar +
            '<div><h4>' + esc(p.full_name) + '</h4>' +
            '<span class="badge badge-level">' + esc(p.service) + '</span></div>' +
          '</div>' + rating +
          (p.location ? '<p class="prov-meta"><span>📍 ' + esc(p.location) + '</span></p>' : '') +
        '</a>';
      }).join('');

      wrap.hidden = false;
    })
    .catch(function () { /* leave hidden */ });
})();
