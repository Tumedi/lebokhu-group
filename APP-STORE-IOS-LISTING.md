# Apple App Store — Listing Copy (copy & paste)

Ready to paste into **App Store Connect** when you submit the iOS build. Apple's
fields differ from Google Play (subtitle, promotional text, a keywords field, and
the App Privacy "nutrition label"). Character limits are noted.

> Reminder: iOS requires a **Mac + Xcode** to build and the **Apple Developer
> Program ($99/year)**. See APP-STORE-GUIDE.md → Route 3. Apple can reject plain
> website wrappers (Guideline 4.2) — the "Reviewer notes" below help avoid that.

---

## App information

**App name** (max 30 chars)
```
LeKhuBo Connect
```

**Subtitle** (max 30 chars)
```
Local jobs & home services
```

**Promotional text** (max 170 chars — editable any time without a new build)
```
Find local work, offer your services, or hire trusted local providers near you — with direct in-app chat. Proudly South African, free to join.
```

**Description** (max 4000 chars)
```
LeKhuBo Connect is a proudly South African, 100% black youth-owned platform that
connects people with work and with trusted local services. Whether you are
looking for a job, offering a service, or need to hire someone reliable nearby,
LeKhuBo Connect brings you together in one simple app.

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
• Chat directly, share photos, and agree the details.
• Hire with confidence — every provider is reviewed before going live.

WHY LEKHUBO CONNECT
• Built for South African communities, helping fight youth unemployment.
• Direct, in-app chat with new-message notifications.
• Free to join. Simple to use. Local and trusted.

Join LeKhuBo Connect today and be part of connecting people, skills and
opportunity.

Contact: info@lekhubo-connect.co.za · 081 798 6359 · Glen Marais, Kempton Park.
```

**Keywords** (max 100 chars, comma-separated, no spaces after commas for efficiency)
```
jobs,work,hire,services,plumber,painter,gardener,cleaner,barber,salon,local,South Africa
```

**Support URL**
```
https://lekhubo-connect.co.za/
```

**Marketing URL** (optional)
```
https://lekhubo-connect.co.za/
```

**Privacy Policy URL**
```
https://lekhubo-connect.co.za/privacy.html
```

**Primary category:** Business
**Secondary category (optional):** Productivity

---

## Pricing & availability
- **Price:** Free
- **Availability:** South Africa (add more territories if you wish).

---

## Age rating (App Store questionnaire)
Answer all content questions **None**. Because users can chat and post
user-generated content, expect a **17+** rating (Apple often assigns this to apps
with unmoderated user-generated content / communication). If prompted:
- "Unrestricted web access": **No** (the app is scoped to your site).
- "User-generated content": **Yes** — you must have moderation + the ability to
  block/report. (See reviewer notes: listings are reviewed by admin; reviews are
  moderated in the admin dashboard.)

---

## App Privacy ("nutrition label") — declare exactly this
Matches the privacy policy and the current app (no location collected).
**Data is linked to the user's identity; not used for tracking; not sold.**

Data collected:
- **Contact Info:** Name, Email address, Phone number
  → Purpose: App Functionality. Linked to user: Yes. Tracking: No.
- **User Content:** Photos, Other user content (chat messages), and a CV/document (optional)
  → Purpose: App Functionality. Linked to user: Yes. Tracking: No.
- **Identifiers:** User ID (account id)
  → Purpose: App Functionality. Linked to user: Yes. Tracking: No.

Do NOT declare Location (the GPS share feature was removed for launch).

Data used to track you: **None.**

---

## Screenshots (required)
Apple requires screenshots for specific device sizes. Provide at least:
- **6.7" iPhone** (1290 × 2796) — required.
- **6.5" iPhone** (1242 × 2688) — recommended.
- (iPad only if you mark it iPad-compatible.)
Capture these screens (portrait): Home, Find a Service directory, a provider
profile, the chat conversation, and the sign-up (3 roles) screen.

**App icon:** 1024 × 1024 PNG, no transparency, no rounded corners (Apple rounds it).

---

## Reviewer notes (App Review Information) — IMPORTANT for Guideline 4.2
Paste this in "Notes" so it isn't dismissed as a mere website wrapper:
```
LeKhuBo Connect is a two-sided marketplace for South Africa connecting job seekers,
service providers and people who want to hire them. Core app features: role-based
accounts and dashboards, a searchable provider directory, in-app real-time chat with
photo sharing and push/notification alerts, CV upload, provider portfolios, and
ratings/reviews. Provider listings and reviews are moderated by our admin before going
live. The app works installed/offline-capable (PWA) and is more than a website: it
offers account-based, personalised, interactive functionality.

TEST ACCOUNT (please use to review dashboards & chat):
  Email:    reviewer@lebokhu-group.co.za
  Password: (set this in Supabase and paste here)
  Tip: sign in, open "Find a Service", open a provider, and start a chat.

Contact: info@lekhubo-connect.co.za / 081 798 6359
```

## "What's New" (version notes for v1.0)
```
First release of LeKhuBo Connect — find local jobs, offer your services, and hire
trusted local providers, with direct in-app chat.
```

---

## Notes
- Build the iOS project with **PWABuilder → iOS** or **Capacitor**, open in Xcode on
  a Mac, set bundle id `co.za.lebokhugroup.app`, add the 1024² icon, archive, and
  upload to App Store Connect (see APP-STORE-GUIDE.md → Route 3).
- Keep the App Privacy answers in sync with `privacy.html`. If you re-add the chat
  location feature later, add **Location** back to the App Privacy label.
