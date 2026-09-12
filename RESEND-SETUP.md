# Automatic Approval Emails — Resend + Supabase Edge Function

When you click **Approve** on a job post in the admin dashboard, the employer is emailed
**automatically** (no clicks). This is powered by [Resend](https://resend.com) (free tier:
3,000 emails/month) via a secure **Supabase Edge Function** that keeps your API key secret.

> If this isn't set up yet, the site still works — approving a post falls back to opening a
> pre-filled email in your own mail app.

---

## Step 1 — Create a Resend account & API key
1. Sign up free at **[resend.com](https://resend.com)**.
2. Go to **API Keys → Create API Key** → copy it (looks like `re_xxxxxxxx`). Save it somewhere safe.
3. (Optional but recommended) Go to **Domains** and verify `lebokhugroup.co.za` so emails come
   **from your own domain**. Until you do, use Resend's test sender `onboarding@resend.dev`
   (works immediately, but some inboxes mark it as "via resend.dev").

## Step 2 — Install the Supabase CLI
On your computer (one-time):
- **macOS:** `brew install supabase/tap/supabase`
- **Windows (Scoop):** `scoop install supabase`
- **npm (any OS):** `npm install -g supabase`
- Docs: https://supabase.com/docs/guides/cli

## Step 3 — Log in & link your project
Run these in the folder that contains the `supabase/` directory (this repo):
```bash
supabase login                       # opens the browser to authenticate
supabase link --project-ref efupodoraphybvzttrjj
```
(`efupodoraphybvzttrjj` is your project ref — from your Supabase URL.)

## Step 4 — Set the secrets
```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
# Optional overrides (defaults shown):
supabase secrets set APPROVAL_FROM="LeKhuBo Connect <onboarding@resend.dev>"
supabase secrets set APPROVAL_BCC="Tbmadihlaba@gmail.com"
```
After you verify your domain in Resend, change `APPROVAL_FROM` to e.g.
`"LeKhuBo Connect <jobs@lebokhugroup.co.za>"` for the best deliverability.

## Step 5 — Deploy the functions
There are **two** functions:

```bash
# 1) Employer approval email (called by the logged-in admin)
supabase functions deploy send-approval-email

# 1b) Employer declined email (also called by the logged-in admin)
supabase functions deploy send-declined-email

# 1c) Candidate-match email (also called by the logged-in admin)
supabase functions deploy send-match-email

# 1d) Application status-change email (also called by the logged-in admin)
supabase functions deploy send-status-email

# 1e) Provider-listing-approved email (also called by the logged-in admin)
supabase functions deploy send-provider-approved

# 2) Job-seeker welcome email (called by anonymous visitors registering)
#    Must allow public/anonymous calls, so deploy WITHOUT jwt verification:
supabase functions deploy send-welcome-email --no-verify-jwt

# 3) Employer "post received" email (called by anonymous visitors posting a job)
#    Also public/anonymous, so deploy WITHOUT jwt verification:
supabase functions deploy send-post-received-email --no-verify-jwt

# 4) Service request email (called by anonymous homeowners requesting a service)
#    Also public/anonymous, so deploy WITHOUT jwt verification:
supabase functions deploy send-service-request-email --no-verify-jwt

# 5) Chat new-message notification (called by anonymous homeowners + providers)
#    Also public/anonymous, so deploy WITHOUT jwt verification:
supabase functions deploy send-chat-notification --no-verify-jwt
```

Why the difference? The **admin** is logged in, so `send-approval-email` can keep JWT
verification on. But **job seekers and employers submit without logging in**, so
`send-welcome-email` and `send-post-received-email` must be deployed with `--no-verify-jwt`
or the browser call will be rejected.

Optional sender overrides (defaults shown):
```bash
supabase secrets set WELCOME_FROM="LeKhuBo Connect <onboarding@resend.dev>"
supabase secrets set WELCOME_BCC="Tbmadihlaba@gmail.com"
supabase secrets set POST_RECEIVED_FROM="LeKhuBo Connect <onboarding@resend.dev>"
supabase secrets set POST_RECEIVED_BCC="Tbmadihlaba@gmail.com"
```

## Step 6 — Test it
**Approval email (employer):**
1. Open your live **admin.html** → log in.
2. Go to **Job Posts** → **Approve** a post that has a real `contact_email` you can check.
3. You should see: *"a confirmation email was sent automatically to …"*.
4. Check that inbox (and Spam the first time). A BCC copy also goes to `Tbmadihlaba@gmail.com`.

**Welcome email (job seeker):**
1. Open **register.html** → submit a registration using a real email you can check.
2. That inbox should receive a "Thanks for registering" email shortly after.
3. A BCC copy also goes to `Tbmadihlaba@gmail.com`.
(If `send-welcome-email` isn't deployed, registration still works — the welcome email is just skipped.)

**Post-received email (employer):**
1. Open **post-job.html** → submit a job post using a real email you can check.
2. That inbox should receive a "We've received your job post" email shortly after.
3. A BCC copy also goes to `Tbmadihlaba@gmail.com`.
(If `send-post-received-email` isn't deployed, posting still works — the email is just skipped.)

---

## Troubleshooting
- **"Automatic email is not available yet"** → the function isn't deployed, or the secret is
  missing. Re-check Steps 4–5. (The mailto fallback will still let you send manually.)
- **Function returns a Resend error** → usually the `from` address isn't allowed. Use
  `onboarding@resend.dev` until your domain is verified, or verify the domain in Resend.
- **View logs:** `supabase functions logs send-approval-email` (or in the Supabase dashboard →
  Edge Functions → Logs).

## What the function sends
A branded HTML email to the employer confirming their post is approved and live, including the
job details, with `reply-to` set to `Tbmadihlaba@gmail.com` so replies reach you.


---

# Auth Confirmation & Password-Reset Emails (Custom SMTP via Resend)

The **Edge Functions above** handle *app* emails (approvals, welcome, etc.). But the
**account confirmation email** and **password-reset email** are sent by **Supabase Auth
itself**, NOT by your code — so they are controlled by Supabase's email settings, not by any
Edge Function.

## Symptom
- A user signs up and sees *"Account created! Please check your email…"* (this means the
  account WAS created in `auth.users` and is waiting for confirmation).
- ...but **no confirmation email ever arrives.**

## Cause
Supabase's **built-in email service is heavily rate-limited (only a few per hour) and is not
meant for production** — it frequently drops messages or lands them in spam. This is the
default until you configure Custom SMTP.

## Fix — point Supabase Auth at your Resend account
Because the domain `lebokhu-group.co.za` is already verified in Resend, use it for auth emails too.

1. **Supabase Dashboard → Authentication → Emails → SMTP Settings** → enable **Custom SMTP**:

   | Field | Value |
   |-------|-------|
   | Host | `smtp.resend.com` |
   | Port | `465` (SSL) or `587` (TLS) |
   | Username | `resend` |
   | Password | your Resend API key (`re_...`) |
   | Sender email | `no-reply@lebokhu-group.co.za` |
   | Sender name | `LeKhuBo Connect` |

2. **Authentication → URL Configuration:**
   - **Site URL:** `https://tumedi.github.io/lebokhu-group/`
   - **Redirect URLs (allow-list):** add
     `https://tumedi.github.io/lebokhu-group/login.html`
     and `https://tumedi.github.io/lebokhu-group/reset-password.html`

3. **Authentication → Providers → Email:** confirm **"Confirm email"** is ON (if you want
   confirmation) and **"Allow new users to sign up"** is ON.

4. Save, then do a fresh test signup — or use the **"Resend confirmation"** link now on the
   signup and login pages.

## Note on where signup accounts live
Accounts created via **signup.html** live in **`auth.users`** + **`public.profiles`** — they do
**NOT** appear in the admin **"Job Seekers"** tab, which reads the separate legacy
**`job_seekers`** table (filled only by `register.html`). Use **Authentication → Users** or
`supabase-verify.sql` (queries 0 / 0b) to see signup accounts.
