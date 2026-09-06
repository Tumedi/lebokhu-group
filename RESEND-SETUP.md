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
supabase secrets set APPROVAL_FROM="LeBoKhu Group <onboarding@resend.dev>"
supabase secrets set APPROVAL_BCC="Tbmadihlaba@gmail.com"
```
After you verify your domain in Resend, change `APPROVAL_FROM` to e.g.
`"LeBoKhu Group <jobs@lebokhugroup.co.za>"` for the best deliverability.

## Step 5 — Deploy the function
```bash
supabase functions deploy send-approval-email
```
The admin dashboard calls it with your logged-in session, so the default (JWT-verified)
deployment is fine. If you ever get an auth error from the function, you can redeploy with
`--no-verify-jwt`, but the default is more secure and should work since admins are logged in.

## Step 6 — Test it
1. Open your live **admin.html** → log in.
2. Go to **Job Posts** → **Approve** a post that has a real `contact_email` you can check.
3. You should see: *"a confirmation email was sent automatically to …"*.
4. Check that inbox (and Spam the first time). A BCC copy also goes to `Tbmadihlaba@gmail.com`.

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
