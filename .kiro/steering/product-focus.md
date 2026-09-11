# LeKhuBo Connect — Product Focus & Employer Module

## Current focus (active)
LeKhuBo Connect currently focuses on **two audiences only**:

1. **Job seekers / domestic workers** — register, browse local & domestic jobs, apply.
2. **Service providers ↔ homeowners** — providers list services (salon call-ins,
   gardening, barbers, bricklayers, painters, carpenters, cleaners, etc.); homeowners
   search the directory, chat, and connect.

**Account roles offered at sign-up:** `seeker`, `provider`, `homeowner`.

## Employer / company job-posting module (temporarily DISABLED)
The employer module was intentionally switched off (not deleted) so it can be
re-enabled as the platform grows. Nothing in the database was removed — the
`employer` role, `job_posts` table, and any existing posts are untouched.

### What is currently disabled
- **Sign-up:** the "Employer" role option and company-name field are removed
  (`signup.html`, `js/signup.js`).
- **Routing:** `js/auth.js` `dashboardFor()` no longer maps `employer`, and the
  `renderHeader()` shortcuts no longer include the "＋ Post a Job" link.
- **Pages:** `post-job.html` and `my-posts.html` are "Coming Soon" stubs that
  auto-redirect to `index.html`. Their scripts (`js/post-job.js`, `js/my-posts.js`)
  were deleted.
- **Admin:** the "Job Posts" tab (`#tabPosts` / `#panelPosts`) is `hidden` and
  `loadPosts()` is commented out in `showDashboard()` (`admin.html`, `js/admin.js`).
  The full JOB POSTS code block in `admin.js` is preserved.
- **Homepage:** the "For Companies" section was replaced with "For Service
  Providers"; Companies / Post-a-Job nav & footer links were removed.

### How to RE-ENABLE the employer module later
1. `signup.html`: restore the Employer radio option and the `#companyField`;
   change `role-toggle-3` back to `role-toggle-4`. In `js/signup.js`, restore the
   company field read + the metadata `company` value + the show/hide handler.
2. `js/auth.js`: add back `if (role === 'employer') return { href: 'my-posts.html',
   label: 'My Job Posts' };` in `dashboardFor()`, and the
   `employer: { href: 'post-job.html', label: '＋ Post a Job' }` entry in the
   `renderHeader()` shortcuts object.
3. Restore `post-job.html` / `my-posts.html` from git history (they were full pages
   before the "Refocus" commit) and restore `js/post-job.js` / `js/my-posts.js`.
4. `admin.html`: remove `hidden` from `#tabPosts` and `#panelPosts`.
   `js/admin.js`: uncomment `loadPosts();` in `showDashboard()`.
5. Homepage: re-add the "For Companies" section and its nav/footer links if desired.
6. Bump the service worker cache version in `sw.js` so clients pick up the change.

## Conventions to keep in mind
- Static HTML/CSS/JS site + Supabase; deployed via GitHub Pages from `Tumedi/lebokhu-group`.
- The service directory dropdown (`services-directory.html`) and the provider
  listing dropdown (`list-service.html`) MUST list the **same service options in the
  same order** so directory filtering matches stored values.
- After any JS/CSS/HTML change, bump `CACHE_VERSION` in `sw.js` (currently network-first
  for JS/CSS, but bumping guarantees stale caches are purged).
- Admin access is gated to `role='admin'` in `js/admin.js` (UI) AND by the DB
  `public.is_admin()` RLS policies. Keep both layers in sync.
