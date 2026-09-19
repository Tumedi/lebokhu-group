# Getting LeKhuBo Connect to appear on Google

Site: **https://lekhubo-connect.co.za/**

## What's already done (in the code)
- **`robots.txt`** — allows search engines to crawl the site; points to the sitemap; hides private pages (admin, dashboards, reset-password).
- **`sitemap.xml`** — lists all public pages so Google can find them.
- **Meta tags** — title, description, keywords, canonical URLs, and Open Graph /
  Twitter cards (nice previews when the link is shared) on the main pages.
- **Structured data (JSON-LD)** — Organization + WebSite schema on the homepage so
  Google understands the business name, logo, contact and location.

## What YOU must do (Google can't be forced — but you can speed it up)

### 1. Google Search Console (most important — do this)
1. Go to **https://search.google.com/search-console** and sign in with a Google account.
2. **Add property** → choose **URL prefix** → enter `https://lekhubo-connect.co.za/`.
3. **Verify ownership.** Easiest for GitHub Pages: pick the **HTML tag** method — Google
   gives you a `<meta name="google-site-verification" content="XXXX">` tag. Send me that
   tag and I'll add it to the site's `<head>`, then push; then click **Verify**.
   (Alternative: the **DNS TXT record** method at your registrar.)
4. Once verified: **Sitemaps** (left menu) → submit `sitemap.xml`.
5. Use **URL Inspection** → paste your homepage URL → **Request indexing** (repeat for the
   key pages). This nudges Google to crawl now instead of waiting.

### 2. Bing (optional, quick win)
Do the same at **https://www.bing.com/webmasters** — Bing (and thus some other engines)
indexes fast and you can import the site straight from Search Console.

### 3. Build signals that help ranking
- **Google Business Profile** (free): https://business.google.com — create a listing for
  "LeKhuBo Connect", category e.g. "Employment agency" / "Service establishment", with your
  Kempton Park area, phone and website. This is huge for local South African searches.
- **Link to your site** from social media (Facebook, Instagram, LinkedIn, WhatsApp status)
  and any directories. Inbound links + real visits are what move you up the rankings.
- Share the link so people **click it from Google** — engagement helps.

## Realistic expectations / timeline
- **New sites take days to a few weeks** to appear, even after submitting.
- Searching your **exact name "LeKhuBo Connect"** will start working first (usually within
  1–2 weeks of indexing), because there's little competition for that phrase.
- Ranking for **generic terms** ("jobs Kempton Park", "cleaners near me") is competitive and
  builds over months with content, links and traffic.
- Check progress in Search Console → **Pages** (indexed count) and **Performance** (searches
  you appear for).

## Tip
After any big content change, re-submit the sitemap and use URL Inspection → Request
indexing so Google re-crawls sooner.
