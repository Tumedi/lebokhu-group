-- ============================================================
-- LeKhuBo Connect — let PROVIDERS browse job seekers (and tighten privacy)
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run.
-- (Run AFTER supabase-setup.sql and supabase-auth.sql.)
--
-- WHY: service providers who have tools/contracts but need extra hands can
-- browse people who registered as job seekers and hire them. The job_seekers
-- table already allowed ANY logged-in account to read every row (email, phone,
-- CV) — this REPLACES that over-permissive policy so only ADMINS and
-- PROVIDERS can read job seekers. Homeowners/seekers can no longer read them.
-- Anyone may still register (insert). Delete is restricted to admins only.
-- ============================================================

-- Helper: is the current user an approved-role we allow to browse seekers?
-- (Uses the existing public.is_admin() from supabase-auth.sql.)

-- 1) READ: admins + providers only ---------------------------
drop policy if exists "authenticated can read" on public.job_seekers;
drop policy if exists "admins and providers read seekers" on public.job_seekers;
create policy "admins and providers read seekers"
  on public.job_seekers for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'provider'
    )
  );

-- 2) DELETE: admins only (was any authenticated user) --------
drop policy if exists "authenticated can delete" on public.job_seekers;
drop policy if exists "admin deletes seekers" on public.job_seekers;
create policy "admin deletes seekers"
  on public.job_seekers for delete
  to authenticated
  using (public.is_admin());

-- INSERT policy ("public can register") is unchanged — anyone may still
-- register as a job seeker.

-- ============================================================
-- DONE. Providers can now browse job seekers on browse-seekers.html;
-- job-seeker data is no longer readable by homeowners or other seekers.
-- ============================================================
