-- ============================================================
-- LeBoKhu Group — Employer Job Posts setup
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Copy everything BELOW this comment block.)
-- Creates the job_posts table + security rules so employers can
-- SUBMIT posts (saved as 'pending'), and only YOU (logged in) can
-- read/approve/edit/delete them.
-- ============================================================

-- 1) TABLE
create table if not exists public.job_posts (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  company        text not null,
  contact_name   text,
  contact_email  text not null,
  contact_phone  text,
  title          text not null,
  sector         text,
  level          text,
  location       text,
  job_type       text,          -- Full-time / Part-time / Contract / etc.
  description    text,
  closing_date   date,
  status         text not null default 'pending'   -- pending | approved | closed
);

-- Indexes for reporting / filtering
create index if not exists job_posts_created_at_idx on public.job_posts (created_at desc);
create index if not exists job_posts_status_idx     on public.job_posts (status);
create index if not exists job_posts_sector_idx     on public.job_posts (sector);

-- 2) ROW LEVEL SECURITY
alter table public.job_posts enable row level security;

-- Anyone may SUBMIT a job post (forced to 'pending' via the app)...
drop policy if exists "public can post job" on public.job_posts;
create policy "public can post job"
  on public.job_posts
  for insert
  to anon, authenticated
  with check (true);

-- The public may READ only APPROVED posts (so the Jobs page can show them)
drop policy if exists "public can read approved" on public.job_posts;
create policy "public can read approved"
  on public.job_posts
  for select
  to anon, authenticated
  using (status = 'approved');

-- Logged-in admin may READ everything (incl. pending)
drop policy if exists "authenticated can read all posts" on public.job_posts;
create policy "authenticated can read all posts"
  on public.job_posts
  for select
  to authenticated
  using (true);

-- Logged-in admin may UPDATE (approve / close / edit)
drop policy if exists "authenticated can update posts" on public.job_posts;
create policy "authenticated can update posts"
  on public.job_posts
  for update
  to authenticated
  using (true)
  with check (true);

-- Logged-in admin may DELETE
drop policy if exists "authenticated can delete posts" on public.job_posts;
create policy "authenticated can delete posts"
  on public.job_posts
  for delete
  to authenticated
  using (true);
