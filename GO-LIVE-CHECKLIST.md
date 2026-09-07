# 🚀 LeKhuBo Connect — Go-Live Checklist

Work through this top to bottom. Tick each box as you go. Most of it is one-time setup.

- **Live site:** https://tumedi.github.io/lebokhu-group/
- **Repo:** https://github.com/Tumedi/lebokhu-group
- **Admin email:** Tbmadihlaba@gmail.com
- **Supabase project ref:** `efupodoraphybvzttrjj`
- **Sending domain:** `lebokhu-group.co.za` (verified in Resend ✅)

> How to run SQL: Supabase → **SQL Editor → New query** → paste the file's contents → **Run**.
> Remember: paste the **contents** of each `.sql` file, not the filename.

---

## 1) Database — run the SQL files IN THIS ORDER
Each is safe to run once. If a later file errors about a missing table/function, an earlier
file wasn't run yet.

- [ ] `supabase-setup.sql` — job seekers table + CV storage bucket
- [ ] `supabase-job-posts.sql` — employer job posts table
- [ ] `supabase-auth.sql` — accounts: profiles, applications, roles, `is_admin()`
- [ ] `supabase-services.sql` — service providers + service requests
- [ ] `supabase-services-enhance.sql` — provider photos, star ratings, reviews
- [ ] `supabase-chat.sql` — messages table + private chat token
- [ ] `supabase-chat-notify.sql` — chat read-tracking (unread badges)
- [ ] `supabase-chat-media.sql` — chat image sharing + location (chat-media bucket)
- [ ] `supabase-portfolio.sql` — provider portfolio gallery (provider-gallery bucket)
- [ ] `supabase-homeowner.sql` — optional homeowner accounts (saved requests + chats)

✅ After each: you should see **"Success. No rows returned."**

---

## 2) Make yourself the admin
1. [ ] Sign up on the live site (`signup.html`) using **Tbmadihlaba@gmail.com** (any role)
2. [ ] Click the confirmation link in your email
3. [ ] In Supabase **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'Tbmadihlaba@gmail.com');
   ```
   ✅ Expected: **"Success. Rows returned: 1"**

---

## 3) Supabase Auth settings
- [ ] **Authentication → URL Configuration**
  - **Site URL:** `https://tumedi.github.io/lebokhu-group/`
  - **Redirect URLs:** add `https://tumedi.github.io/lebokhu-group/**`
    (covers login, password reset, and email confirmation redirects)
- [ ] **Authentication → Providers → Email:** keep **Confirm email = ON** (recommended)

---

## 4) Email — deploy the Edge Functions (Supabase CLI)
Run in a terminal from the project folder (after `supabase login` + `supabase link --project-ref efupodoraphybvzttrjj`).

**Set the shared Resend key once (if not already):**
```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
```

**Admin-triggered emails (keep JWT on):**
- [ ] `supabase functions deploy send-approval-email`
- [ ] `supabase functions deploy send-declined-email`
- [ ] `supabase functions deploy send-match-email`
- [ ] `supabase functions deploy send-status-email`
- [ ] `supabase functions deploy send-provider-approved`

**Public/anonymous emails (must use `--no-verify-jwt`):**
- [ ] `supabase functions deploy send-welcome-email --no-verify-jwt`
- [ ] `supabase functions deploy send-post-received-email --no-verify-jwt`
- [ ] `supabase functions deploy send-service-request-email --no-verify-jwt`
- [ ] `supabase functions deploy send-chat-notification --no-verify-jwt`

**Point all emails at your verified domain (optional but recommended):**
```bash
supabase secrets set APPROVAL_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
supabase secrets set DECLINED_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
supabase secrets set MATCH_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
supabase secrets set STATUS_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
supabase secrets set PROVIDER_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
supabase secrets set WELCOME_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
supabase secrets set POST_RECEIVED_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
supabase secrets set SERVICE_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
supabase secrets set CHAT_FROM="LeKhuBo Connect <jobs@lebokhu-group.co.za>"
```

---

## 5) Hosting (already done ✅)
- [x] GitHub Pages is enabled → site is live at the URL above.
  (Whenever code is pushed, GitHub Pages redeploys automatically in ~1 minute.)

---

## 6) End-to-end test (do this last)
- [ ] **Register** as a job seeker (register.html) → welcome email arrives
- [ ] **Sign up** as an employer → **Post a Job** → it appears in admin (pending) → **Approve** → shows on Jobs page
- [ ] **Apply** for a job as a seeker → appears in admin **Applications** → change status → seeker sees it + gets email
- [ ] **Sign up** as a Service Provider → **List a service** (with photo) → appears in admin (pending) → **Approve** → shows in the directory + provider gets email
- [ ] As a **homeowner** (no login) → **Request a service** → chat opens → send a message
- [ ] **Provider** logs in → sees unread badge → replies → homeowner gets a notification email
- [ ] Leave a **review** on a provider → stars update; moderate it in admin **Reviews**

---

## Quick reference — what each piece powers
| Area | SQL | Function(s) |
|------|-----|-------------|
| Jobs board | setup, job-posts | send-post-received, send-approval, send-declined, send-match, send-status |
| Accounts | auth | send-welcome |
| Services | services, services-enhance | send-provider-approved, send-service-request |
| Chat | chat, chat-notify | send-chat-notification |

## Notes
- If an email doesn't arrive: check the recipient's **Spam** folder the first time.
- To view a function's logs: `supabase functions logs <name>`.
- Admin dashboard is at **`/admin.html`** (also linked in the site footer).
