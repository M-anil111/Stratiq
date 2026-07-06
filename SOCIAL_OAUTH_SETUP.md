# Social Account OAuth Setup

Step-by-step to obtain and configure app credentials for each social platform so
the **Connect** button works (instead of "Add manually"). A platform turns on the
moment its client-ID env var is present.

## Before you start — two things that apply to every platform

1. **Your app domain.** Everywhere below, replace `YOUR_DOMAIN` with the URL your
   app is actually served from — your custom domain if you have one, otherwise the
   Vercel production URL (e.g. `https://stratiq.vercel.app`). To find it: Vercel →
   project **stratiq** → **Domains**. If you also test on Vercel **preview** URLs,
   register those callback URLs too (some providers allow multiple).

2. **The redirect / callback URL** each platform must whitelist is always:
   ```
   https://YOUR_DOMAIN/api/auth/social/<platform>/callback
   ```
   e.g. `https://YOUR_DOMAIN/api/auth/social/facebook/callback`.

3. **Where env vars go:** Vercel → project **stratiq** → **Settings** →
   **Environment Variables**. Add each as **Production** (and **Preview** if you
   test there). Redeploy after adding — env vars only apply to new deployments.

> Suggested app name for all of them: **"Stratiq — Mindshare Consulting"** (or just
> "Mindshare Consulting"). Use your agency logo and your privacy-policy + terms URLs.

---

## 1. Facebook (Pages)

- **Console:** https://developers.facebook.com/apps → **Create app**
- **App name:** `Stratiq — Mindshare Consulting`
- **Use case / type:** choose **"Other"** → **Business** app type.
- **Add product:** **Facebook Login** (Set up → Web). Also add **"Facebook Login
  for Business"** if prompted.
- **Valid OAuth Redirect URIs** (Facebook Login → Settings):
  `https://YOUR_DOMAIN/api/auth/social/facebook/callback`
- **Permissions the app requests** (the code asks for these): `pages_show_list`,
  `pages_manage_posts`, `pages_read_engagement`. To use them on real Pages you must
  submit these for **App Review** and complete **Business Verification** (Meta
  Business Manager). Until approved, only Page admins/testers on the app can use it.
- **Get credentials:** App → **Settings → Basic** → **App ID** and **App Secret**.
- **Env vars:**
  - `FACEBOOK_APP_ID` = your App ID
  - `FACEBOOK_APP_SECRET` = your App Secret
  - *(Optional)* If you already run the Meta Ads integration, you can skip these —
    the code falls back to `META_APP_ID` / `META_APP_SECRET`.

## 2. Instagram (Business/Creator via a Facebook app)

Instagram publishing uses the **same Facebook app** (Instagram Graph API). The IG
account must be a **Business or Creator** account **linked to a Facebook Page**.

- In the same Facebook app, add the **Instagram** product (Instagram Graph API).
- **Redirect URI:** `https://YOUR_DOMAIN/api/auth/social/instagram/callback`
- **Permissions:** `instagram_basic`, `instagram_content_publish`, `pages_show_list`
  (App Review + Business Verification required for production).
- **Env vars:**
  - `INSTAGRAM_APP_ID` = the Facebook App ID (same value as Facebook)
  - `INSTAGRAM_APP_SECRET` = the Facebook App Secret
  - *(Optional)* falls back to `META_APP_ID` / `META_APP_SECRET` if unset.

## 3. LinkedIn

- **Console:** https://www.linkedin.com/developers/apps → **Create app**
- **App name:** `Stratiq — Mindshare Consulting`
- **Associate a LinkedIn Company Page** (required — create one if needed).
- **Products to request** (Products tab): **"Share on LinkedIn"** and
  **"Sign In with LinkedIn using OpenID Connect"**. To post on behalf of a company
  Page, also request the **Community Management API** (approval required).
- **Auth tab → Authorized redirect URLs:**
  `https://YOUR_DOMAIN/api/auth/social/linkedin/callback`
- **Scopes the code requests:** `r_liteprofile`, `w_member_social` (personal-profile
  posting). For organization/Page posting you'll add `w_organization_social` after
  Community Management approval.
- **Get credentials:** **Auth** tab → **Client ID** and **Client Secret**.
- **Env vars:**
  - `LINKEDIN_CLIENT_ID` = Client ID
  - `LINKEDIN_CLIENT_SECRET` = Client Secret
- **Note:** LinkedIn access tokens expire every ~60 days; the app auto-refreshes
  when a refresh token is present, otherwise it prompts you to reconnect.

