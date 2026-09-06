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
