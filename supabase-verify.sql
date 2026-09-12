-- ============================================================
-- LeKhuBo Connect — Verification & signup diagnostic queries
-- Run these in Supabase → SQL Editor → New query.
-- All READ-ONLY except the clearly-marked "PROMOTE" block at the bottom.
-- ============================================================

-- ------------------------------------------------------------
-- 0) DID SIGNUP ACTUALLY CREATE AN AUTH ACCOUNT?
--    auth.users is the source of truth for supabase.auth.signUp().
--    If a test signup does NOT appear here, the signUp() call is
--    failing (e.g. "Signups disabled" in Auth → Providers → Email,
--    or a failing handle_new_user trigger). confirmed_at = null means
--    the user exists but hasn't clicked the email confirmation link.
-- ------------------------------------------------------------
select id, email, created_at, confirmed_at, last_sign_in_at
from auth.users
order by created_at desc
limit 10;

-- ------------------------------------------------------------
-- 0b) DID THE PROFILE TRIGGER FIRE?
--     Every auth user should get a matching public.profiles row via
--     the handle_new_user() trigger. If auth.users has the user but
--     this is empty, the trigger is missing/failing (re-run
--     supabase-auth.sql). NOTE: signup.html accounts live HERE, NOT
--     in the job_seekers table shown in the admin "Job Seekers" tab.
-- ------------------------------------------------------------
select p.id, u.email, p.role, p.full_name, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
order by p.created_at desc
limit 10;

-- ------------------------------------------------------------
-- 0c) IS THE TRIGGER INSTALLED?
--     Should return one row named on_auth_user_created.
-- ------------------------------------------------------------
select tgname, tgrelid::regclass as table_name, tgenabled
from pg_trigger
where tgname = 'on_auth_user_created';

-- ------------------------------------------------------------
-- 0d) LEGACY REGISTRATION TABLE (admin "Job Seekers" tab reads THIS).
--     Filled by register.html, NOT by signup.html accounts.
-- ------------------------------------------------------------
select id, first_name, last_name, email, created_at
from public.job_seekers
order by created_at desc
limit 10;

-- ------------------------------------------------------------
-- 1) WHO IS AN ADMIN?
-- ------------------------------------------------------------
select p.id, u.email, p.role, p.full_name, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin'
order by p.created_at;

-- ------------------------------------------------------------
-- 2) ROLE BREAKDOWN
-- ------------------------------------------------------------
select coalesce(role, '(null)') as role, count(*) as accounts
from public.profiles
group by role
order by accounts desc;

-- ------------------------------------------------------------
-- 3) CONFIRM is_admin() DEFINITION
-- ------------------------------------------------------------
select pg_get_functiondef('public.is_admin()'::regprocedure);

-- ============================================================
-- PROMOTE AN ACCOUNT TO ADMIN  (edit + run ONLY when needed)
-- ============================================================
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'Tbmadihlaba@gmail.com');
