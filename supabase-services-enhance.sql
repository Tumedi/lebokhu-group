-- ============================================================
-- LeBoKhu Group — Services Marketplace enhancements
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run
-- (Run AFTER supabase-services.sql.)
--
-- Adds:
--   • service_providers.photo_url    — profile photo
--   • service_providers.rating_avg   — average star rating (auto-maintained)
--   • service_providers.rating_count — number of reviews (auto-maintained)
--   • reviews table                  — homeowner star ratings + comments
--   • trigger to keep rating_avg / rating_count up to date
--   • 'provider-photos' public storage bucket
-- ============================================================

-- 1) NEW COLUMNS ON PROVIDERS --------------------------------
alter table public.service_providers
  add column if not exists photo_url    text,
  add column if not exists rating_avg   numeric(3,2) not null default 0,
  add column if not exists rating_count integer      not null default 0;

-- 2) REVIEWS TABLE -------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  provider_id   uuid not null references public.service_providers(id) on delete cascade,
  rating        integer not null check (rating between 1 and 5),
  reviewer_name text,
  comment       text
);

create index if not exists reviews_provider_idx on public.reviews (provider_id, created_at desc);

alter table public.reviews enable row level security;

-- Anyone may READ reviews (they show publicly on provider cards).
drop policy if exists "public reads reviews" on public.reviews;
create policy "public reads reviews"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- Anyone (a homeowner, not logged in) may SUBMIT a review.
drop policy if exists "public submits review" on public.reviews;
create policy "public submits review"
  on public.reviews for insert
  to anon, authenticated
  with check (rating between 1 and 5);

-- Admin may manage reviews (moderation).
drop policy if exists "admin manages reviews" on public.reviews;
create policy "admin manages reviews"
  on public.reviews for delete
  to authenticated
  using (public.is_admin());

-- 3) AUTO-MAINTAIN AVERAGE RATING ----------------------------
create or replace function public.refresh_provider_rating(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.service_providers sp
  set rating_avg = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.provider_id = p_id), 0),
      rating_count = (select count(*) from public.reviews r where r.provider_id = p_id)
  where sp.id = p_id;
end; $$;

create or replace function public.on_review_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (TG_OP = 'DELETE') then
    perform public.refresh_provider_rating(old.provider_id);
    return old;
  else
    perform public.refresh_provider_rating(new.provider_id);
    return new;
  end if;
end; $$;

drop trigger if exists trg_review_change on public.reviews;
create trigger trg_review_change
  after insert or update or delete on public.reviews
  for each row execute function public.on_review_change();

-- 4) STORAGE BUCKET FOR PROVIDER PHOTOS ----------------------
insert into storage.buckets (id, name, public)
values ('provider-photos', 'provider-photos', true)
on conflict (id) do nothing;

drop policy if exists "public can upload provider photo" on storage.objects;
create policy "public can upload provider photo"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'provider-photos');

drop policy if exists "public can read provider photo" on storage.objects;
create policy "public can read provider photo"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'provider-photos');

-- ============================================================
-- DONE. Providers can now upload a photo; homeowners can leave
-- star ratings; the provider's average rating updates automatically.
-- ============================================================
