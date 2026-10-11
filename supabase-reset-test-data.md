# Pre-Live Test-Data Reset — Full Wipe (keep admin only)

Gets LeKhuBo Connect to a **clean slate** for end-to-end testing before going live:
deletes **all app data and all non-admin accounts**, keeping only the admin account(s)
(`profiles.role = 'admin'`).

> ⚠️ **Destructive and irreversible.** Do a backup first:
> **Supabase Dashboard → Database → Backups** (take a manual snapshot).

---

## Why it's a two-part process

Your data lives in two schemas:

1. **`public.*` data tables** — job posts, applications, providers, requests, chats,
   reviews, gallery, legacy `job_seekers`. These are cleared by the **SQL script** (Part 1).
2. **`auth.users`** — the actual **login accounts** (seekers, homeowners, admin). This is a
   protected auth-schema table: a plain `DELETE` in the SQL Editor usually **won't** remove
   these rows. You remove them via the **Dashboard** or the **Admin API** (Part 2).

Because `public.profiles.id` references `auth.users(id)` **ON DELETE CASCADE**, deleting a
non-admin login account in Part 2 automatically removes its `profiles` row too.

---

## Part 1 — Wipe the data tables (SQL)

1. **Supabase Dashboard → SQL Editor → New query**.
2. Paste the whole of **`supabase-reset-test-data.sql`** and click **Run**.
3. Read the two result rows: **BEFORE** (counts now) and **AFTER** (should be all `0`
   except `profiles_total` / `profiles_admin`, which keep your admin).
4. The script has a built-in guard: if no admin profile would remain, it **aborts** and
   commits nothing. On success it `COMMIT`s. (To dry-run, change `COMMIT;` to `ROLLBACK;`.)

---

## Part 2 — Delete the non-admin login accounts (`auth.users`)

Pick ONE option.

### Option A — Dashboard (simplest, no keys)
1. **Authentication → Users**.
2. Sort/scan the list, select every account **except your admin**
   (`Tbmadihlaba@gmail.com`, or whichever account you set to `role='admin'`).
3. Delete the selected users. Their `profiles` rows cascade-delete automatically.

### Option B — Admin API script (if you have many test users)
Run locally with your **service_role** key (never put this key in the browser/front-end):

```bash
# Requires: Node 18+, @supabase/supabase-js
export SUPABASE_URL="https://efupodoraphybvzttrjj.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<your service_role key from Dashboard → Settings → API>"
export ADMIN_EMAIL="Tbmadihlaba@gmail.com"   # the account to KEEP
node delete-non-admin-users.mjs
```

`delete-non-admin-users.mjs`:
```js
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
const KEEP = (process.env.ADMIN_EMAIL || "").toLowerCase();

let page = 1, removed = 0, kept = 0;
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  const users = data.users;
  if (!users.length) break;
  for (const u of users) {
    if ((u.email || "").toLowerCase() === KEEP) { kept++; continue; }
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) console.error("Failed:", u.email, delErr.message);
    else { removed++; console.log("Deleted:", u.email); }
  }
  if (users.length < 1000) break;
  page++;
}
console.log(`Done. Removed ${removed}, kept ${kept} (admin).`);
```

> Prefer keeping by **role** instead of a hard-coded email? Query `public.profiles` for the
> admin id(s) first and skip those, rather than matching on `ADMIN_EMAIL`.

---

## Part 3 — Verify the clean slate

Back in the **SQL Editor**:

```sql
select
  (select count(*) from public.job_posts)        as job_posts,
  (select count(*) from public.applications)      as applications,
  (select count(*) from public.job_seekers)       as job_seekers,
  (select count(*) from public.service_providers) as service_providers,
  (select count(*) from public.service_requests)  as service_requests,
  (select count(*) from public.reviews)           as reviews,
  (select count(*) from public.messages)          as messages,
  (select count(*) from public.provider_gallery)  as provider_gallery,
  (select count(*) from public.profiles)          as profiles,
  (select count(*) from auth.users)               as auth_users;
```

Expected: everything `0` except `profiles` and `auth_users` = your admin count (usually `1`).

### (Optional) Storage buckets
Uploaded files are **not** in these tables. To also clear test uploads, empty the buckets
in **Storage**: `cvs`, `provider-photos`, `chat-media`, `provider-gallery`.

---

## After testing
When your end-to-end run is done and you're happy, you're live-ready. If you want a second
clean run, just repeat Parts 1–2.
