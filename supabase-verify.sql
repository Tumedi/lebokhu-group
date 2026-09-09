-- ============================================================
-- LeKhuBo Connect — Verification queries
-- Run these in Supabase → SQL Editor → New query.
-- These are READ-ONLY checks (except the clearly-marked
-- "PROMOTE" block at the bottom, which you edit + run manually).
-- ============================================================

-- ------------------------------------------------------------
-- 1) WHO IS AN ADMIN?
--    Lists every profile whose role = 'admin', with the email
--    from auth.users so you can recognise the account.
--    Expect: only YOUR account(s). If this returns 0 rows,
--    nobody can use the admin dashboard yet (see block 4 to fix).
-- ------------------------------------------------------------
select p.id,
       u.email,
       p.role,
       p.full_name,
       p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin'
order by p.created_at;

-- ------------------------------------------------------------
-- 2) ROLE BREAKDOWN
--    Sanity check on how many accounts have each role.
--    Watch for surprises (e.g. more than 1-2 admins).
-- ------------------------------------------------------------
select coalesce(role, '(null)') as role, count(*) as accounts
from public.profiles
group by role
order by accounts desc;

-- ------------------------------------------------------------
-- 3) ALL ACCOUNTS AT A GLANCE
--    Every auth user + their profile role. Useful to spot any
--    auth user with NO profile row (role shows as (no profile)).
-- ------------------------------------------------------------
select u.email,
       coalesce(p.role, '(no profile row)') as role,
       u.created_at as signed_up
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;

-- ------------------------------------------------------------
-- 4) CONFIRM is_admin() EXISTS AND IS DEFINED CORRECTLY
--    Should return the function body checking role = 'admin'.
-- ------------------------------------------------------------
select pg_get_functiondef('public.is_admin()'::regprocedure);

-- ============================================================
-- PROMOTE AN ACCOUNT TO ADMIN  (edit + run ONLY when needed)
-- Replace the email, then uncomment and run.
-- ============================================================
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'Tbmadihlaba@gmail.com');

-- To DEMOTE an accidental admin back to a normal role:
-- update public.profiles
-- set role = 'homeowner'   -- or 'seeker' / 'employer' / 'provider'
-- where id = (select id from auth.users where email = 'someone@example.com');
