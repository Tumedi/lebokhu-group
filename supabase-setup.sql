-- ============================================================
-- LeBoKhu Group — Supabase setup
-- Run this ONCE in your Supabase project:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
-- It creates: the job_seekers table, the "cvs" storage bucket,
-- and the security rules (RLS) so the public can only REGISTER,
-- while only YOU (logged in) can read/report on the data.
-- ============================================================

-- 1) TABLE ---------------------------------------------------
create table if not exists public.job_seekers (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  first_name     text not null,
  last_name      text not null,
  email          text not null,
  phone          text not null,
  location       text,
  right_to_work  text,
  qualification  text,
  experience     text,
  preferred_sector text,
  skills         text,
  applying_for   text,          -- role they applied for (if from a job)
  consent        boolean default false,
  cv_url         text,          -- public URL of uploaded CV (if any)
  cv_filename    text
);

-- Helpful indexes for reporting/filtering
create index if not exists job_seekers_created_at_idx on public.job_seekers (created_at desc);
create index if not exists job_seekers_sector_idx      on public.job_seekers (preferred_sector);
create index if not exists job_seekers_qualification_idx on public.job_seekers (qualification);

-- 2) ROW LEVEL SECURITY --------------------------------------
alter table public.job_seekers enable row level security;

-- Anyone (anonymous visitor) may INSERT a registration...
drop policy if exists "public can register" on public.job_seekers;
create policy "public can register"
  on public.job_seekers
  for insert
  to anon, authenticated
  with check (true);

-- ...but only LOGGED-IN (admin) users may READ the data.
drop policy if exists "authenticated can read" on public.job_seekers;
create policy "authenticated can read"
  on public.job_seekers
  for select
  to authenticated
  using (true);

-- (Optional) allow logged-in admin to delete registrations
drop policy if exists "authenticated can delete" on public.job_seekers;
create policy "authenticated can delete"
  on public.job_seekers
  for delete
  to authenticated
  using (true);

-- 3) STORAGE BUCKET FOR CVs ----------------------------------
-- Public bucket so CV links open easily; filenames are randomised
-- by the app, so they are not guessable.
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', true)
on conflict (id) do nothing;

-- Anyone may UPLOAD a CV into the 'cvs' bucket
drop policy if exists "public can upload cv" on storage.objects;
create policy "public can upload cv"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'cvs');

-- Anyone may READ CVs (needed for the public URL to work)
drop policy if exists "public can read cv" on storage.objects;
create policy "public can read cv"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'cvs');

-- ============================================================
-- AFTER RUNNING THIS:
-- 1. Create your admin login:
--    Dashboard → Authentication → Users → "Add user"
--    Use email: Tbmadihlaba@gmail.com  + a strong password.
--    (This is the login you'll use on the admin page.)
-- 2. Copy your Project URL + anon public key:
--    Dashboard → Project Settings → API
-- ============================================================
