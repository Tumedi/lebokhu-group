-- ============================================================
-- LeKhuBo Connect — Employer manages applications to their posts
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Copy everything BELOW this comment block.)
--
-- Prerequisite: supabase-auth.sql has already been run (it creates the
-- applications table, job_posts.user_id link, and the policies that let an
-- employer READ applications made to their own posts).
--
-- This migration adds the ONE missing piece so a "Potential Employer"
-- (profiles.role = 'homeowner') who posted a job can also ACT on the
-- applications it receives — Shortlist / Reject / Accept — directly from
-- their own dashboard, instead of only the admin being able to.
--
-- Security model (unchanged elsewhere):
--   • A seeker still only sees/creates their OWN applications.
--   • An employer still only sees applications to the jobs THEY posted
--     (job_posts.user_id = auth.uid()).
--   • Admin still has full read/update/delete on everything.
-- ============================================================

-- An employer may UPDATE applications made to THEIR OWN posts.
-- (The USING clause scopes which rows are visible to update; the WITH CHECK
--  clause ensures the row still belongs to one of their posts afterwards, so
--  they cannot move an application onto another employer's job.)
drop policy if exists "employer updates applications to own posts" on public.applications;
create policy "employer updates applications to own posts"
  on public.applications for update
  to authenticated
  using (exists (
    select 1 from public.job_posts p
    where p.id = applications.job_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.job_posts p
    where p.id = applications.job_id and p.user_id = auth.uid()
  ));

-- ============================================================
-- AFTER RUNNING: a logged-in employer visiting my-posts.html will be able to
-- see each of their job posts, the applicants per post, and change an
-- application's status to shortlisted / rejected / hired. The seeker is
-- emailed on status change (send-status-email), and the employer + admin are
-- emailed when a new application arrives (send-new-applicant-email).
-- ============================================================
