/* ============================================================
   LeKhuBo Connect — services-directory.js
   Public directory of APPROVED service providers. Homeowners
   search/filter, view contact details, and submit a request
   (open — no login required). Requests save to the DB and
   trigger an email to the admin + provider (Resend, optional).
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.LEBOKHU_SUPABASE;
  var listEl = document.getElementById('providerList');
  var countEl = document.getElementById('resultsCount');
  var noRes = document.getElementById('noResults');
  var searchEl = document.getElementById('search');
  var serviceEl = document.getElementById('service');
  var locEl = document.getElementById('loc');

  var PROVIDERS = [];
  var VIEW = [];
  var homeownerProfile = null;   // set if a logged-in homeowner is browsing

  // Detect a logged-in homeowner (for prefill + linking + saved chats).
  if (window.LEBOKHU_AUTH && window.LEBOKHU_AUTH.configured()) {
    window.LEBOKHU_AUTH.renderHeader('#mainNav');
    window.LEBOKHU_AUTH.getProfile().then(function (p) {
      if (p && p.role === 'homeowner') homeownerProfile = p;
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function digits(s) { return String(s || '').replace(/[^0-9+]/g, ''); }

  // Render stars for an average rating (0–5), supporting halves.
  function starsHtml(avg) {
    avg = Number(avg) || 0;
    var out = '';
    for (var i = 1; i <= 5; i++) {
      if (avg >= i) out += '<span class="star full">★</span>';
      else if (avg >= i - 0.5) out += '<span class="star half">★</span>';
      else out += '<span class="star empty">★</span>';
    }
    return out;
  }
  function ratingLine(p) {
    var n = p.rating_count || 0;
    if (!n) return '<div class="prov-rating"><span class="stars">' + starsHtml(0) + '</span>' +
      '<span class="rating-text">No reviews yet</span></div>';
    return '<div class="prov-rating"><span class="stars">' + starsHtml(p.rating_avg) + '</span>' +
      '<span class="rating-text">' + Number(p.rating_avg).toFixed(1) + ' (' + n + (n === 1 ? ' review' : ' reviews') + ')</span></div>';
  }

  function providerCard(p, idx) {
    var phone = p.phone ? '<a class="prov-contact" href="tel:' + esc(digits(p.phone)) + '">📞 ' + esc(p.phone) + '</a>' : '';
    var wa = p.whatsapp ? '<a class="prov-contact" target="_blank" rel="noopener" href="https://wa.me/' + esc(digits(p.whatsapp).replace(/^0/, '27')) + '">💬 WhatsApp</a>' : '';
    var avatar = p.photo_url
      ? '<img class="prov-photo" src="' + esc(p.photo_url) + '" alt="' + esc(p.full_name) + '">'
      : '<span class="prov-avatar">' + esc((p.full_name || '?').charAt(0).toUpperCase()) + '</span>';
    return '' +
      '<article class="provider-card">' +
        '<div class="prov-head">' +
          avatar +
          '<div>' +
            '<h3>' + esc(p.full_name) + '</h3>' +
            '<span class="badge badge-level">' + esc(p.service) + '</span>' +
          '</div>' +
        '</div>' +
        ratingLine(p) +
        '<p class="prov-meta">' +
          (p.location ? '<span>📍 ' + esc(p.location) + '</span>' : '') +
          (p.rate ? '<span>💰 ' + esc(p.rate) + '</span>' : '') +
          (p.experience ? '<span>🧰 ' + esc(p.experience) + '</span>' : '') +
        '</p>' +
        (p.bio ? '<p class="prov-bio">' + esc(p.bio) + '</p>' : '') +
        '<div class="prov-gallery" data-gallery="' + esc(p.id) + '" hidden></div>' +
        '<div class="prov-actions">' +
          phone + wa +
          '<button class="btn btn-outline btn-sm" data-rev="' + idx + '">★ Reviews</button>' +
          '<button class="btn btn-primary btn-sm" data-req="' + idx + '">Request Service</button>' +
        '</div>' +
      '</article>';
  }

  // Load portfolio galleries for the visible providers and fill the strips.
  function loadGalleries() {
    var ids = VIEW.map(function (p) { return p.id; });
    if (!ids.length) return;
    var client = CFG.client();
    client.from(CFG.GALLERY_TABLE).select('provider_id, image_url')
      .in('provider_id', ids).order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error || !res.data) return;
        var byProvider = {};
        res.data.forEach(function (g) {
          (byProvider[g.provider_id] = byProvider[g.provider_id] || []).push(g.image_url);
        });
        Object.keys(byProvider).forEach(function (pid) {
          var strip = listEl.querySelector('[data-gallery="' + pid + '"]');
          if (!strip) return;
          var imgs = byProvider[pid].slice(0, 4);
          strip.innerHTML = imgs.map(function (u) {
            return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="Work photo" loading="lazy"></a>';
          }).join('');
          strip.hidden = false;
        });
      }).catch(function () {});
  }

  function render() {
    var s = (searchEl.value || '').trim().toLowerCase();
    var service = serviceEl.value;
    var loc = (locEl.value || '').trim().toLowerCase();

    VIEW = PROVIDERS.filter(function (p) {
      if (service && p.service !== service) return false;
      if (loc && (p.location || '').toLowerCase().indexOf(loc) === -1) return false;
      if (s && (p.full_name + ' ' + p.service + ' ' + (p.bio || '')).toLowerCase().indexOf(s) === -1) return false;
      return true;
    });

    listEl.innerHTML = VIEW.map(providerCard).join('');
    countEl.textContent = VIEW.length + (VIEW.length === 1 ? ' provider' : ' providers') + ' found';
    noRes.hidden = VIEW.length !== 0;

    listEl.querySelectorAll('[data-req]').forEach(function (btn) {
      btn.addEventListener('click', function () { openRequest(VIEW[parseInt(btn.getAttribute('data-req'), 10)]); });
    });
    listEl.querySelectorAll('[data-rev]').forEach(function (btn) {
      btn.addEventListener('click', function () { openReviews(VIEW[parseInt(btn.getAttribute('data-rev'), 10)]); });
    });

    loadGalleries();
  }

  function load() {
    if (!CFG || !CFG.isConfigured()) {
      countEl.textContent = '';
      noRes.hidden = false;
      noRes.querySelector('p').textContent = 'The services directory isn\'t connected yet.';
      return;
    }
    var client = CFG.client();
    countEl.textContent = 'Loading…';
    client.from(CFG.PROVIDERS_TABLE).select('*').eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) { countEl.textContent = 'Error loading providers: ' + res.error.message; return; }
        PROVIDERS = res.data || [];
        render();
      });
  }

  [searchEl, serviceEl, locEl].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  /* ---- Request a service modal ---- */
  var modal = document.getElementById('reqModal');
  var reqProvider = document.getElementById('reqProvider');
  var reqForm = document.getElementById('reqForm');
  var reqStatus = document.getElementById('reqStatus');
  var currentProvider = null;
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function openRequest(p) {
    currentProvider = p;
    reqProvider.textContent = (p.full_name || '') + ' — ' + (p.service || '');
    reqStatus.textContent = ''; reqStatus.className = 'form-status';
    reqForm.reset();
    // Reset any previous chat state (form was hidden after a prior submission)
    reqForm.style.display = '';
    var chatArea = document.getElementById('reqChatArea');
    if (chatArea) { chatArea.hidden = true; chatArea.innerHTML = ''; }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    // Auto-populate for a logged-in homeowner. Resolve the profile fresh so it
    // works even if the modal is opened before the initial lookup finished.
    applyHomeownerPrefill();
  }

  // Fill the form from the homeowner's profile (and hide the login nudge).
  function fillFromProfile(p) {
    var nudge = document.getElementById('reqLoginNudge');
    if (p && p.role === 'homeowner') {
      homeownerProfile = p;
      var n = document.getElementById('hName'); if (n && p.full_name) n.value = p.full_name;
      var e = document.getElementById('hEmail'); if (e && p.email) e.value = p.email;
      var ph = document.getElementById('hPhone'); if (ph && p.phone) ph.value = p.phone;
      var lo = document.getElementById('hLocation'); if (lo && !lo.value && p.location) lo.value = p.location;
      if (nudge) nudge.hidden = true;
    } else if (nudge) {
      nudge.hidden = false;
    }
  }

  function applyHomeownerPrefill() {
    if (homeownerProfile) { fillFromProfile(homeownerProfile); return; }
    if (window.LEBOKHU_AUTH && window.LEBOKHU_AUTH.configured()) {
      window.LEBOKHU_AUTH.getProfile().then(fillFromProfile);
    } else {
      fillFromProfile(null);
    }
  }
  function closeRequest() { modal.hidden = true; document.body.style.overflow = ''; }
  modal.querySelectorAll('[data-rclose]').forEach(function (el) { el.addEventListener('click', closeRequest); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeRequest(); });

  reqForm.querySelectorAll('input,textarea').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  reqForm.addEventListener('submit', function (e) {
    e.preventDefault();
    reqStatus.textContent = ''; reqStatus.className = 'form-status';
    if (!currentProvider) return;

    var name = document.getElementById('hName');
    var phone = document.getElementById('hPhone');
    var email = document.getElementById('hEmail');
    var loc = document.getElementById('hLocation');
    var details = document.getElementById('hDetails');

    var ok = true;
    [name, phone, details].forEach(function (f) { if (!f.value.trim()) { f.classList.add('err'); ok = false; } });
    if (email.value.trim() && !emailRe.test(email.value.trim())) { email.classList.add('err'); ok = false; }
    if (!ok) {
      reqStatus.textContent = 'Please complete the required fields (name, phone, details).';
      reqStatus.className = 'form-status bad';
      return;
    }

    var client = CFG.client();
    var record = {
      provider_id: currentProvider.id,
      provider_name: currentProvider.full_name || '',
      service: currentProvider.service || '',
      homeowner_name: name.value.trim(),
      homeowner_email: email.value.trim(),
      homeowner_phone: phone.value.trim(),
      location: loc.value.trim(),
      details: details.value.trim(),
      status: 'new',
      homeowner_id: homeownerProfile ? homeownerProfile.id : null
    };

    var btn = reqForm.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';

    client.from(CFG.REQUESTS_TABLE).insert([record]).select('id, access_token').then(function (res) {
      if (res.error) throw new Error(res.error.message);
      // Fire notification email (optional Edge Function) — non-blocking
      sendRequestEmail(record, currentProvider);
      reqStatus.textContent = 'Thank you, ' + record.homeowner_name + '! Your request has been sent.';
      reqStatus.className = 'form-status ok';
      var row = res.data && res.data[0];
      if (row && row.id && row.access_token) {
        openChat(row.id, row.access_token, record.homeowner_name);
      } else {
        // RLS may block reading the row back for anon — the request still
        // saved. Show a clear success without breaking.
        reqStatus.textContent = 'Thank you, ' + record.homeowner_name +
          '! Your request has been sent — ' + (currentProvider.full_name || 'the provider') +
          ' or our team will contact you soon.';
        setTimeout(closeRequest, 2500);
      }
    }).catch(function (err) {
      reqStatus.textContent = 'Sorry, could not send: ' + err.message +
        '. Please try again or call ' + (currentProvider.phone || 'us') + '.';
      reqStatus.className = 'form-status bad';
    }).then(function () {
      btn.disabled = false; btn.textContent = original;
    });
  });

  // After a request is sent, reveal an inline chat with the provider + a private link.
  var reqFormWrap = reqForm;
  function openChat(requestId, token, name) {
    var link = location.origin + location.pathname.replace(/services-directory\.html$/, 'chat.html') +
      '?r=' + encodeURIComponent(requestId) + '&t=' + encodeURIComponent(token);
    // Hide the form; show chat + link inside the modal
    reqFormWrap.style.display = 'none';
    var host = document.getElementById('reqChatArea');
    host.hidden = false;
    host.innerHTML =
      '<p class="chat-intro">💬 You can now chat directly with <strong>' + esc(currentProvider.full_name || 'your provider') + '</strong>. ' +
      'Bookmark this private link to return to the conversation:</p>' +
      '<div class="chat-link"><input type="text" readonly value="' + esc(link) + '" id="chatLinkInput">' +
      '<button type="button" class="btn btn-outline btn-sm" id="copyChatLink">Copy</button></div>' +
      '<div id="reqChatMount"></div>';
    var copyBtn = document.getElementById('copyChatLink');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var inp = document.getElementById('chatLinkInput');
      inp.select();
      try { navigator.clipboard.writeText(inp.value); copyBtn.textContent = 'Copied ✓'; }
      catch (e) { document.execCommand && document.execCommand('copy'); copyBtn.textContent = 'Copied ✓'; }
    });
    if (window.LEBOKHU_CHAT) {
      window.LEBOKHU_CHAT.mount({
        container: document.getElementById('reqChatMount'),
        requestId: requestId,
        sender: 'homeowner',
        senderName: name || 'Homeowner',
        recipientEmail: (currentProvider && currentProvider.email) || '',
        recipientName: (currentProvider && currentProvider.full_name) || '',
        service: (currentProvider && currentProvider.service) || '',
        chatUrl: link
      });
    }
  }

  /* ---- Reviews modal ---- */
  var revModal = document.getElementById('revModal');
  var revProviderEl = document.getElementById('revProvider');
  var revListEl = document.getElementById('revList');
  var revForm = document.getElementById('revForm');
  var revStatus = document.getElementById('revStatus');
  var revStarsEl = document.getElementById('revStars');
  var currentRevProvider = null;
  var chosenRating = 0;

  function paintStarInput() {
    if (!revStarsEl) return;
    var spans = revStarsEl.querySelectorAll('.star');
    spans.forEach(function (s, i) { s.classList.toggle('full', i < chosenRating); s.classList.toggle('empty', i >= chosenRating); });
  }
  if (revStarsEl) {
    revStarsEl.querySelectorAll('.star').forEach(function (s, i) {
      s.addEventListener('click', function () { chosenRating = i + 1; paintStarInput(); });
    });
  }

  function openReviews(p) {
    currentRevProvider = p;
    chosenRating = 0; paintStarInput();
    revProviderEl.textContent = (p.full_name || '') + ' — ' + (p.service || '');
    // Provider photo + rating header
    var head = document.getElementById('revProviderHead');
    if (head) {
      var avatar = p.photo_url
        ? '<img class="prov-photo" src="' + esc(p.photo_url) + '" alt="' + esc(p.full_name) + '">'
        : '<span class="prov-avatar">' + esc((p.full_name || '?').charAt(0).toUpperCase()) + '</span>';
      var rt = p.rating_count
        ? '<span class="stars">' + starsHtml(p.rating_avg) + '</span> <span class="rating-text">' +
          Number(p.rating_avg).toFixed(1) + ' (' + p.rating_count + ')</span>'
        : '<span class="rating-text">No reviews yet</span>';
      head.innerHTML = avatar + '<div><strong>' + esc(p.full_name) + '</strong><div class="prov-rating">' + rt + '</div></div>';
    }
    revStatus.textContent = ''; revStatus.className = 'form-status';
    if (revForm) revForm.reset();
    revListEl.innerHTML = '<p class="muted">Loading reviews…</p>';
    revModal.hidden = false;
    document.body.style.overflow = 'hidden';

    var client = CFG.client();
    client.from(CFG.REVIEWS_TABLE).select('*').eq('provider_id', p.id)
      .order('created_at', { ascending: false }).limit(50)
      .then(function (res) {
        var rows = (res && res.data) || [];
        if (!rows.length) { revListEl.innerHTML = '<p class="muted">No reviews yet. Be the first to leave one!</p>'; return; }
        revListEl.innerHTML = rows.map(function (r) {
          return '<div class="review-item">' +
            '<div class="review-top"><span class="stars">' + starsHtml(r.rating) + '</span>' +
            '<strong>' + esc(r.reviewer_name || 'Anonymous') + '</strong></div>' +
            (r.comment ? '<p>' + esc(r.comment) + '</p>' : '') +
          '</div>';
        }).join('');
      });
  }
  function closeReviews() { revModal.hidden = true; document.body.style.overflow = ''; }
  if (revModal) {
    revModal.querySelectorAll('[data-vclose]').forEach(function (el) { el.addEventListener('click', closeReviews); });
  }

  if (revForm) {
    revForm.addEventListener('submit', function (e) {
      e.preventDefault();
      revStatus.textContent = ''; revStatus.className = 'form-status';
      if (!currentRevProvider) return;
      if (!chosenRating) {
        revStatus.textContent = 'Please tap a star to choose a rating.';
        revStatus.className = 'form-status bad';
        return;
      }
      var name = document.getElementById('revName').value.trim();
      var comment = document.getElementById('revComment').value.trim();
      var client = CFG.client();
      var btn = revForm.querySelector('button[type="submit"]');
      var original = btn.textContent; btn.disabled = true; btn.textContent = 'Posting…';

      client.from(CFG.REVIEWS_TABLE).insert([{
        provider_id: currentRevProvider.id,
        rating: chosenRating,
        reviewer_name: name,
        comment: comment
      }]).then(function (res) {
        if (res.error) throw new Error(res.error.message);
        revStatus.textContent = '✓ Thank you for your review!';
        revStatus.className = 'form-status ok';
        revForm.reset(); chosenRating = 0; paintStarInput();
        // Refresh directory (updated averages) + this list after a moment
        setTimeout(function () { load(); openReviewsRefresh(currentRevProvider.id); }, 800);
      }).catch(function (err) {
        revStatus.textContent = 'Could not post review: ' + err.message;
        revStatus.className = 'form-status bad';
      }).then(function () { btn.disabled = false; btn.textContent = original; });
    });
  }
  // Re-open the review list for the same provider after posting (fetch fresh row)
  function openReviewsRefresh(providerId) {
    var client = CFG.client();
    client.from(CFG.PROVIDERS_TABLE).select('*').eq('id', providerId).single()
      .then(function (res) { if (res.data) openReviews(res.data); });
  }

  function sendRequestEmail(record, provider) {
    var client = CFG.client();
    if (!client || !client.functions) return;
    client.functions.invoke('send-service-request-email', {
      body: {
        provider_email: provider.email || '',
        provider_name: provider.full_name || '',
        service: record.service,
        homeowner_name: record.homeowner_name,
        homeowner_phone: record.homeowner_phone,
        homeowner_email: record.homeowner_email,
        location: record.location,
        details: record.details
      }
    }).catch(function () { /* non-blocking */ });
  }

  load();
})();
