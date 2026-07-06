// Declarative config for the social publishing connection manager.
// NO secrets are hardcoded here — we only reference env var *names*. The actual
// client id / secret values live in the environment. A platform is considered
// "configured" (OAuth available) only when its client-id env var is present;
// otherwise the UI falls back to a manual record (Stratiq's manual-first pattern).
//
// NOTE: Facebook and Instagram can reuse the existing Meta app credentials
// (META_APP_ID / META_APP_SECRET) that already power the Meta ADS integration,
// if dedicated FACEBOOK_/INSTAGRAM_ vars are not set. See configuredEnv() below.

export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'x'
  | 'youtube'

export type PlatformConfig = {
  label: string
  brandColor: string
  envClientId: string
  envClientSecret: string
  authUrl: string
  scopes: string[]
  // Optional fallback env vars (e.g. Meta app creds shared with FB/IG).
  fallbackClientId?: string
  fallbackClientSecret?: string
}

export const PLATFORMS: Record<SocialPlatform, PlatformConfig> = {
  facebook: {
    label: 'Facebook',
    brandColor: '#1877F2',
    envClientId: 'FACEBOOK_APP_ID',
    envClientSecret: 'FACEBOOK_APP_SECRET',
    fallbackClientId: 'META_APP_ID',
    fallbackClientSecret: 'META_APP_SECRET',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'],
  },
  instagram: {
    label: 'Instagram',
    brandColor: '#E4405F',
    envClientId: 'INSTAGRAM_APP_ID',
    envClientSecret: 'INSTAGRAM_APP_SECRET',
    fallbackClientId: 'META_APP_ID',
    fallbackClientSecret: 'META_APP_SECRET',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
  },
  linkedin: {
    label: 'LinkedIn',
    brandColor: '#0A66C2',
    envClientId: 'LINKEDIN_CLIENT_ID',
    envClientSecret: 'LINKEDIN_CLIENT_SECRET',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scopes: ['r_liteprofile', 'w_member_social'],
  },
  tiktok: {
    label: 'TikTok',
    brandColor: '#000000',
    envClientId: 'TIKTOK_CLIENT_KEY',
    envClientSecret: 'TIKTOK_CLIENT_SECRET',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scopes: ['user.info.basic', 'video.publish'],
  },
  x: {
    label: 'X (Twitter)',
    brandColor: '#000000',
    envClientId: 'X_CLIENT_ID',
    envClientSecret: 'X_CLIENT_SECRET',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  },
  youtube: {
    label: 'YouTube',
    brandColor: '#FF0000',
    envClientId: 'YOUTUBE_CLIENT_ID',
    envClientSecret: 'YOUTUBE_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
  },
}

export const PLATFORM_KEYS = Object.keys(PLATFORMS) as SocialPlatform[]

export function isValidPlatform(p: string): p is SocialPlatform {
  return (PLATFORM_KEYS as string[]).includes(p)
}

/** Resolve the client id (with Meta fallback for FB/IG), or null if unset. */
export function resolveClientId(platform: SocialPlatform): string | null {
  const cfg = PLATFORMS[platform]
  return (
    process.env[cfg.envClientId] ||
    (cfg.fallbackClientId ? process.env[cfg.fallbackClientId] : undefined) ||
    null
  )
}

/** Resolve the client secret (with Meta fallback for FB/IG), or null if unset. */
export function resolveClientSecret(platform: SocialPlatform): string | null {
  const cfg = PLATFORMS[platform]
  return (
    process.env[cfg.envClientSecret] ||
    (cfg.fallbackClientSecret ? process.env[cfg.fallbackClientSecret] : undefined) ||
    null
  )
}

/** A platform is "configured" when its client id can be resolved from env. */
export function isPlatformConfigured(platform: SocialPlatform): boolean {
  return !!resolveClientId(platform)
}

/** Build the platform OAuth consent URL. */
export function buildAuthUrl(
  platform: SocialPlatform,
  redirectUri: string,
  state: string
): string {
  const cfg = PLATFORMS[platform]
  const clientId = resolveClientId(platform) || ''
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: cfg.scopes.join(platform === 'facebook' || platform === 'instagram' ? ',' : ' '),
    state,
  })
  // TikTok uses `client_key` instead of `client_id`.
  if (platform === 'tiktok') {
    params.delete('client_id')
    params.set('client_key', clientId)
  }
  return `${cfg.authUrl}?${params.toString()}`
}

/** Public-safe summary of every platform for the settings UI. */
export function platformSummaries() {
  return PLATFORM_KEYS.map((key) => {
    const cfg = PLATFORMS[key]
    return {
      platform: key,
      label: cfg.label,
      brandColor: cfg.brandColor,
      configured: isPlatformConfigured(key),
      envClientId: cfg.envClientId,
    }
  })
}
