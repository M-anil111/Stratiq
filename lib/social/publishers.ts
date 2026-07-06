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
  mediaUrls?: string[] | null   // for carousels / multi-image
  isVideo?: boolean             // true when the media is a video/reel
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

import { fetchMediaBytes, isVideoType, chunk } from '@/lib/social/media'

async function j(res: Response) {
  try { return await res.json() } catch { return {} }
}

function mediaList(p: PublishPayload): string[] {
  if (p.mediaUrls && p.mediaUrls.length) return p.mediaUrls.filter(Boolean)
  return p.mediaUrl ? [p.mediaUrl] : []
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

// ---------- Instagram (container → publish; image / video-Reels / carousel) ----------
async function publishInstagram(token: string, p: PublishPayload): Promise<PublishResult> {
  const igUser = p.externalAccountId
  if (!igUser) return { ok: false, error: 'Instagram user id missing (reconnect the account).' }
  const media = mediaList(p)
  if (media.length === 0) return { ok: false, error: 'Instagram requires an image or video.' }
  const base = `https://graph.facebook.com/v19.0/${igUser}`

  const createContainer = async (body: Record<string, any>): Promise<{ id?: string; error?: string }> => {
    const res = await fetch(`${base}/media`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: token }),
    })
    const d = await j(res)
    if (!res.ok || !d.id) return { error: d?.error?.message || 'IG container failed' }
    return { id: d.id }
  }

  // Poll a container until it's FINISHED (videos process asynchronously).
  const waitReady = async (containerId: string) => {
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${base.replace(`/${igUser}`, '')}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`)
      const d = await j(res)
      if (d.status_code === 'FINISHED') return true
      if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') return false
      await new Promise(r => setTimeout(r, 3000))
    }
    return false
  }

  let creationId: string | undefined

  if (media.length > 1) {
    // Carousel: one child container per item, then a CAROUSEL parent.
    const childIds: string[] = []
    for (const url of media.slice(0, 10)) {
      const child = await createContainer(p.isVideo ? { video_url: url, media_type: 'VIDEO', is_carousel_item: true } : { image_url: url, is_carousel_item: true })
      if (!child.id) return { ok: false, error: child.error }
      if (p.isVideo) await waitReady(child.id)
      childIds.push(child.id)
    }
    const parent = await createContainer({ media_type: 'CAROUSEL', caption: p.text, children: childIds.join(',') })
    if (!parent.id) return { ok: false, error: parent.error }
    creationId = parent.id
  } else if (p.isVideo) {
    const c = await createContainer({ video_url: media[0], media_type: 'REELS', caption: p.text })
    if (!c.id) return { ok: false, error: c.error }
    const ready = await waitReady(c.id)
    if (!ready) return { ok: true, pending: true, externalId: c.id, error: 'Video still processing.' }
    creationId = c.id
  } else {
    const c = await createContainer({ image_url: media[0], caption: p.text })
    if (!c.id) return { ok: false, error: c.error }
    creationId = c.id
  }

  const pub = await fetch(`${base}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  })
  const pd = await j(pub)
  if (!pub.ok || !pd.id) return { ok: true, pending: true, externalId: creationId, error: pd?.error?.message }
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

// ---------- X / Twitter (text + chunked media upload) ----------
async function publishX(token: string, p: PublishPayload): Promise<PublishResult> {
  const media = mediaList(p)
  let mediaIds: string[] = []

  if (media.length) {
    try {
      // X allows up to 4 images or 1 video per post.
      const toUpload = p.isVideo ? media.slice(0, 1) : media.slice(0, 4)
      for (const url of toUpload) {
        const id = await xUploadMedia(token, url, p.isVideo === true)
        if (id) mediaIds.push(id)
      }
    } catch (e: any) {
      return { ok: false, error: `X media upload failed: ${e?.message || 'error'}` }
    }
  }

  const body: any = { text: p.link ? `${p.text}\n${p.link}` : p.text }
  if (mediaIds.length) body.media = { media_ids: mediaIds }
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await j(res)
  if (!res.ok) return { ok: false, error: d?.detail || d?.title || 'X post failed' }
  const id = d?.data?.id
  return { ok: true, externalId: id, permalink: id ? `https://x.com/i/web/status/${id}` : undefined }
}

