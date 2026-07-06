// Helpers for deriving a bare domain and logo/favicon URLs from a client website.
// Used by the "add client" wizard to auto-pick a logo from the client's site,
// and by the clients API to auto-populate the hosting domain field.

/**
 * Normalize any website/URL-ish input to a bare domain.
 * Strips protocol, path/query/hash, port, leading "www.", and lowercases.
 * Returns '' when nothing usable can be extracted.
 *
 * Examples:
 *   "https://www.Example.com/path?x=1" -> "example.com"
 *   "Example.COM"                      -> "example.com"
 *   "http://sub.example.co.uk"         -> "sub.example.co.uk"
 */
export function domainFromUrl(input?: string | null): string {
  if (!input) return ''
  let s = String(input).trim()
  if (!s) return ''
  // Strip protocol (or any scheme://) if present.
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
  // Strip everything from the first path/query/hash separator onward.
  s = s.split(/[/?#]/)[0]
  // Drop userinfo (user:pass@) and port.
  s = s.split('@').pop() || s
  s = s.split(':')[0]
  // Drop leading www.
  s = s.replace(/^www\./i, '')
  return s.trim().toLowerCase()
}

/** Clearbit Logo API — no key required. May 404 for unknown domains. */
export function logoUrlForDomain(domain: string): string {
  return `https://logo.clearbit.com/${domain}`
}

/** Google favicon service — reliable fallback when Clearbit has no logo. */
export function faviconUrlForDomain(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
}
