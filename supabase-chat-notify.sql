-- ============================================================
-- LeBoKhu Group — Chat unread tracking + notifications
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Run AFTER supabase-chat.sql.)
--
-- Adds:
--   • messages.read_by_provider  — false until the provider reads it
--   • messages.read_by_homeowner — false until the homeowner reads it
--   These let us show unread badges. Admin uses read_by_provider view too.
-- ============================================================

alter table public.messages
  add column if not exists read_by_provider  boolean not null default false,
  add column if not exists read_by_homeowner boolean not null default false;

-- Index to quickly count unread messages per request.
create index if not exists messages_unread_idx
  on public.messages (request_id, sender, read_by_provider, read_by_homeowner);

-- Allow the provider (owner of the request's listing) to UPDATE messages
-- on their requests (used to mark messages as read).
drop policy if exists "provider updates request messages" on public.messages;
create policy "provider updates request messages"
  on public.messages for update
  to authenticated
  using (exists (
    select 1 from public.service_requests sr
    join public.service_providers sp on sp.id = sr.provider_id
    where sr.id = messages.request_id and sp.user_id = auth.uid()
  ))
  with check (true);

-- Allow anon (homeowner via token link) to UPDATE messages (mark read).
-- Access is still gated app-side by the unguessable request/token.
drop policy if exists "public updates messages" on public.messages;
create policy "public updates messages"
  on public.messages for update
  to anon, authenticated
  using (true)
  with check (true);

-- Admin may update all messages too.
drop policy if exists "admin updates messages" on public.messages;
create policy "admin updates messages"
  on public.messages for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- DONE. Messages now track read status per side for unread badges.
-- ============================================================
