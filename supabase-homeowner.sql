-- ============================================================
-- LeBoKhu Group — Optional Homeowner accounts
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Run AFTER supabase-services.sql and supabase-chat.sql.)
--
-- Adds:
--   • service_requests.homeowner_id — links a request to a logged-in
--     homeowner (nullable; anonymous requests still work with null).
--   • RLS so a logged-in homeowner can read their OWN requests.
--   • A messages read policy so the homeowner can read messages on
--     requests they own (in addition to the token-based access).
-- ============================================================

alter table public.service_requests
  add column if not exists homeowner_id uuid references auth.users(id) on delete set null;

create index if not exists sr_homeowner_idx on public.service_requests (homeowner_id, created_at desc);

-- A logged-in homeowner may read requests they created.
drop policy if exists "homeowner reads own requests" on public.service_requests;
create policy "homeowner reads own requests"
  on public.service_requests for select
  to authenticated
  using (auth.uid() = homeowner_id);

-- A logged-in homeowner may update their own requests (e.g. mark closed).
drop policy if exists "homeowner updates own requests" on public.service_requests;
create policy "homeowner updates own requests"
  on public.service_requests for update
  to authenticated
  using (auth.uid() = homeowner_id)
  with check (auth.uid() = homeowner_id);

-- Logged-in homeowner may read messages on requests they own.
drop policy if exists "homeowner reads own request messages" on public.messages;
create policy "homeowner reads own request messages"
  on public.messages for select
  to authenticated
  using (exists (
    select 1 from public.service_requests sr
    where sr.id = messages.request_id and sr.homeowner_id = auth.uid()
  ));

-- Logged-in homeowner may send messages on requests they own.
drop policy if exists "homeowner sends own request messages" on public.messages;
create policy "homeowner sends own request messages"
  on public.messages for insert
  to authenticated
  with check (exists (
    select 1 from public.service_requests sr
    where sr.id = messages.request_id and sr.homeowner_id = auth.uid()
  ));

-- Logged-in homeowner may mark messages read on their own requests.
drop policy if exists "homeowner updates own request messages" on public.messages;
create policy "homeowner updates own request messages"
  on public.messages for update
  to authenticated
  using (exists (
    select 1 from public.service_requests sr
    where sr.id = messages.request_id and sr.homeowner_id = auth.uid()
  ))
  with check (true);

-- ============================================================
-- DONE. Homeowners can now (optionally) register; their requests and
-- chats are linked to their account and shown in "My Requests".
-- ============================================================