// Chunked upload (INIT → APPEND → FINALIZE), polling processing for video.
async function xUploadMedia(token: string, url: string, isVideo: boolean): Promise<string | null> {
  const { bytes, contentType } = await fetchMediaBytes(url)
  const category = isVideo || isVideoType(contentType) ? 'tweet_video' : 'tweet_image'
  const auth = { Authorization: `Bearer ${token}` }
  const CHUNK = 5 * 1024 * 1024 // 5MB max per APPEND

  // INIT
  const initForm = new FormData()
  initForm.set('command', 'INIT')
  initForm.set('total_bytes', String(bytes.byteLength))
  initForm.set('media_type', contentType)
  initForm.set('media_category', category)
  const initRes = await fetch('https://api.x.com/2/media/upload', { method: 'POST', headers: auth, body: initForm })
  const initData = await j(initRes)
  const mediaId = initData?.data?.id || initData?.media_id_string || initData?.media_id
  if (!initRes.ok || !mediaId) throw new Error(initData?.detail || 'INIT failed')

  // APPEND
  for (const { index, blob } of chunk(bytes, CHUNK)) {
    const form = new FormData()
    form.set('command', 'APPEND')
    form.set('media_id', String(mediaId))
    form.set('segment_index', String(index))
    form.set('media', blob)
    const apRes = await fetch('https://api.x.com/2/media/upload', { method: 'POST', headers: auth, body: form })
    if (!apRes.ok) throw new Error('APPEND failed')
  }

  // FINALIZE
  const finForm = new FormData()
  finForm.set('command', 'FINALIZE')
  finForm.set('media_id', String(mediaId))
  const finRes = await fetch('https://api.x.com/2/media/upload', { method: 'POST', headers: auth, body: finForm })
  const finData = await j(finRes)
  if (!finRes.ok) throw new Error('FINALIZE failed')

  // Poll processing (videos)
  let info = finData?.data?.processing_info || finData?.processing_info
  for (let i = 0; info && info.state && info.state !== 'succeeded' && i < 20; i++) {
    if (info.state === 'failed') throw new Error('media processing failed')
    await new Promise(r => setTimeout(r, (info.check_after_secs || 3) * 1000))
    const stRes = await fetch(`https://api.x.com/2/media/upload?command=STATUS&media_id=${mediaId}`, { headers: auth })
    const st = await j(stRes)
    info = st?.data?.processing_info || st?.processing_info
  }
  return String(mediaId)
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

// ---------- YouTube (resumable upload) ----------
async function publishYouTube(token: string, p: PublishPayload): Promise<PublishResult> {
  const media = mediaList(p)
  if (!media.length) return { ok: false, error: 'YouTube requires a video file.' }
  let fetched
  try { fetched = await fetchMediaBytes(media[0]) } catch (e: any) { return { ok: false, error: `Fetch video failed: ${e?.message}` } }

  const title = (p.text || 'Video').slice(0, 100)
  const meta = {
    snippet: { title, description: p.text || '' },
    status: { privacyStatus: 'public' as const },
  }

  // 1) Start a resumable session.
  const start = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': fetched.contentType || 'video/*',
      'X-Upload-Content-Length': String(fetched.size),
    },
    body: JSON.stringify(meta),
  })
  if (!start.ok) { const d = await j(start); return { ok: false, error: d?.error?.message || 'YouTube session init failed' } }
  const uploadUrl = start.headers.get('location')
  if (!uploadUrl) return { ok: false, error: 'YouTube upload URL missing' }

  // 2) Upload the bytes (single PUT — Vercel body limits permitting; large
  //    videos may need chunked PUTs with Content-Range in a follow-up).
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': fetched.contentType || 'video/*' },
    body: fetched.bytes,
  })
  const pd = await j(put)
  if (!put.ok || !pd.id) return { ok: false, error: pd?.error?.message || 'YouTube upload failed' }
  return { ok: true, externalId: pd.id, permalink: `https://youtube.com/watch?v=${pd.id}` }
}
