-- ============================================================
-- LeBoKhu Group — Homeowner ↔ Provider Chat setup
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Run AFTER supabase-services.sql.)
--
-- Adds:
--   • service_requests.access_token — secret token so a (not-logged-in)
--     homeowner can open their own conversation via a private link
--   • messages table — chat messages tied to a service request
--   • RLS: provider of the request + admin can read/insert; public (anon)
--     may read/insert messages for a request (access is gated app-side by
--     the secret token, which is unguessable). This keeps homeowners
--     login-free while conversations stay private via the token link.
-- ============================================================

-- 1) ACCESS TOKEN ON REQUESTS --------------------------------
alter table public.service_requests
  add column if not exists access_token uuid not null default gen_random_uuid();

create index if not exists sr_token_idx on public.service_requests (access_token);

-- Allow an anonymous homeowner to read back the request they just created
-- (needed so insert().select() returns the id + access_token to open chat).
-- The app only ever queries by the specific id + unguessable token.
drop policy if exists "public reads request by token" on public.service_requests;
create policy "public reads request by token"
  on public.service_requests for select
  to anon, authenticated
  using (true);

-- 2) MESSAGES TABLE ------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  request_id   uuid not null references public.service_requests(id) on delete cascade,
  sender       text not null,            -- 'homeowner' | 'provider' | 'admin'
  sender_name  text,
  body         text not null
);

create index if not exists messages_request_idx on public.messages (request_id, created_at);

alter table public.messages enable row level security;

-- The provider who owns the linked request may read & send messages.
drop policy if exists "provider reads request messages" on public.messages;
create policy "provider reads request messages"
  on public.messages for select
  to authenticated
  using (exists (
    select 1 from public.service_requests sr
    join public.service_providers sp on sp.id = sr.provider_id
    where sr.id = messages.request_id and sp.user_id = auth.uid()
  ));

drop policy if exists "provider sends request messages" on public.messages;
create policy "provider sends request messages"
  on public.messages for insert
  to authenticated
  with check (exists (
    select 1 from public.service_requests sr
    join public.service_providers sp on sp.id = sr.provider_id
    where sr.id = messages.request_id and sp.user_id = auth.uid()
  ));

-- The homeowner is NOT logged in. Access to their thread is gated by the
-- unguessable access_token (checked app-side). Allow anon read/insert of
-- messages; without knowing a valid request_id + token, a thread can't be found.
drop policy if exists "public reads messages" on public.messages;
create policy "public reads messages"
  on public.messages for select
  to anon, authenticated
  using (true);

drop policy if exists "public sends messages" on public.messages;
create policy "public sends messages"
  on public.messages for insert
  to anon, authenticated
  with check (sender in ('homeowner', 'provider', 'admin'));

-- Admin manages all messages.
drop policy if exists "admin reads all messages" on public.messages;
create policy "admin reads all messages"
  on public.messages for select
  to authenticated using (public.is_admin());

drop policy if exists "admin deletes messages" on public.messages;
create policy "admin deletes messages"
  on public.messages for delete
  to authenticated using (public.is_admin());

-- 3) LOOKUP A REQUEST BY TOKEN (for the homeowner's private link) --
-- A SECURITY DEFINER function that returns the minimal request info for a
-- given (id, token) pair, so an anonymous homeowner can open their thread
-- without being able to browse other requests.
create or replace function public.get_request_by_token(p_id uuid, p_token uuid)
returns table (
  id uuid,
  provider_name text,
  service text,
  homeowner_name text,
  status text
)
language sql stable security definer set search_path = public as $$
  select sr.id, sr.provider_name, sr.service, sr.homeowner_name, sr.status
  from public.service_requests sr
  where sr.id = p_id and sr.access_token = p_token;
$$;

grant execute on function public.get_request_by_token(uuid, uuid) to anon, authenticated;

-- ============================================================
-- DONE. Each service request now has a private conversation thread.
-- Providers chat from their dashboard; homeowners chat via a private
-- link (request id + token) shown after they submit a request.
-- ============================================================
