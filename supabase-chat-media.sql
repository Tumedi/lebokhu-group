-- ============================================================
-- LeBoKhu Group — Chat media (images) + location sharing
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Run AFTER supabase-chat.sql.)
--
-- Adds:
--   • messages.attachment_url  — public URL of an uploaded image (optional)
--   • messages.attachment_type — 'image' | 'location' | null
--   For 'location' messages, body holds the map URL / coordinates text.
--   • 'chat-media' public storage bucket for shared images.
-- ============================================================

alter table public.messages
  add column if not exists attachment_url  text,
  add column if not exists attachment_type text;   -- 'image' | 'location'

-- Storage bucket for chat images (public so shared pics open via link;
-- filenames are randomised by the app so they aren't guessable).
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists "public can upload chat media" on storage.objects;
create policy "public can upload chat media"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'chat-media');

drop policy if exists "public can read chat media" on storage.objects;
create policy "public can read chat media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'chat-media');

-- ============================================================
-- DONE. Chat messages can now carry an image or a shared location.
-- ============================================================
