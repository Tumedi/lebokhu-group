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
