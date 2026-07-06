// Media helpers for publishing paths that need the raw bytes (chunked/resumable
// uploads) rather than a public URL. Media is hosted (Drive/public URL) by the
// time we publish; here we stream it back for platforms that require a binary
// upload (X video/image, YouTube resumable).

export type FetchedMedia = {
  bytes: ArrayBuffer
  contentType: string
  size: number
}

export async function fetchMediaBytes(url: string): Promise<FetchedMedia> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch media (${res.status})`)
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const bytes = await res.arrayBuffer()
  return { bytes, contentType, size: bytes.byteLength }
}

export function isVideoType(contentType: string) {
  return contentType.startsWith('video/')
}

// Split an ArrayBuffer into <=chunkSize slices (for chunked uploads).
export function chunk(bytes: ArrayBuffer, chunkSize: number): { index: number; blob: Blob }[] {
  const out: { index: number; blob: Blob }[] = []
  const total = bytes.byteLength
  let index = 0
  for (let offset = 0; offset < total; offset += chunkSize, index++) {
    const slice = bytes.slice(offset, Math.min(offset + chunkSize, total))
    out.push({ index, blob: new Blob([slice]) })
  }
  return out
}
