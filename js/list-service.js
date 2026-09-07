/* ============================================================
   LeKhuBo Connect — list-service.js
   Service provider lists/updates their service. Requires a
   logged-in 'provider'. Saves to service_providers (status pending).
   If the provider already has a listing, it loads it for editing.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('serviceForm');
  if (!form) return;
  var status = document.getElementById('serviceStatus');

  var AUTH = window.LEBOKHU_AUTH;
  if (!(AUTH && AUTH.configured())) {
    document.getElementById('notConfigured').hidden = false;
    form.querySelectorAll('input,select,textarea,button').forEach(function (el) { el.disabled = true; });
    return;
  }

  var CFG = window.LEBOKHU_SUPABASE;
  var client = AUTH.client();
  var profile = null;
  var existingId = null;

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function setVal(id, v) { var el = document.getElementById(id); if (el && v != null) el.value = v; }

  var MAX_PHOTO = 2 * 1024 * 1024; // 2 MB
  var existingPhotoUrl = null;
  var photoInput = document.getElementById('photo');
  var photoPreview = document.getElementById('photoPreview');
  if (photoInput) {
    photoInput.addEventListener('change', function () {
      var f = photoInput.files && photoInput.files[0];
      if (!f) return;
      if (f.size > MAX_PHOTO) {
        status.textContent = 'Photo is larger than 2 MB. Please choose a smaller image.';
        status.className = 'form-status bad';
        photoInput.value = '';
        return;
      }
      photoPreview.src = URL.createObjectURL(f);
      photoPreview.hidden = false;
    });
  }

  function uploadPhoto() {
    var f = photoInput && photoInput.files && photoInput.files[0];
    if (!f) return Promise.resolve(existingPhotoUrl);   // keep existing if none chosen
    var safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = profile.id + '/' + Date.now() + '_' + safe;
    return client.storage.from(CFG.PHOTO_BUCKET)
      .upload(path, f, { cacheControl: '3600', upsert: true })
      .then(function (res) {
        if (res.error) { console.warn('photo upload failed:', res.error.message); return existingPhotoUrl; }
        var pub = client.storage.from(CFG.PHOTO_BUCKET).getPublicUrl(path);
        return (pub.data && pub.data.publicUrl) || existingPhotoUrl;
      }).catch(function () { return existingPhotoUrl; });
  }

  AUTH.requireAuth('provider').then(function (ctx) {
    profile = ctx.profile;
    AUTH.renderHeader('#mainNav');
    // Prefill name; load existing listing if any
    if (profile.full_name) setVal('fullName', profile.full_name);
    if (profile.phone) setVal('phone', profile.phone);
    return client.from(CFG.PROVIDERS_TABLE).select('*').eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(1);
  }).then(function (res) {
    if (res && res.data && res.data.length) {
      var p = res.data[0];
      existingId = p.id;
      setVal('fullName', p.full_name); setVal('service', p.service); setVal('location', p.location);
      setVal('phone', p.phone); setVal('whatsapp', p.whatsapp); setVal('rate', p.rate);
      setVal('experience', p.experience); setVal('bio', p.bio);
      existingPhotoUrl = p.photo_url || null;
      if (existingPhotoUrl && photoPreview) { photoPreview.src = existingPhotoUrl; photoPreview.hidden = false; }
      var s = form.querySelector('button[type="submit"]'); if (s) s.textContent = 'Update Listing';
      status.textContent = 'You already have a listing (' + (p.status || 'pending') + '). Edit and resubmit below.';
      status.className = 'form-status';
      initGallery(p.id);   // show + manage the portfolio gallery
    }
  }).catch(function () { /* requireAuth redirected, or no listing */ });

  form.querySelectorAll('input,select,textarea').forEach(function (f) {
    f.addEventListener('input', function () { f.classList.remove('err'); });
  });

  function validate() {
    var valid = true;
    form.querySelectorAll('[required]').forEach(function (field) {
      var ok = field.value.trim() !== '';
      field.classList.toggle('err', !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status.textContent = ''; status.className = 'form-status';
    if (!profile) return;
    if (!validate()) {
      status.textContent = 'Please complete all required fields.';
      status.className = 'form-status bad';
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Submitting…';

    uploadPhoto().then(function (photoUrl) {
    var record = {
      user_id: profile.id,
      full_name: val('fullName'),
      service: val('service'),
      location: val('location'),
      phone: val('phone'),
      whatsapp: val('whatsapp'),
      email: profile.email || '',
      rate: val('rate'),
      experience: val('experience'),
      bio: val('bio'),
      photo_url: photoUrl || null,
      status: 'pending'  // resubmitting sends it back to review
    };

    var op = existingId
      ? client.from(CFG.PROVIDERS_TABLE).update(record).eq('id', existingId)
      : client.from(CFG.PROVIDERS_TABLE).insert([record]);

    op.then(function (res) {
      if (res.error) throw new Error(res.error.message);
      status.innerHTML = '✓ Your service listing has been submitted for review. ' +
        'Track it under <a href="my-services.html">My Services</a>.';
      status.className = 'form-status ok';
      setTimeout(function () { location.href = 'my-services.html'; }, 1500);
    }).catch(function (err) {
      status.textContent = 'Sorry, could not submit: ' + err.message;
      status.className = 'form-status bad';
      btn.disabled = false; btn.textContent = original;
    });
    }); // end uploadPhoto
  });

  /* ---- Portfolio gallery ---- */
  function initGallery(providerId) {
    var card = document.getElementById('galleryCard');
    var grid = document.getElementById('galleryGrid');
    var fileInput = document.getElementById('galleryFile');
    var gStatus = document.getElementById('galleryStatus');
    if (!card || !grid) return;
    card.hidden = false;

    function esc2(s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    }

    function loadGallery() {
      client.from(CFG.GALLERY_TABLE).select('*').eq('provider_id', providerId)
        .order('created_at', { ascending: false })
        .then(function (res) {
          var rows = (res && res.data) || [];
          if (!rows.length) { grid.innerHTML = '<p class="muted">No photos yet. Add your first!</p>'; return; }
          grid.innerHTML = rows.map(function (g) {
            return '<div class="gallery-item">' +
              '<img src="' + esc2(g.image_url) + '" alt="Portfolio photo" loading="lazy">' +
              '<button type="button" class="gallery-del" data-del="' + esc2(g.id) + '" title="Remove">&times;</button>' +
            '</div>';
          }).join('');
          grid.querySelectorAll('[data-del]').forEach(function (b) {
            b.addEventListener('click', function () { delImage(b.getAttribute('data-del')); });
          });
        });
    }

    function delImage(id) {
      if (!confirm('Remove this photo from your gallery?')) return;
      client.from(CFG.GALLERY_TABLE).delete().eq('id', id).then(function (res) {
        if (res.error) { alert('Could not remove: ' + res.error.message); return; }
        loadGallery();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (!f) return;
        if (f.size > 5 * 1024 * 1024) { gStatus.textContent = 'Image is larger than 5 MB.'; gStatus.className = 'form-status bad'; fileInput.value = ''; return; }
        gStatus.textContent = 'Uploading…'; gStatus.className = 'form-status';
        var safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var path = providerId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '_' + safe;
        client.storage.from(CFG.GALLERY_BUCKET).upload(path, f, { cacheControl: '3600', upsert: false })
          .then(function (res) {
            if (res.error) throw new Error(res.error.message);
            var pub = client.storage.from(CFG.GALLERY_BUCKET).getPublicUrl(path);
            return client.from(CFG.GALLERY_TABLE).insert([{
              provider_id: providerId,
              image_url: (pub.data && pub.data.publicUrl) || ''
            }]);
          })
          .then(function (res) {
            if (res && res.error) throw new Error(res.error.message);
            gStatus.textContent = '✓ Photo added.'; gStatus.className = 'form-status ok';
            loadGallery();
          })
          .catch(function (err) { gStatus.textContent = 'Upload failed: ' + err.message; gStatus.className = 'form-status bad'; })
          .then(function () { fileInput.value = ''; });
      });
    }

    loadGallery();
  }
})();
