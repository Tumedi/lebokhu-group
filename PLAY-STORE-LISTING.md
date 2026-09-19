# Google Play — Store Listing Copy (copy & paste)

Everything below is ready to paste into the Play Console when you create the app.
Fields map to **Play Console → Grow → Store presence → Main store listing**, and the
**App content** (Data safety, content rating, etc.) sections.

---

## App details

**App name** (max 30 chars)
```
LeKhuBo Connect
```

**Short description** (max 80 chars)
```
Local jobs & trusted home services — hire, get hired, connect near you.
```

**Full description** (max 4000 chars)
```
LeKhuBo Connect is a proudly South African, 100% black youth-owned platform that
connects people with work and with trusted local services.

Whether you are looking for a job, offering a service, or need to hire someone
reliable nearby — LeKhuBo Connect brings you together in one simple app.

FOR JOB SEEKERS
• Find domestic and local work opportunities.
• Register in minutes — qualified or not, everyone deserves a chance.
• Upload your CV and get discovered by service providers who need extra hands.

FOR SERVICE PROVIDERS
• List your service for free — salon call-ins, gardening, barbering, bricklaying,
  painting, carpentry, cleaning, transport and more.
• Get found by people in your area who need exactly what you do.
• Build trust with photos, ratings and reviews.
• Need more hands for a job? Browse registered job seekers and hire them.

FOR ANYONE LOOKING TO HIRE
• Search trusted local providers by service and area.
• Chat directly, share photos and your location, and agree the details.
• Hire with confidence — every provider is reviewed before going live.

WHY LEKHUBO CONNECT
• Built for South African communities, fighting youth unemployment.
• Direct, in-app chat with new-message notifications.
• Free to join. Simple to use. Local and trusted.

Join LeKhuBo Connect today and be part of connecting people, skills and
opportunity.

Contact: Tbmadihlaba@gmail.com · 081 798 6359 · Glen Marais, Kempton Park.
```

**App category:** Business
**Tags:** Jobs, Local services, Home services
**Contact email:** `Tbmadihlaba@gmail.com`
**Contact phone (optional):** `081 798 6359`
**Website:** `https://lekhubo-connect.co.za/`
**Privacy policy:** `https://lekhubo-connect.co.za/privacy.html`

---

## Graphics you must upload
- **App icon:** 512×512 PNG (the LeKhuBo logo on the #0B2038 background).
- **Feature graphic:** 1024×500 PNG (banner — logo + tagline “Local Jobs & Trusted Home Services”).
- **Phone screenshots:** at least 2 (up to 8), 16:9 or 9:16, min 320px.
  Suggested screens to capture on a phone:
  1. Home page (hero).
  2. Find a Service directory.
  3. A provider listing / profile.
  4. The chat conversation.
  5. Sign-up screen (the 3 roles).
  6. Browse Job Seekers (provider view).

---

## App content forms

### Privacy policy
```
https://lekhubo-connect.co.za/privacy.html
```

### App access
If reviewers need to see logged-in areas, provide a test account:
```
All or some functionality is restricted (login required for dashboards).
Provide a test login, e.g.:
  Email:    reviewer@lebokhu-group.co.za   (create this in Supabase)
  Password: (set one and paste here)
Notes: Choose "Service Provider" or "Potential Employer" to see dashboards & chat.
```

### Target audience & content
- Target age group: **18 and over**.
- Not designed for children; no appeal to children.

### Ads
```
No, this app does not contain ads.
```

### Content rating (questionnaire)
Answer honestly — for this app the answers are essentially all “No”:
- Violence: No · Sexual content: No · Profanity: No · Drugs: No · Gambling: No
- Does it let users interact / share content? **Yes** (users can chat and share
  photos/location, and share user-generated listings). Declare this so you get the
  correct rating. Expected rating: everyone / low maturity.

---

## Data safety form (declare exactly this — it must match the privacy policy)

**Does your app collect or share user data?** Yes (collect). **No data is sold.**

Data is encrypted in transit (HTTPS). Users can request deletion (via the contact
email). Declare the following data types as **Collected** (and shared only between
users to provide the service, not with third parties for their own use):

| Data type | Collected | Shared | Purpose | Optional? |
|-----------|-----------|--------|---------|-----------|
| Name | Yes | Yes (with the other party to connect) | App functionality, Account management | Required |
| Email address | Yes | No | App functionality, Account management, sending notifications | Required |
| Phone number | Yes | Yes (with the other party to connect) | App functionality | Required |
| Photos | Yes | Yes (shown to the chat recipient / on listings) | App functionality | Optional |
| Files/docs (CV) | Yes | Yes (viewable by providers/admin) | App functionality | Optional |
| Messages (in-app) | Yes | Yes (with the conversation partner) | App functionality | Required for chat |
| Other info (skills, experience, service details) | Yes | Yes (job-seeker profiles / provider listings are visible) | App functionality | Optional |

Security practices to tick:
- Data is encrypted in transit: **Yes**.
- Users can request that data be deleted: **Yes** (via `Tbmadihlaba@gmail.com`).
- Committed to Play Families policy: N/A (18+).

> Note: the app does NOT collect location. (The chat "Share my location" GPS
> feature was removed for this release, so no location permission or declaration
> is needed. It can be re-added later — if you do, remember to declare precise
> location here again.)

---

## Release notes (for the first version)
```
First release of LeKhuBo Connect — find local jobs, offer your services, and hire
trusted local providers, with direct in-app chat.
```
