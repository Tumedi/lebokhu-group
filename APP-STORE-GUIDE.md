# Publishing LeKhuBo Connect to the App Stores

LeKhuBo Connect is a **PWA (installable website)** hosted on GitHub Pages at
`https://lekhubo-connect.co.za/`. This guide covers three routes, from
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

**What's already prepared in this repo for you:**
- `manifest.webmanifest` — TWA-ready (has `id`, name, colors, PNG icon entries, shortcuts).
- `.well-known/assetlinks.json` — Digital Asset Links file (needs your fingerprint filled in).
- `.nojekyll` — makes GitHub Pages serve the `.well-known/` folder (Jekyll hides dotfolders otherwise).
- `twa-manifest.json` — a pre-filled Bubblewrap config so the build needs almost no input.
- `privacy.html` — your privacy policy (Play requires a URL): `https://lekhubo-connect.co.za/privacy.html`.

### Step 0 — One-time: create the PNG icons
The manifest references `assets/icon-192.png`, `assets/icon-512.png` and
`assets/icon-maskable-512.png`, but the repo currently ships **SVG** icons. Create the PNGs:
- **Easiest:** let **PWABuilder** (Step 1) generate all sizes from a single 512×512 source image.
- **Manual:** export `assets/logo.svg` (or `icon-512.svg`) to PNG at 192×192 and 512×512, and a
  512×512 **maskable** version (logo centered inside ~80% safe zone on the `#0B2038` background),
  then commit them to `assets/` with those exact names.
(Any online SVG→PNG converter works; there's no image tooling in this repo.)

### Step 1 — Generate the Android app (choose ONE)

**A) PWABuilder (web UI, easiest):** https://www.pwabuilder.com
1. Enter `https://lekhubo-connect.co.za/` → **Start**.
2. **Package for stores → Android → Google Play**.
3. Set **Package ID** to exactly `co.za.lebokhugroup.twa` (MUST match `assetlinks.json`).
4. Let it generate icons if you skipped Step 0.
5. Download the ZIP — it contains the **`.aab`** (upload to Play), a **signing key**
   (`.keystore` — keep it safe forever) and a ready **`assetlinks.json`** with your fingerprint.

**B) Bubblewrap (CLI):** the repo's `twa-manifest.json` is pre-filled.
```bash
npm install -g @bubblewrap/cli
# Copy twa-manifest.json into an empty build folder, then:
bubblewrap init --manifest ./twa-manifest.json   # or: --manifest https://lekhubo-connect.co.za/manifest.webmanifest
bubblewrap build                                  # creates app-release-bundle.aab + android.keystore
```
Bubblewrap prints the **SHA-256 fingerprint** at the end (also: `bubblewrap fingerprint`).

### Step 2 — Fill in Digital Asset Links (removes the browser address bar)
1. Get the **SHA-256 fingerprint** of the key that will sign the app. Best source:
   Play Console → your app → **Release → Setup → App integrity → App signing** (use the
   *App signing key* fingerprint if you use Play App Signing, which is the default).
2. Edit `.well-known/assetlinks.json` → replace
   `REPLACE_WITH_YOUR_APP_SIGNING_SHA256_FINGERPRINT` with that fingerprint
   (format `AB:CD:EF:...`). Keep `package_name` = `co.za.lebokhugroup.twa`.
3. Commit + push. Verify it's live at
   `https://lekhubo-connect.co.za/.well-known/assetlinks.json`
   and validate with Google's tool:
   https://developers.google.com/digital-asset-links/tools/generator

> If you use **Play App Signing** (recommended default), Google re-signs your app, so the
> fingerprint that matters is the **App signing key** one from Play Console — add that one
> (you can list multiple fingerprints in the array if needed).

### Step 3 — Submit to Play
1. Create a Google Play developer account ($25): https://play.google.com/console
2. **Create app** → App name **LeKhuBo Connect**, language English (South Africa), type **App**, **Free**.
3. **Store listing:** short + full description (reuse the manifest description), app icon
   (512×512 PNG), feature graphic (1024×500), at least 2 phone screenshots, category **Business**,
   contact email `Tbmadihlaba@gmail.com`, and **Privacy policy URL**
   `https://lekhubo-connect.co.za/privacy.html`.
4. **Release → Production (or Internal testing first) → Create release** → upload the **`.aab`**.
5. Complete **Content rating**, **Data safety**, **Target audience** (18+), and **App access**
   (provide a test login if reviewers need one).
6. **Send for review.** First review typically takes a few days.

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
- **Privacy policy URL** (both stores require one — ready at
  `https://lekhubo-connect.co.za/privacy.html`).
- Contact email: `Tbmadihlaba@gmail.com`.

## Notes
- The `package_name` in `.well-known/assetlinks.json` MUST match the id you use
  when generating the Android app, or the app will show a browser address bar.
- Every time you update the website, the app updates automatically (it loads the
  live site) — no re-submission needed for content changes.
