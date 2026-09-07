/* ============================================================
   LeBoKhu Group — Supabase configuration
   ------------------------------------------------------------
   Replace the two placeholder values below with YOUR project's
   values from: Supabase Dashboard → Project Settings → API
     • Project URL   → SUPABASE_URL
     • anon public   → SUPABASE_ANON_KEY   (safe for the browser)
   Do NOT put the service_role secret key here.
   ============================================================ */
window.LEBOKHU_SUPABASE = {
  SUPABASE_URL: 'https://efupodoraphybvzttrjj.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_RNrGuV3g7k98hiAlfwz6wA_QrThfmTJ',
  TABLE: 'job_seekers',
  POSTS_TABLE: 'job_posts',
  PROVIDERS_TABLE: 'service_providers',
  REQUESTS_TABLE: 'service_requests',
  REVIEWS_TABLE: 'reviews',
  MESSAGES_TABLE: 'messages',
  BUCKET: 'cvs',
  PHOTO_BUCKET: 'provider-photos',
  CHAT_MEDIA_BUCKET: 'chat-media'
};

// Helper: is Supabase configured yet?
window.LEBOKHU_SUPABASE.isConfigured = function () {
  var c = window.LEBOKHU_SUPABASE;
  return c.SUPABASE_URL.indexOf('PLACEHOLDER') === -1 &&
         c.SUPABASE_ANON_KEY.indexOf('PLACEHOLDER') === -1 &&
         c.SUPABASE_URL.indexOf('supabase.co') !== -1;
};

// Lazily create a shared Supabase client (requires the supabase-js library
// to be loaded on the page before this is called).
window.LEBOKHU_SUPABASE.client = function () {
  var c = window.LEBOKHU_SUPABASE;
  if (!c.isConfigured() || typeof window.supabase === 'undefined') return null;
  if (!c._client) {
    c._client = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  }
  return c._client;
};
