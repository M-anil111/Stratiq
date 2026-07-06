// Minimal dependency-free HTML sanitizer for rendering ProofHub-supplied HTML
// (task descriptions, comments, activity). ProofHub returns rich HTML; we allow
// a small formatting allowlist and strip anything that could execute script.
//
// This is intentionally conservative (allowlist, not blocklist): unknown tags
// are dropped, all event handlers and javascript:/data: URLs are removed. It is
// not a full DOM sanitizer, but it removes the XSS vectors (script/style/iframe/
// on* handlers/dangerous URLs) for the trusted-but-not-guaranteed ProofHub feed.

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'p', 'br', 'ul', 'ol', 'li',
  'blockquote', 'code', 'pre', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr',
])
// Only these attributes survive, and href/src are URL-checked.
const ALLOWED_ATTRS = new Set(['href', 'title', 'target', 'rel'])

function safeUrl(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (v.startsWith('javascript:') || v.startsWith('data:') || v.startsWith('vbscript:')) return false
  return true
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''
  let html = String(input)

  // Drop entire dangerous elements including their content.
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  html = html.replace(/<\s*(script|style|iframe|object|embed|form|link|meta)[^>]*\/?>/gi, '')

  // Rewrite each remaining tag through the allowlist.
  html = html.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_m, slash, tag, attrs) => {
    const name = String(tag).toLowerCase()
    if (!ALLOWED_TAGS.has(name)) return ''
    if (slash) return `</${name}>`

    // Keep only allowlisted, safe attributes.
    let clean = ''
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g
    let a: RegExpExecArray | null
    while ((a = attrRe.exec(attrs)) !== null) {
      const attr = a[1].toLowerCase()
      const val = a[3] ?? a[4] ?? ''
      if (attr.startsWith('on')) continue          // event handlers
      if (!ALLOWED_ATTRS.has(attr)) continue
      if ((attr === 'href' || attr === 'src') && !safeUrl(val)) continue
      clean += ` ${attr}="${val.replace(/"/g, '&quot;')}"`
    }
    // Force safe link behavior.
    if (name === 'a' && /href=/.test(clean)) clean += ' rel="noopener noreferrer nofollow"'
    return `<${name}${clean}>`
  })

  return html
}
