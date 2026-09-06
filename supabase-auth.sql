-- ============================================================
-- LeBoKhu Group — Authentication & Applications setup
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Copy everything BELOW this comment block.)
--
-- Adds:
--   • profiles        — one row per auth user, with a role (seeker | employer)
--   • applications    — a job seeker's application to a job post (with status)
--   • job_posts.user_id — links a post to the employer who owns it
--   • RLS so users only see/manage their own data
--   • a trigger that auto-creates a profile when someone signs up
-- ============================================================

-- 1) PROFILES ------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  role        text not null default 'seeker',   -- 'seeker' | 'employer'
  full_name   text,
  phone       text,
  company     text,                             -- for employers
  location    text
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "users upsert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile when a new auth user signs up.
-- The chosen role/name are passed in auth metadata at sign-up time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, company, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'seeker'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'company',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) LINK JOB POSTS TO THEIR EMPLOYER ------------------------
alter table public.job_posts
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Employers may read their OWN posts (any status); public still reads approved.
drop policy if exists "employer reads own posts" on public.job_posts;
create policy "employer reads own posts"
  on public.job_posts for select
  to authenticated
  using (auth.uid() = user_id);

-- Employers may update / delete their own posts (e.g. close them)
drop policy if exists "employer updates own posts" on public.job_posts;
create policy "employer updates own posts"
  on public.job_posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "employer deletes own posts" on public.job_posts;
create policy "employer deletes own posts"
  on public.job_posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- 3) APPLICATIONS --------------------------------------------
create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  seeker_id      uuid not null references auth.users(id) on delete cascade,
  job_id         uuid references public.job_posts(id) on delete set null,
  job_title      text,          -- snapshot in case the post changes/deletes
  company        text,          -- snapshot
  seeker_name    text,
  seeker_email   text,
  seeker_phone   text,
  cv_url         text,
  message        text,
  status         text not null default 'submitted'  -- submitted | reviewed | shortlisted | rejected | hired
);

create index if not exists applications_seeker_idx  on public.applications (seeker_id, created_at desc);
create index if not exists applications_job_idx     on public.applications (job_id);
create index if not exists applications_status_idx  on public.applications (status);

-- Prevent a seeker applying to the same job twice
create unique index if not exists applications_unique_apply
  on public.applications (seeker_id, job_id);

alter table public.applications enable row level security;

-- A seeker may create their own application...
drop policy if exists "seeker inserts own application" on public.applications;
create policy "seeker inserts own application"
  on public.applications for insert
  to authenticated
  with check (auth.uid() = seeker_id);

-- ...and read their own applications (their history).
drop policy if exists "seeker reads own applications" on public.applications;
create policy "seeker reads own applications"
  on public.applications for select
  to authenticated
  using (auth.uid() = seeker_id);

-- An employer may read applications made to THEIR posts.
drop policy if exists "employer reads applications to own posts" on public.applications;
create policy "employer reads applications to own posts"
  on public.applications for select
  to authenticated
  using (exists (
    select 1 from public.job_posts p
    where p.id = applications.job_id and p.user_id = auth.uid()
  ));

-- 4) ADMIN ACCESS --------------------------------------------
-- An "admin" is any profile whose role = 'admin'. To make yourself an
-- admin AFTER signing up (and confirming your email), run in SQL editor:
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'Tbmadihlaba@gmail.com');
--
-- Helper that returns true when the current user is an admin.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Admin can read & update ALL applications (to manage statuses).
drop policy if exists "admin reads all applications" on public.applications;
create policy "admin reads all applications"
  on public.applications for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin updates all applications" on public.applications;
create policy "admin updates all applications"
  on public.applications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin deletes applications" on public.applications;
create policy "admin deletes applications"
  on public.applications for delete
  to authenticated
  using (public.is_admin());

-- Admin can read & manage ALL job posts (approve/decline etc.).
drop policy if exists "admin reads all posts" on public.job_posts;
create policy "admin reads all posts"
  on public.job_posts for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin updates all posts" on public.job_posts;
create policy "admin updates all posts"
  on public.job_posts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin deletes all posts" on public.job_posts;
create policy "admin deletes all posts"
  on public.job_posts for delete
  to authenticated
  using (public.is_admin());

-- Admin can read all profiles (to see who registered).
drop policy if exists "admin reads all profiles" on public.profiles;
create policy "admin reads all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- ============================================================
-- AFTER RUNNING: sign up your admin account on the site, confirm the
-- email, then run the UPDATE statement shown above to set role='admin'.
-- ============================================================
