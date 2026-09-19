# Publishing LeKhuBo Connect to the App Stores

LeKhuBo Connect is a **PWA (installable website)** hosted on GitHub Pages at
`https://tumedi.github.io/lebokhu-group/`. This guide covers three routes, from
easiest to hardest. **You** must do the submissions — they need your paid
developer accounts, identity verification and signing keys, which cannot be
automated.

---

## Route 1 — Install as a PWA (free, works TODAY, no store)
Nothing to submit. On a phone, open the site and:
- **Android/Chrome:** tap the "⬇ Install App" button (already built in `js/pwa.js`),
  or browser menu → "Install app" / "Add to Home screen".
- **iPhone/Safari:** Share → "Add to Home Screen".
It then launches full-screen like a native app. Good enough for many users.

---

## Route 2 — Google Play Store (recommended; wraps the PWA)
Google Play accepts a **Trusted Web Activity (TWA)** — a thin Android app that
loads your existing website full-screen. You reuse the live PWA; almost no new code.

**Cost:** one-time **$25** Google Play developer registration.

### Step 1 — Icons (one-time)
The store build needs **PNG** icons (our repo currently has SVG). The build tools
below auto-generate all PNG sizes from ONE source image (512×512 PNG of the logo).
Export `assets/logo.svg` to a 512×512 PNG and keep it handy, or let PWABuilder
generate them.

### Step 2 — Generate the Android app
Easiest (web UI): **https://www.pwabuilder.com**
1. Enter `https://tumedi.github.io/lebokhu-group/`.
2. Click **Package for stores → Android → Google Play**.
3. Set **Package ID** to `co.za.lebokhugroup.twa` (must match `assetlinks.json`).
4. Download the generated `.aab` (App Bundle) + the signing key / `assetlinks.json`
   values it shows you.

CLI alternative (Google's **Bubblewrap**):
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://tumedi.github.io/lebokhu-group/manifest.webmanifest
bubblewrap build
```

### Step 3 — Digital Asset Links (removes the browser address bar)
The file `.well-known/assetlinks.json` is already in this repo. Replace
`REPLACE_WITH_YOUR_APP_SIGNING_SHA256_FINGERPRINT` with the **SHA-256 fingerprint**
of your app signing key (PWABuilder/Bubblewrap prints it; or from Play Console →
Release → Setup → App signing). Commit + push so it is served at
`https://tumedi.github.io/lebokhu-group/.well-known/assetlinks.json`.
If the package id differs from `co.za.lebokhugroup.twa`, update it there too.

### Step 4 — Submit
1. Create a Google Play developer account ($25): https://play.google.com/console
2. **Create app** → fill store listing (name, description, screenshots, privacy
   policy URL, category "Business").
3. Upload the `.aab` to a testing track first, then Production.
4. Complete the content-rating + data-safety forms → submit for review.

---

## Route 3 — Apple App Store (hardest)
- Requires a **Mac with Xcode** and the **Apple Developer Program ($99/year)**.
- Apple may reject a plain website wrapper (guideline 4.2 "minimum functionality"),
  so the app should feel app-like (our PWA's offline support + install help).

### Steps
1. On PWABuilder, choose **Package for stores → iOS** to get an **Xcode project**
   (or use Capacitor: `npm i @capacitor/cli`, `npx cap add ios`).
2. Open the project in **Xcode** on a Mac, set the bundle id (e.g.
   `co.za.lebokhugroup.app`), signing team, and app icons.
3. Archive → upload to **App Store Connect**.
4. Fill the listing (screenshots for required device sizes, privacy details,
   category) → submit for review.

---

## Assets you'll need for BOTH stores
- App icon (512×512 PNG).
- Feature graphic / screenshots (phone screenshots of the app).
- Short + full description (reuse the manifest `description`).
- **Privacy policy URL** (both stores require one — we can add a `privacy.html`
  page to the site if you don't have one yet).
- Contact email: `Tbmadihlaba@gmail.com`.

## Notes
- The `package_name` in `.well-known/assetlinks.json` MUST match the id you use
  when generating the Android app, or the app will show a browser address bar.
- Every time you update the website, the app updates automatically (it loads the
  live site) — no re-submission needed for content changes.
