-- ============================================================
-- LeKhuBo Connect — Admin User Management
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Copy everything BELOW this comment block.)
--
-- Lets the admin manage registered accounts from the admin dashboard's
-- new "Users" tab: list everyone, suspend/unsuspend, and delete.
--
-- Prerequisite: supabase-auth.sql has already been run (it creates
-- public.profiles, the is_admin() helper, and the "admin reads all
-- profiles" SELECT policy).
--
-- What this adds:
--   1. profiles.suspended  — a flag the dashboard shows + the login gate
--      checks (set by the admin-user-action Edge Function on suspend).
--   2. Admin UPDATE + DELETE policies on profiles (only SELECT existed).
--
-- NOTE: Truly deleting / banning the underlying auth.users LOGIN account
-- (which frees the email address) is done by the admin-user-action Edge
-- Function using the service_role key — it cannot be done from the browser.
-- These policies cover the profiles row + the suspended flag.
-- ============================================================

-- 1) SUSPENDED FLAG ------------------------------------------
alter table public.profiles
  add column if not exists suspended boolean not null default false;

-- 2) ADMIN UPDATE / DELETE ON PROFILES -----------------------
-- (Mirror the admin policies already present on applications/job_posts.)
drop policy if exists "admin updates all profiles" on public.profiles;
create policy "admin updates all profiles"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin deletes all profiles" on public.profiles;
create policy "admin deletes all profiles"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- 3) ADMIN-ONLY VIEW OF USERS (profile + email) --------------
-- The email address lives in auth.users, which the browser cannot read.
-- This SECURITY DEFINER function returns the joined list ONLY to admins, so
-- the dashboard can show each user's email alongside their profile.
create or replace function public.admin_list_users()
returns table (
  id          uuid,
  created_at  timestamptz,
  email       text,
  full_name   text,
  phone       text,
  company     text,
  location    text,
  role        text,
  suspended   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.created_at,
    u.email::text,
    p.full_name,
    p.phone,
    p.company,
    p.location,
    p.role,
    p.suspended
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()           -- non-admins get zero rows
  order by p.created_at desc;
$$;

-- Allow logged-in users to CALL it (the body itself gates on is_admin()).
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ============================================================
-- AFTER RUNNING:
--   • Deploy the Edge Function:  supabase functions deploy admin-user-action
--   • Open admin.html → Users tab to list, suspend/unsuspend, or delete.
-- ============================================================
