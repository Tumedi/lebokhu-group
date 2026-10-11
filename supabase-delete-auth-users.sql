-- ============================================================
-- LeKhuBo Connect — DELETE ALL LOGIN ACCOUNTS EXCEPT THE ADMIN
-- Run in Supabase: SQL Editor → New query → paste → Run
-- ============================================================
-- ⚠️  DESTRUCTIVE & IRREVERSIBLE. Deletes every account in auth.users
--     except bigboy.madihlaba@gmail.com. Deleting an auth user cascades to
--     public.profiles (FK on delete cascade) and that user's related data.
--     Use ONLY for a pre-live clean slate.
--
-- BEFORE YOU RUN: take a backup — Supabase Dashboard → Database → Backups.
--
-- This frees up previously-used email addresses so they can register again
-- (fixes "This email is already in use" caused by leftover login accounts).
-- ============================================================

-- STEP 1 — PREVIEW: see exactly which accounts WILL be deleted.
-- (Run this on its own first and eyeball the list.)
select email, created_at, last_sign_in_at
from auth.users
where lower(email) <> lower('bigboy.madihlaba@gmail.com')
order by created_at desc;

-- STEP 2 — DELETE everyone except the admin.
delete from auth.users
where lower(email) <> lower('bigboy.madihlaba@gmail.com');

-- STEP 3 — VERIFY: this should return ONLY bigboy.madihlaba@gmail.com.
select email, created_at from auth.users;

-- ============================================================
-- If STEP 2 errors with a foreign-key / auth.sessions / auth.identities
-- message, DO NOT force-delete the auth sub-tables. Instead delete the
-- accounts via the Dashboard (Authentication → Users → select all except
-- the admin → Delete user), which handles the cascade correctly — or use
-- the admin API (auth.admin.deleteUser) with the service_role key.
-- ============================================================