## 4. TikTok

- **Console:** https://developers.tiktok.com → **Manage apps** → **Connect an app**
- **App name:** `Stratiq — Mindshare Consulting`
- **Add product:** **Login Kit** and **Content Posting API**.
- **Redirect URI** (Login Kit config):
  `https://YOUR_DOMAIN/api/auth/social/tiktok/callback`
- **Scopes:** `user.info.basic`, `video.publish`.
- **IMPORTANT — audit required:** until TikTok **audits/approves** your app, all
  posts are forced to **private (self-only)** regardless of settings. Submit for
  review to unlock public posting.
- **Get credentials:** app dashboard → **Client key** and **Client secret**.
- **Env vars:**
  - `TIKTOK_CLIENT_KEY` = Client key  *(note: "key", not "id")*
  - `TIKTOK_CLIENT_SECRET` = Client secret

## 5. X (Twitter)

- **Console:** https://developer.x.com/en/portal/dashboard → create a **Project**,
  then an **App** inside it.
- **App name:** `Stratiq — Mindshare Consulting`
- **User authentication settings → Set up:**
  - **App permissions:** **Read and write**
  - **Type of App:** **Web App / Automated App or Bot** (confidential client)
  - **Callback URI / Redirect URL:**
    `https://YOUR_DOMAIN/api/auth/social/x/callback`
  - **Website URL:** your domain
- **OAuth 2.0** must be enabled (the app uses OAuth 2.0 with PKCE-style scopes:
  `tweet.read`, `tweet.write`, `users.read`, `offline.access`).
- **Get credentials:** **Keys and tokens** → **OAuth 2.0 Client ID** and
  **Client Secret**.
- **Env vars:**
  - `X_CLIENT_ID` = OAuth 2.0 Client ID
  - `X_CLIENT_SECRET` = OAuth 2.0 Client Secret
- **Note:** X now requires a **paid API tier** for posting (pay-per-use or a
  subscription). Media (image/video) posting needs write access on your tier.

## 6. YouTube (Google Cloud)

- **Console:** https://console.cloud.google.com → create/select a **project**
  (name it `Stratiq`).
- **Enable API:** APIs & Services → **Enable APIs** → **YouTube Data API v3**.
- **OAuth consent screen:** configure it — **User type: External**, app name
  `Stratiq — Mindshare Consulting`, your support + developer email, and add the
  scopes below. Submit for **verification** (restricted scopes require Google's
  review; until verified, uploads are limited to test users and locked to private).
- **Create credentials:** APIs & Services → **Credentials** → **Create
  Credentials** → **OAuth client ID** → **Web application**.
  - **Authorized redirect URIs:**
    `https://YOUR_DOMAIN/api/auth/social/youtube/callback`
- **Scopes:** `.../auth/youtube.upload`, `.../auth/youtube.readonly`.
- **Get credentials:** the OAuth client shows **Client ID** and **Client secret**.
- **Env vars:**
  - `YOUTUBE_CLIENT_ID` = Client ID
  - `YOUTUBE_CLIENT_SECRET` = Client secret

---

## After configuring

1. Add the env vars in Vercel (Production + Preview), then **redeploy**.
2. Reload **Settings → Social Accounts** — the platform now shows a working
   **Connect** button, which runs the OAuth consent and stores the token
   (encrypted). Tokens are refreshed automatically where the platform supports it;
   otherwise you'll get a "Reconnect needed" prompt before they expire.
3. **Boosting** (paid promotion) additionally needs `META_AD_ACCOUNT_ID` and a
   Facebook token with `ads_management`.

### Env var quick reference

| Platform  | Client ID var           | Secret var                 |
|-----------|-------------------------|----------------------------|
| Facebook  | `FACEBOOK_APP_ID`       | `FACEBOOK_APP_SECRET`      |
| Instagram | `INSTAGRAM_APP_ID`      | `INSTAGRAM_APP_SECRET`     |
| LinkedIn  | `LINKEDIN_CLIENT_ID`    | `LINKEDIN_CLIENT_SECRET`   |
| TikTok    | `TIKTOK_CLIENT_KEY`     | `TIKTOK_CLIENT_SECRET`     |
| X         | `X_CLIENT_ID`           | `X_CLIENT_SECRET`          |
| YouTube   | `YOUTUBE_CLIENT_ID`     | `YOUTUBE_CLIENT_SECRET`    |

(Facebook & Instagram fall back to `META_APP_ID` / `META_APP_SECRET` if the
dedicated vars are unset.)
