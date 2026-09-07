-- ============================================================
-- LeBoKhu Group — Provider Portfolio Gallery
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Run AFTER supabase-services.sql.)
--
-- Adds:
--   • provider_gallery table — portfolio images for a provider's listing
--   • RLS: public reads; provider manages their own; admin manages all
--   • 'provider-gallery' public storage bucket
-- ============================================================

create table if not exists public.provider_gallery (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  provider_id  uuid not null references public.service_providers(id) on delete cascade,
  image_url    text not null,
  caption      text
);

create index if not exists gallery_provider_idx on public.provider_gallery (provider_id, created_at desc);

alter table public.provider_gallery enable row level security;

-- Anyone may READ gallery images (they show publicly on provider profiles).
drop policy if exists "public reads gallery" on public.provider_gallery;
create policy "public reads gallery"
  on public.provider_gallery for select
  to anon, authenticated
  using (true);

-- A provider may add images to THEIR OWN listing.
drop policy if exists "provider inserts own gallery" on public.provider_gallery;
create policy "provider inserts own gallery"
  on public.provider_gallery for insert
  to authenticated
  with check (exists (
    select 1 from public.service_providers sp
    where sp.id = provider_gallery.provider_id and sp.user_id = auth.uid()
  ));

-- A provider may delete their own gallery images.
drop policy if exists "provider deletes own gallery" on public.provider_gallery;
create policy "provider deletes own gallery"
  on public.provider_gallery for delete
  to authenticated
  using (exists (
    select 1 from public.service_providers sp
    where sp.id = provider_gallery.provider_id and sp.user_id = auth.uid()
  ));

-- Admin manages all gallery images.
drop policy if exists "admin manages gallery" on public.provider_gallery;
create policy "admin manages gallery"
  on public.provider_gallery for delete
  to authenticated using (public.is_admin());

-- Storage bucket for gallery images (public so they open via link).
insert into storage.buckets (id, name, public)
values ('provider-gallery', 'provider-gallery', true)
on conflict (id) do nothing;

drop policy if exists "public can upload gallery image" on storage.objects;
create policy "public can upload gallery image"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'provider-gallery');

drop policy if exists "public can read gallery image" on storage.objects;
create policy "public can read gallery image"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'provider-gallery');

-- ============================================================
-- DONE. Providers can now build a portfolio gallery on their listing,
-- shown to homeowners in the services directory.
-- ============================================================
