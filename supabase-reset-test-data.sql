-- ============================================================
-- LeKhuBo Connect — FULL TEST-DATA RESET (pre-live clean slate)
-- ============================================================
-- ⚠️  DESTRUCTIVE. This permanently deletes ALL app data EXCEPT the
--     admin account(s) (profiles.role = 'admin'). Use ONLY to get a
--     clean slate for end-to-end testing before going live.
--
-- BEFORE YOU RUN:
--   1. Take a backup/snapshot:  Supabase Dashboard → Database → Backups.
--   2. Read "Two-part process" below — SQL clears the DATA tables, but
--      the login accounts in auth.users must be removed separately
--      (see supabase-reset-test-data.md / Part 2). Deleting them there
--      will cascade-clean public.profiles automatically.
--
-- HOW TO USE:
--   Supabase Dashboard → SQL Editor → New query → paste ALL of this → Run.
--   It runs inside a transaction and prints BEFORE/AFTER counts. Review the
--   output; if anything looks wrong, nothing is lost until you COMMIT.
--   The script COMMITs at the end. To abort instead, change COMMIT; to
--   ROLLBACK; before running.
-- ============================================================

begin;

-- ---- BEFORE: show what exists now --------------------------
select 'BEFORE' as phase,
  (select count(*) from public.job_posts)          as job_posts,
  (select count(*) from public.applications)        as applications,
  (select count(*) from public.job_seekers)         as job_seekers,
  (select count(*) from public.service_providers)   as service_providers,
  (select count(*) from public.service_requests)    as service_requests,
  (select count(*) from public.reviews)             as reviews,
  (select count(*) from public.messages)            as messages,
  (select count(*) from public.provider_gallery)    as provider_gallery,
  (select count(*) from public.profiles)            as profiles_total,
  (select count(*) from public.profiles where role = 'admin') as profiles_admin;

-- ---- DELETE DATA (child-first to respect FKs) --------------
-- Chat + reviews + gallery first (reference requests/providers).
delete from public.messages;
delete from public.reviews;
delete from public.provider_gallery;

-- Applications (reference job_posts + seeker auth users).
delete from public.applications;

-- Service requests + provider listings.
delete from public.service_requests;
delete from public.service_providers;

-- Job posts + legacy registration submissions.
delete from public.job_posts;
delete from public.job_seekers;

-- Non-admin PROFILES. (The matching auth.users rows are removed in Part 2;
-- deleting an auth user cascades to its profile, so this line just clears
-- any profile rows up-front. Admin profiles are preserved.)
delete from public.profiles
 where role is distinct from 'admin';

-- ---- AFTER: confirm the wipe + that admin survived ----------
select 'AFTER' as phase,
  (select count(*) from public.job_posts)          as job_posts,
  (select count(*) from public.applications)        as applications,
  (select count(*) from public.job_seekers)         as job_seekers,
  (select count(*) from public.service_providers)   as service_providers,
  (select count(*) from public.service_requests)    as service_requests,
  (select count(*) from public.reviews)             as reviews,
  (select count(*) from public.messages)            as messages,
  (select count(*) from public.provider_gallery)    as provider_gallery,
  (select count(*) from public.profiles)            as profiles_total,
  (select count(*) from public.profiles where role = 'admin') as profiles_admin;

-- Safety check: there must still be at least one admin profile. If this
-- raises, the transaction aborts and NOTHING is committed.
do $$
begin
  if (select count(*) from public.profiles where role = 'admin') = 0 then
    raise exception 'ABORT: no admin profile would remain — refusing to wipe.';
  end if;
end $$;

commit;
-- To abort instead of applying, replace the COMMIT above with ROLLBACK.
