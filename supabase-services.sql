-- ============================================================
-- LeBoKhu Group — Home Services Marketplace setup
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Copy everything BELOW this comment block.)
--
-- Adds:
--   • service_providers — a worker's listing (trade, area, rate, contact, status)
--   • service_requests  — a homeowner's enquiry for a service
--   • RLS: public reads APPROVED providers; providers manage their own;
--          anyone may submit a request; admin manages everything.
--
-- Requires supabase-auth.sql to have been run first (uses profiles/is_admin()).
-- ============================================================

-- 1) SERVICE PROVIDERS ---------------------------------------
create table if not exists public.service_providers (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid references auth.users(id) on delete set null,
  full_name     text not null,
  service       text not null,          -- e.g. Painting, Plumbing, Gardening
  location      text,                    -- area they serve
  phone         text,
  email         text,
  whatsapp      text,
  rate          text,                    -- e.g. "From R250/day" or "Per quote"
  experience    text,                    -- e.g. "5 years"
  bio           text,                    -- short description of services
  status        text not null default 'pending'  -- pending | approved | rejected
);

create index if not exists sp_status_idx   on public.service_providers (status);
create index if not exists sp_service_idx   on public.service_providers (service);
create index if not exists sp_location_idx  on public.service_providers (location);
create index if not exists sp_user_idx      on public.service_providers (user_id);

alter table public.service_providers enable row level security;

-- Public may READ only APPROVED providers (directory).
drop policy if exists "public reads approved providers" on public.service_providers;
create policy "public reads approved providers"
  on public.service_providers for select
  to anon, authenticated
  using (status = 'approved');

-- A logged-in provider may create their own listing.
drop policy if exists "provider inserts own listing" on public.service_providers;
create policy "provider inserts own listing"
  on public.service_providers for insert
  to authenticated
  with check (auth.uid() = user_id);

-- A provider may read & update & delete their own listing (any status).
drop policy if exists "provider reads own listing" on public.service_providers;
create policy "provider reads own listing"
  on public.service_providers for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "provider updates own listing" on public.service_providers;
create policy "provider updates own listing"
  on public.service_providers for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "provider deletes own listing" on public.service_providers;
create policy "provider deletes own listing"
  on public.service_providers for delete
  to authenticated
  using (auth.uid() = user_id);

-- Admin manages ALL providers.
drop policy if exists "admin reads all providers" on public.service_providers;
create policy "admin reads all providers"
  on public.service_providers for select
  to authenticated using (public.is_admin());

drop policy if exists "admin updates all providers" on public.service_providers;
create policy "admin updates all providers"
  on public.service_providers for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin deletes all providers" on public.service_providers;
create policy "admin deletes all providers"
  on public.service_providers for delete
  to authenticated using (public.is_admin());

-- 2) SERVICE REQUESTS (homeowner enquiries) ------------------
create table if not exists public.service_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  provider_id    uuid references public.service_providers(id) on delete set null,
  provider_name  text,          -- snapshot
  service        text,          -- snapshot / requested service
  homeowner_name text not null,
  homeowner_email text,
  homeowner_phone text not null,
  location       text,
  details        text,
  status         text not null default 'new'   -- new | contacted | completed | closed
);

create index if not exists sr_created_idx  on public.service_requests (created_at desc);
create index if not exists sr_provider_idx on public.service_requests (provider_id);
create index if not exists sr_status_idx   on public.service_requests (status);

alter table public.service_requests enable row level security;

-- Anyone (a homeowner, not logged in) may SUBMIT a request.
drop policy if exists "public submits service request" on public.service_requests;
create policy "public submits service request"
  on public.service_requests for insert
  to anon, authenticated
  with check (true);

-- A provider may read requests directed at THEIR listing.
drop policy if exists "provider reads own requests" on public.service_requests;
create policy "provider reads own requests"
  on public.service_requests for select
  to authenticated
  using (exists (
    select 1 from public.service_providers p
    where p.id = service_requests.provider_id and p.user_id = auth.uid()
  ));

-- Admin manages ALL requests.
drop policy if exists "admin reads all requests" on public.service_requests;
create policy "admin reads all requests"
  on public.service_requests for select
  to authenticated using (public.is_admin());

drop policy if exists "admin updates all requests" on public.service_requests;
create policy "admin updates all requests"
  on public.service_requests for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin deletes all requests" on public.service_requests;
create policy "admin deletes all requests"
  on public.service_requests for delete
  to authenticated using (public.is_admin());

-- ============================================================
-- DONE. Providers sign up (role 'provider'), list a service (pending),
-- you approve it in admin, and it appears in the public directory.
-- ============================================================
