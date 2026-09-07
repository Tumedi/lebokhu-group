# LeBoKhu Group — Business Website

**Connecting People, Resources & Opportunity.**

A responsive, single-page business website for LeBoKhu Group — a 100% black youth-owned
South African resourcing & recruitment company that outsources resources for companies and
connects job seekers (qualified or not) with job opportunities.

## Structure
```
site/
├── index.html          # Home (all main sections + contact form)
├── jobs.html           # Job listings board (searchable/filterable)
├── register.html       # Job-seeker registration / application form
├── css/styles.css      # Styles (brand palette, responsive, animations)
├── js/
│   ├── main.js         # Nav, scroll reveals, counters, contact form
│   ├── jobs.js         # Job data + filtering + apply modal
│   └── register.js     # Registration form (role pre-fill + submit)
└── assets/
    ├── logo.svg        # Logo (dark text — light backgrounds)
    ├── logo-white.svg  # Logo (white text — dark nav/footer)
    └── favicon.svg     # Browser tab icon
```

## Make the forms send real emails (Formspree — free)
Both the **contact form** (`index.html`) and **registration form** (`register.html`) are
wired for [Formspree](https://formspree.io) but need your endpoint:
1. Sign up free at formspree.io using your business email.
2. Create a form → copy the endpoint, e.g. `https://formspree.io/f/abcdwxyz`.
3. In `index.html` and `register.html`, replace `https://formspree.io/f/YOUR_FORM_ID`
   with your real endpoint (in the `<form action="...">`).
Until then, the forms validate and show a success message but don't deliver email.

## Editing job listings
Open `js/jobs.js` and edit the `JOBS` array — each entry has title, sector, level,
location, type, posted date and description. The "Apply" button carries the job title
into the registration form via `register.html?role=...`.

## Sections
Hero · Motto strip · About & Mission · Services (6) · For Job Seekers ·
For Companies · Impact (youth unemployment) · Founder story · Contact form · Footer

## Preview it locally
No build step needed — it's plain HTML/CSS/JS. Open `index.html` directly in a browser,
or serve the folder:

```bash
# Python
cd site && python3 -m http.server 8080
# then visit http://localhost:8080

# or Node
cd site && npx serve .
```

## Deploy it (free options)
- **Netlify / Vercel:** drag-and-drop the `site` folder, or connect a Git repo.
- **GitHub Pages:** push `site/` to a repo and enable Pages.
- **Any web host:** upload the contents of `site/` via FTP.

## Brand
| Color | Hex | Meaning |
|-------|-----|---------|
| Gold  | `#E4A020` | Opportunity / prosperity (*Khumo*) |
| Teal  | `#0C6B57` | People / community (*Leago*) |
| Ink   | `#0B2038` | Wisdom / trust (*Bohlale*) |

## Notes / next steps
- **Contact form** is currently front-end only (validates and shows a success message).
  To receive submissions, connect it to a form service (e.g. Formspree, Getform) or a
  small backend endpoint. Ask and I can wire this up.
- Update the placeholder **email, phone and address** in `index.html` (Contact + Footer).
- Optionally add: real founder photo, testimonials, a blog, or a job-listings page.


## 📱 Mobile App (PWA)

This site is a **Progressive Web App** — it can be installed on phones and desktops
and works offline.

### Files that make it an app
- `manifest.webmanifest` — app name, icons, colours, launch behaviour
- `sw.js` — service worker (offline caching of the app shell)
- `js/pwa.js` — registers the service worker + shows the "Install App" button
- `assets/icon-192.svg`, `icon-512.svg`, `icon-maskable.svg` — app icons

### How users install it
**Android (Chrome/Edge):** open the site → tap the **"Install App"** button (or
browser menu ⋮ → *Install app / Add to Home screen*). It launches full-screen with
the LeBoKhu icon.

**iPhone/iPad (Safari):** open the site → tap **Share** → **Add to Home Screen**.
(iOS doesn't support the automatic install button, so this manual step is normal.)

**Desktop (Chrome/Edge):** an install icon appears in the address bar.

> PWAs require **HTTPS**. GitHub Pages provides HTTPS automatically, so installation
> works once the site is deployed there (it won't install over plain `file://`).

### Publishing to the Google Play Store (optional, later)
The same PWA can be packaged into a real Android app without rewriting anything:
1. Use **[PWABuilder](https://www.pwabuilder.com)** — paste your live URL, it generates
   a signed Android package (via Trusted Web Activity / Bubblewrap).
2. Create a **Google Play Developer** account (one-time ~$25) and upload the package.
Apple's App Store is stricter about PWAs; a Capacitor wrapper is the usual route there
— ask and I can set that up.


## 🗄️ Database, CV storage & Admin Dashboard (Supabase)

Registrations are saved to a **Supabase** database (with CVs in Supabase Storage), and you
also receive an **email alert** per registration via Web3Forms. A password-protected
**Admin Dashboard** (`admin.html`) lets you view, search, filter and export the data.

### One-time setup
1. **Create a project** at [supabase.com](https://supabase.com) (free). Pick a region near South Africa.
2. **Create the database + storage + rules:** open **SQL Editor → New query**, paste the
   contents of [`supabase-setup.sql`](supabase-setup.sql), and click **Run**.
3. **Create your admin login:** Dashboard → **Authentication → Users → Add user** →
   email `Tbmadihlaba@gmail.com` + a strong password. (This is your dashboard login.)
4. **Get your keys:** Dashboard → **Project Settings → API** → copy the **Project URL** and
   the **anon public** key.
5. **Add the keys to the site:** open `js/supabase-config.js` and replace:
   - `SUPABASE_URL_PLACEHOLDER` → your Project URL
   - `SUPABASE_ANON_KEY_PLACEHOLDER` → your anon public key
   (The anon key is safe in frontend code; security is enforced by the RLS rules in the SQL.)

### Using the dashboard
- Go to **`/admin.html`** on your site and log in with the admin email/password.
- **Stat cards:** total registrations, CVs uploaded, last 7 / 30 days.
- **Breakdowns:** by sector, qualification, experience and location.
- **Search & filter**, then **📥 Export CSV** (opens in Excel) — export respects the current filters.
- Each row has a **Download** link for the applicant's CV.

### How data flows on submit
1. CV (if any) → uploaded to Supabase Storage (`cvs` bucket)
2. All fields (+ CV link) → saved as a row in the `job_seekers` table  ← source of truth
3. Web3Forms → sends you an **email alert** (with the CV attached)

Each step degrades gracefully: if Supabase keys aren't set yet, the email alert still works;
if email hiccups, the database record is still saved.


## 💼 Employer Job Posts

Employers can submit job openings via **`post-job.html`**. Each submission is:
1. Saved to the Supabase **`job_posts`** table with `status = 'pending'`
2. Emailed to you as an alert (Web3Forms)

### One-time setup
Run **`supabase-job-posts.sql`** in the Supabase SQL Editor (same way as the main setup:
open the file, copy its contents, paste into SQL Editor → Run). It creates the `job_posts`
table and security rules so:
- the public can **submit** posts and **read only approved** ones,
- only you (logged in) can **read all / approve / edit / delete**.

### Managing posts (admin)
Open **`admin.html`** → **💼 Job Posts** tab:
- Stat cards: total, pending review, approved (live), last 30 days
- Search + filter by status / sector / level / location
- Per-row actions: **Approve**, **Close**, **Set pending**, **Delete**
- **Export CSV** (respects filters)

Posts marked **approved** are the ones your public Jobs page is allowed to read (handy if you
later want the Jobs page to show live employer posts instead of the sample list — ask and I can
wire that up).


## 🔐 User Accounts (Supabase Auth)

Only registered users can post or apply for jobs. Two roles:
- **Job Seeker** — applies for jobs, sees application history at `my-applications.html`
- **Employer** — posts jobs, manages them at `my-posts.html`

### One-time setup
1. **Run the SQL:** open `supabase-auth.sql`, copy its contents into Supabase → SQL Editor → Run.
   (Creates `profiles`, `applications`, adds `job_posts.user_id`, RLS, and the auto-profile trigger.)
2. **Email confirmation:** in Supabase → **Authentication → Providers → Email**, keep
   "Confirm email" ON (recommended). Users must click the link in their email before logging in.
3. **Allowed URLs:** Supabase → **Authentication → URL Configuration** → set **Site URL** to
   `https://tumedi.github.io/lebokhu-group/` and add it to **Redirect URLs**.
4. **Make yourself admin:** sign up on the site (as anything), confirm your email, then run in SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'Tbmadihlaba@gmail.com');
   ```
   This lets your admin dashboard see & manage ALL applications and posts.

### Pages
| Page | Who | Purpose |
|------|-----|---------|
| `signup.html` | anyone | Create account (choose Seeker / Employer) |
| `login.html` | anyone | Log in (+ forgot password) |
| `jobs.html` | public | Browse jobs; **Apply** requires seeker login |
| `my-applications.html` | seeker | Application history + statuses |
| `post-job.html` | employer | Post a job (login required) |
| `my-posts.html` | employer | Manage own posts + applicant counts |
| `admin.html` | admin | Seekers / Job Posts / **Applications** (set statuses) |

### Application statuses
`submitted → reviewed → shortlisted → rejected → hired` — the admin sets these on the
**Applications** tab, and each seeker sees the current status on their dashboard.


## 🛠️ Home Services Marketplace

Alongside jobs, the site has a **home-services directory** — painters, plumbers, gardeners,
domestic workers, electricians and more — that homeowners can search and contact.

### One-time setup
Run **`supabase-services.sql`** in Supabase → SQL Editor (after `supabase-auth.sql`, since it
uses `is_admin()`). Creates `service_providers` + `service_requests` with RLS.

### How it works
| Who | Page | What |
|-----|------|------|
| Service provider | `signup.html` (role **Service Provider**) → `list-service.html` | Lists their service (goes **pending**) |
| Homeowner | `services-directory.html` | Searches by service + area, contacts provider or **Requests a Service** (no login needed) |
| Provider | `my-services.html` | Sees their listing status + incoming requests |
| Admin | `admin.html` → **Service Providers** / **Service Requests** tabs | Approve/reject providers; manage request statuses |

- Providers appear in the public directory only once **approved** by the admin.
- Homeowner requests save to the DB and trigger an email (via `send-service-request-email`)
  to you and, if known, the provider.

### Service categories
Painting · Plumbing · Gardening · Domestic Work/Cleaning · Electrical · Handyman ·
Moving/Transport · Tiling · Carpentry · Security/Fencing · Other

### Deploy the services email function
```bash
supabase functions deploy send-service-request-email --no-verify-jwt
```
(Homeowners submit without logging in, so this one needs `--no-verify-jwt`.)


## 💬 Homeowner ↔ Provider Chat

Each service request now has a private conversation thread so homeowners and providers can
message each other directly.

### One-time setup
Run **`supabase-chat.sql`** in Supabase → SQL Editor (after `supabase-services.sql`). It adds a
`messages` table, an `access_token` on `service_requests`, RLS, and a `get_request_by_token()`
lookup for the homeowner's private link.

### How it works
- **Homeowner** submits a service request → an inline chat opens immediately, plus a **private
  link** (`chat.html?r=<id>&t=<token>`) they can bookmark to return to the conversation. No login needed.
- **Provider** sees a **💬 Chat** button per request in `my-services.html` and replies from there.
- **Admin** can open any conversation from the **Service Requests** tab (💬 Chat button).
- Messages poll every ~4 seconds for near real-time updates.

Privacy: the homeowner's thread is protected by an unguessable token in their link, so
conversations stay private without requiring the homeowner to create an account.

### Unread badges + email notifications
Run **`supabase-chat-notify.sql`** (after `supabase-chat.sql`) to add read-tracking columns.
- **Providers** see a red **unread badge** on the 💬 Chat button for requests with new
  messages, plus a total on the count line. Opening a chat marks its messages read.
- **New-message emails**: when someone sends a chat message, the other party is emailed a
  short preview + a link to open the chat (throttled to at most one email per 30s per thread).
  Deploy the function:
  ```bash
  supabase functions deploy send-chat-notification --no-verify-jwt
  ```

### Sharing photos & location in chat
Run **`supabase-chat-media.sql`** (after `supabase-chat.sql`) to add attachment columns +
the `chat-media` storage bucket.
- **📷 Photo** button — anyone in a chat can share an image (e.g. a provider showing their
  work). Images upload to the `chat-media` bucket (max 5 MB) and appear inline.
- **📍 Location** button — shares the sender's current GPS location as a Google Maps link
  (great for homeowners giving directions). Requires the browser's location permission.
