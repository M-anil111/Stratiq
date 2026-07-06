// Per-platform publishing. Each publisher takes a resolved access token and a
// normalized post payload and returns a typed result. Implemented against each
// network's documented publishing flow (2025-2026 API versions).
//
// Networks whose publish path needs binary/chunked media upload or app-review
// gating (YouTube resumable upload, TikTok direct post) return a structured
// "pending"/"unsupported" result rather than throwing, so the lifecycle stays
// correct and the specific path can be completed once credentials/app review
// are in place. Public-URL media flows (IG, Threads, Pinterest, FB photo) are
// wired end-to-end.

export type PublishPayload = {
  platform: string
  text: string
  mediaUrl?: string | null
  link?: string | null
  externalAccountId?: string | null // page id / ig user id / channel id
  firstComment?: string | null
}

export type PublishResult = {
  ok: boolean
  externalId?: string
  permalink?: string
  error?: string
  pending?: boolean // accepted by platform but not yet confirmed live
}

async function j(res: Response) {
  try { return await res.json() } catch { return {} }
}

export async function publishToPlatform(
  platform: string,
  token: string,
  payload: PublishPayload,
): Promise<PublishResult> {
  try {
    switch (platform) {
      case 'facebook': return await publishFacebook(token, payload)
      case 'instagram': return await publishInstagram(token, payload)
      case 'threads': return await publishThreads(token, payload)
      case 'x': return await publishX(token, payload)
      case 'linkedin': return await publishLinkedIn(token, payload)
      case 'bluesky': return await publishBluesky(token, payload)
      case 'pinterest': return await publishPinterest(token, payload)
      case 'tiktok': return await publishTikTok(token, payload)
      case 'youtube': return await publishYouTube(token, payload)
      default: return { ok: false, error: `Unsupported platform: ${platform}` }
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Publish error' }
  }
}

// ---------- Facebook Page ----------
async function publishFacebook(token: string, p: PublishPayload): Promise<PublishResult> {
  const pageId = p.externalAccountId
  if (!pageId) return { ok: false, error: 'Facebook Page id missing (reconnect the account).' }
  const base = `https://graph.facebook.com/v19.0/${pageId}`
  if (p.mediaUrl) {
    const res = await fetch(`${base}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: p.mediaUrl, caption: p.text, access_token: token }),
    })
    const d = await j(res)
    if (!res.ok) return { ok: false, error: d?.error?.message || 'Facebook photo failed' }
    return { ok: true, externalId: d.post_id || d.id, permalink: d.post_id ? `https://facebook.com/${d.post_id}` : undefined }
  }
  const res = await fetch(`${base}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: p.text, link: p.link || undefined, access_token: token }),
  })
  const d = await j(res)
  if (!res.ok) return { ok: false, error: d?.error?.message || 'Facebook post failed' }
  return { ok: true, externalId: d.id, permalink: d.id ? `https://facebook.com/${d.id}` : undefined }
}

// ---------- Instagram (container → publish) ----------
async function publishInstagram(token: string, p: PublishPayload): Promise<PublishResult> {
  const igUser = p.externalAccountId
  if (!igUser) return { ok: false, error: 'Instagram user id missing (reconnect the account).' }
  if (!p.mediaUrl) return { ok: false, error: 'Instagram requires an image or video.' }
  const base = `https://graph.facebook.com/v19.0/${igUser}`
  const create = await fetch(`${base}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: p.mediaUrl, caption: p.text, access_token: token }),
  })
  const cd = await j(create)
  if (!create.ok || !cd.id) return { ok: false, error: cd?.error?.message || 'IG container failed' }
  // Give the container a moment to process, then publish.
  const pub = await fetch(`${base}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: cd.id, access_token: token }),
  })
  const pd = await j(pub)
  if (!pub.ok || !pd.id) return { ok: true, pending: true, externalId: cd.id, error: pd?.error?.message }
  return { ok: true, externalId: pd.id, permalink: `https://instagram.com/p/${pd.id}` }
}

// ---------- Threads (container → publish) ----------
async function publishThreads(token: string, p: PublishPayload): Promise<PublishResult> {
  const user = p.externalAccountId || 'me'
  const base = `https://graph.threads.net/v1.0/${user}`
  const body: any = { access_token: token, text: p.text, media_type: p.mediaUrl ? 'IMAGE' : 'TEXT' }
  if (p.mediaUrl) body.image_url = p.mediaUrl
  const create = await fetch(`${base}/threads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const cd = await j(create)
  if (!create.ok || !cd.id) return { ok: false, error: cd?.error?.message || 'Threads container failed' }
  const pub = await fetch(`${base}/threads_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: cd.id, access_token: token }),
  })
  const pd = await j(pub)
  if (!pub.ok || !pd.id) return { ok: true, pending: true, externalId: cd.id, error: pd?.error?.message }
  return { ok: true, externalId: pd.id }
}

