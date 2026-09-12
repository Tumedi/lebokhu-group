-- ============================================================
-- LeKhuBo Connect — make chat email bidirectional for the ANON homeowner page
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run.
-- (Run AFTER supabase-chat.sql.)
--
-- Adds the provider's email to get_request_by_token() so the standalone
-- homeowner chat page (chat.html?r=..&t=..) can notify the provider by email
-- when the homeowner sends a message. The email is only revealed for the
-- correct (request id + unguessable access_token) pair, so it is not browsable.
-- The logged-in homeowner dashboard (my-requests.html) already looks the email
-- up client-side and does NOT need this — this is only for the anon link page.
-- ============================================================

-- Drop first: Postgres cannot change a function's return columns via
-- CREATE OR REPLACE (error 42P13). Safe — it's only a function definition.
drop function if exists public.get_request_by_token(uuid, uuid);

create function public.get_request_by_token(p_id uuid, p_token uuid)
returns table (
  id uuid,
  provider_name text,
  service text,
  homeowner_name text,
  status text,
  provider_email text
)
language sql stable security definer set search_path = public as $$
  select sr.id, sr.provider_name, sr.service, sr.homeowner_name, sr.status,
         sp.email as provider_email
  from public.service_requests sr
  left join public.service_providers sp on sp.id = sr.provider_id
  where sr.id = p_id and sr.access_token = p_token;
$$;

grant execute on function public.get_request_by_token(uuid, uuid) to anon, authenticated;

-- ============================================================
-- DONE. The anon homeowner chat link can now email the provider on new messages.
-- ============================================================
