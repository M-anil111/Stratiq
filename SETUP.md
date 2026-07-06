# Stratiq — Go-Live Setup

Repo: `M-anil111/Stratiq` · Branch/PR: `claude/stratiq-requirements-732pt3` (PR #3)
Hosting: Vercel · DB: Supabase project `sczvyujahydnsdlakwzh`

These steps require access to the Vercel, Supabase, Helcim, and Google accounts.

## 1. Environment variables (Vercel → Settings → Environment Variables; Production + Preview)

**Core (verify they exist):**
```
NEXT_PUBLIC_SUPABASE_URL=<supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_APP_URL=https://<production domain>
ENCRYPTION_KEY=<32-byte key for AES-256-GCM>
RESEND_API_KEY=<Resend key>
CRON_SECRET=<random string>
```

**Database direct connection (for the one-click migration runner):**
```
POSTGRES_URL_NON_POOLING=<Supabase Settings → Database → Connection string → URI (direct, port 5432)>
```

**Google (Analytics, Search Console, Ads, Drive, Places):**
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_PLACES_API_KEY=...
```
Google Cloud OAuth client → Authorized redirect URI: `https://<domain>/api/auth/google/callback`
Enable APIs: Analytics Admin, Analytics Data, Search Console, Google Ads, Drive, Places.

**QuickBooks:**
```
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_SANDBOX=false   # true while testing
```
QB app redirect URI: `https://<domain>/api/auth/quickbooks/callback`

**Helcim (payments):**
```
HELCIM_API_TOKEN=<NEW token — regenerate any previously shared token>
HELCIM_WEBHOOK_VERIFIER_TOKEN=<Helcim → Integrations → Webhooks>
HELCIM_PAYMENT_PAGE_URL=<Helcim Hosted Payment Page base URL>
```

**Meta Ads (optional):**
```
META_APP_ID=...
META_APP_SECRET=...
```
Meta redirect URI: `https://<domain>/api/auth/meta/callback`

→ Redeploy after adding env vars.

## 2. Apply the database schema (one click)
1. Log in as super_admin/admin.
2. Settings → Database → **Apply database updates** (runs migrations 010–034, idempotent).
   - If it reports "no connection string," set `POSTGRES_URL_NON_POOLING` (step 1) and redeploy.
   - Manual alternative: run `supabase/APPLY_ALL_PENDING.sql` in the Supabase SQL editor.

## 3. Helcim webhook
Helcim → All Tools → Integrations → Webhooks:
- Deliver URL: `https://<domain>/api/webhooks/payments`  (must NOT contain the word "helcim")
- Verifier Token → set as `HELCIM_WEBHOOK_VERIFIER_TOKEN`
- Events: enable `cardTransaction`; Save.

## 4. Connect integrations (Settings → Integrations)
- Connect Google, QuickBooks, Meta.
- Looker Studio: paste template report ID.
- Per client (client detail → Analytics / Search Console): select GA4 property + GSC site.

## 5. Cron jobs
Confirm the Vercel Cron Jobs from `vercel.json` are registered (weekly targets, Friday reminder, missed targets, monthly report, daily ads sync) and `CRON_SECRET` is set.

## 6. Smoke test
- Create a client (logo auto-loads, projects auto-create).
- Import a QuickBooks invoice → send → verify Helcim "Pay Now" link in email.
- Test payment → webhook flips invoice to Paid.
- Invite a client (Team → Add Users → Client) → open `/accept-invite` link → set password → portal access.
- Log out/in → email OTP verification screen appears.

## 7. Merge PR #3 into `main` once verified.

---

## Social Publishing Suite (added)

### Database
Migration `040_social_suite.sql` is included in **Settings → Database** (APPLY_ALL_PENDING.sql). It adds the scheduling lifecycle, `posting_slots`, `social_published_posts`, the `notifications` table, `social_accounts` reconnect fields, and `users.dashboard_layout`/`theme_preference`. Apply it before using scheduling.

### Publishing cadence (important)
`/api/cron/publish-social` drives the queue. Vercel **Hobby** allows only **once-daily** crons, so `vercel.json` schedules it daily. For real near-real-time publishing choose one:
- **Vercel Pro** — change the schedule back to `*/5 * * * *`.
- **Free external pinger** — point cron-job.org (or any scheduler) at
  `https://<app>/api/cron/publish-social` every 5 min with header
  `Authorization: Bearer $CRON_SECRET`.

### Per-platform env vars (OAuth app credentials)
Publishing/boosting only activates once the platform's app credentials are set. Nothing is stored in the repo.
- Facebook/Instagram/Threads: `META_APP_ID`, `META_APP_SECRET` (or `FACEBOOK_*`, `INSTAGRAM_*`). Boost also needs `META_AD_ACCOUNT_ID` and an `ads_management` token.
- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.
- X: `X_CLIENT_ID`, `X_CLIENT_SECRET`.
- TikTok: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
- YouTube: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`.
- Pinterest: `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`.
- Bluesky: connect with an app password (stored encrypted); no app registration needed.

### App-review gotchas (from platform docs)
- TikTok & YouTube force content to **private** until the app passes their audit/verification.
- Meta (FB/IG/Threads) and LinkedIn need App Review + Business Verification; LinkedIn tokens expire every 60 days (auto-refresh handled when a refresh token is present, else a reconnect notification fires).
- Instagram publish cap is ~25–100 posts / rolling 24h.

### Space management
After a post publishes successfully, its heavy `social_media_postings` row and any Google Drive media are **deleted**; a lightweight `social_published_posts` reference (platform + external id + permalink + snippet) is kept, and live metrics are re-fetched from the platform API. This keeps storage flat as volume grows.