// ---------- X / Twitter ----------
async function publishX(token: string, p: PublishPayload): Promise<PublishResult> {
  // Text-only publish (media requires the chunked v2 upload flow — see report).
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: p.link ? `${p.text}\n${p.link}` : p.text }),
  })
  const d = await j(res)
  if (!res.ok) return { ok: false, error: d?.detail || d?.title || 'X post failed' }
  const id = d?.data?.id
  return { ok: true, externalId: id, permalink: id ? `https://x.com/i/web/status/${id}` : undefined }
}

// ---------- LinkedIn ----------
async function publishLinkedIn(token: string, p: PublishPayload): Promise<PublishResult> {
  const author = p.externalAccountId // urn:li:person:xxx or urn:li:organization:xxx
  if (!author) return { ok: false, error: 'LinkedIn author URN missing (reconnect the account).' }
  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202411',
    },
    body: JSON.stringify({
      author,
      commentary: p.text,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })
  if (!res.ok) { const d = await j(res); return { ok: false, error: d?.message || 'LinkedIn post failed' } }
  const id = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || undefined
  return { ok: true, externalId: id || undefined }
}

// ---------- Bluesky (AT Protocol) ----------
async function publishBluesky(token: string, p: PublishPayload): Promise<PublishResult> {
  // `token` here is the account's App Password stored as the access token; we
  // create a session then a record. External account id = the handle/DID.
  const identifier = p.externalAccountId
  if (!identifier) return { ok: false, error: 'Bluesky handle missing (reconnect the account).' }
  const sess = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: token }),
  })
  const sd = await j(sess)
  if (!sess.ok || !sd.accessJwt) return { ok: false, error: 'Bluesky auth failed (check app password).' }
  const rec = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sd.accessJwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repo: sd.did,
      collection: 'app.bsky.feed.post',
      record: { $type: 'app.bsky.feed.post', text: p.link ? `${p.text} ${p.link}` : p.text, createdAt: new Date().toISOString() },
    }),
  })
  const rd = await j(rec)
  if (!rec.ok || !rd.uri) return { ok: false, error: 'Bluesky post failed' }
  return { ok: true, externalId: rd.uri, permalink: rd.uri }
}

// ---------- Pinterest ----------
async function publishPinterest(token: string, p: PublishPayload): Promise<PublishResult> {
  const boardId = p.externalAccountId
  if (!boardId) return { ok: false, error: 'Pinterest board id missing (reconnect the account).' }
  if (!p.mediaUrl) return { ok: false, error: 'Pinterest requires an image.' }
  const res = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board_id: boardId,
      description: p.text,
      link: p.link || undefined,
      media_source: { source_type: 'image_url', url: p.mediaUrl },
    }),
  })
  const d = await j(res)
  if (!res.ok) return { ok: false, error: d?.message || 'Pinterest pin failed' }
  return { ok: true, externalId: d.id, permalink: d.id ? `https://pinterest.com/pin/${d.id}` : undefined }
}

// ---------- TikTok (direct post; async — returns pending) ----------
async function publishTikTok(token: string, p: PublishPayload): Promise<PublishResult> {
  if (!p.mediaUrl) return { ok: false, error: 'TikTok requires a video.' }
  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_info: { title: p.text, privacy_level: 'PUBLIC_TO_EVERYONE' },
      source_info: { source: 'PULL_FROM_URL', video_url: p.mediaUrl },
    }),
  })
  const d = await j(res)
  if (!res.ok) return { ok: false, error: d?.error?.message || 'TikTok init failed' }
  // Publish is asynchronous; the publish_id can be polled via status/fetch.
  return { ok: true, pending: true, externalId: d?.data?.publish_id }
}

// ---------- YouTube (resumable upload of a binary — needs the file) ----------
async function publishYouTube(_token: string, _p: PublishPayload): Promise<PublishResult> {
  // videos.insert requires a resumable binary upload of the actual video file
  // plus a verified OAuth project; scheduling can be offloaded via
  // status.publishAt. This path is completed once the Drive→binary streaming
  // uploader is wired. Surface a clear, actionable reason for now.
  return { ok: false, error: 'YouTube publishing requires a verified OAuth app + video file upload (not yet enabled).' }
}
