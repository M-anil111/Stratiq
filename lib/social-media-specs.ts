// Per-network media specifications and validation helpers for the Social composer.
//
// Sources: Bluesky / Threads / YouTube values are as provided by the user.
// Facebook / Instagram / LinkedIn / X / TikTok values are well-known, current,
// documented platform limits (approximate — platforms change these over time).
//
// Aspect ratios are stored as numbers (width / height). e.g. 0.8 = 4:5 (portrait),
// 1.91 = landscape link card, 1.0 = square.
//
// NOTE: Nothing here transcodes video. Video is validated only (size / length /
// aspect / file type). Images may be client-side compressed by the uploader, but
// that logic lives in the component; these specs only describe the targets.

export interface ImageSpec {
  maxImagesPerPost: number
  maxFileSizeMB: number
  aspectRatioMin: number
  aspectRatioMax: number
  gifSupport: boolean
}

export interface VideoSpec {
  maxFileSizeMB: number
  minLenSec: number
  maxLenSec: number
  aspectRatioMin: number
  aspectRatioMax: number
  fileTypes: string[]
}

export interface PlatformSpec {
  label: string
  image: ImageSpec
  video: VideoSpec
}

export const SOCIAL_MEDIA_SPECS: Record<string, PlatformSpec> = {
  // Facebook — feed posts. Approximate documented values.
  facebook: {
    label: 'Facebook',
    image: {
      maxImagesPerPost: 10,
      maxFileSizeMB: 30,
      aspectRatioMin: 0.5, // ~1:2
      aspectRatioMax: 1.91, // link card landscape
      gifSupport: true,
    },
    video: {
      maxFileSizeMB: 4096, // up to ~4GB
      minLenSec: 1,
      maxLenSec: 14400, // 240 min
      aspectRatioMin: 0.5,
      aspectRatioMax: 1.78, // 16:9
      fileTypes: ['mp4', 'mov'],
    },
  },
  // Instagram — feed. Aspect 4:5 (0.8) to 1.91:1 landscape. Approximate.
  instagram: {
    label: 'Instagram',
    image: {
      maxImagesPerPost: 10,
      maxFileSizeMB: 30,
      aspectRatioMin: 0.8, // 4:5 portrait
      aspectRatioMax: 1.91, // landscape
      gifSupport: false, // IG converts GIFs; treated as unsupported still
    },
    video: {
      maxFileSizeMB: 650, // reels ~ up to 650MB / feed varies
      minLenSec: 3,
      maxLenSec: 900, // 15 min feed video
      aspectRatioMin: 0.5625, // 9:16 reels
      aspectRatioMax: 1.78, // 16:9
      fileTypes: ['mp4', 'mov'],
    },
  },
  // LinkedIn — up to 9 images. Approximate.
  linkedin: {
    label: 'LinkedIn',
    image: {
      maxImagesPerPost: 9,
      maxFileSizeMB: 10,
      aspectRatioMin: 0.42,
      aspectRatioMax: 2.4,
      gifSupport: true,
    },
    video: {
      maxFileSizeMB: 5120, // ~5GB
      minLenSec: 3,
      maxLenSec: 600, // 10 min
      aspectRatioMin: 0.5625,
      aspectRatioMax: 2.4,
      fileTypes: ['mp4', 'mov', 'avi', 'webm'],
    },
  },
  // X (Twitter) — 4 images OR 1 video up to 2:20 (140s) for standard accounts.
  x: {
    label: 'X',
    image: {
      maxImagesPerPost: 4,
      maxFileSizeMB: 5,
      aspectRatioMin: 0.33, // 1:3
      aspectRatioMax: 3, // 3:1
      gifSupport: true,
    },
    video: {
      maxFileSizeMB: 512,
      minLenSec: 1,
      maxLenSec: 140, // 2:20
      aspectRatioMin: 0.33,
      aspectRatioMax: 3,
      fileTypes: ['mp4', 'mov'],
    },
  },
  // TikTok — video-first. Approximate.
  tiktok: {
    label: 'TikTok',
    image: {
      maxImagesPerPost: 35, // photo mode
      maxFileSizeMB: 20,
      aspectRatioMin: 0.5625, // 9:16
      aspectRatioMax: 1.78,
      gifSupport: false,
    },
    video: {
      maxFileSizeMB: 4096,
      minLenSec: 3,
      maxLenSec: 600, // 10 min
      aspectRatioMin: 0.5625, // 9:16 vertical
      aspectRatioMax: 1.78,
      fileTypes: ['mp4', 'mov', 'webm'],
    },
  },
  // YouTube — video only (user provided). mp4/m4v, max 15 min (longer if verified),
  // max 1GB (here), 16:9; 9:16 under 3 min becomes a Short.
  youtube: {
    label: 'YouTube',
    image: {
      // YouTube posts don't take feed images in this composer; keep a nominal spec.
      maxImagesPerPost: 1,
      maxFileSizeMB: 2,
      aspectRatioMin: 1.0,
      aspectRatioMax: 1.78,
      gifSupport: false,
    },
    video: {
      maxFileSizeMB: 1024, // 1GB (per user)
      minLenSec: 1,
      maxLenSec: 900, // 15 min (longer with verified account)
      aspectRatioMin: 0.5625, // 9:16 (Shorts if < 3 min)
      aspectRatioMax: 1.78, // 16:9
      fileTypes: ['mp4', 'm4v'],
    },
  },
  // Bluesky (user provided): images/post 4, max 1MB (compress if <= 20MB),
  // any aspect (scale if taller than 1:2), GIF 1/post; video mov/mpeg/mp4,
  // 1/post, 1-180s, max 25 videos / 1GB daily, SRT captions.
  bluesky: {
    label: 'Bluesky',
    image: {
      maxImagesPerPost: 4,
      maxFileSizeMB: 1,
      aspectRatioMin: 0.5, // 1:2 — taller than this gets scaled
      aspectRatioMax: 100, // effectively any wide aspect allowed
      gifSupport: true, // 1 GIF per post
    },
    video: {
      maxFileSizeMB: 1024, // 1GB daily cap (per-video practical ceiling)
      minLenSec: 1,
      maxLenSec: 180,
      aspectRatioMin: 0.5,
      aspectRatioMax: 100,
      fileTypes: ['mov', 'mpeg', 'mp4'],
    },
  },
  // Threads (user provided): images/post 20, max 8MB, aspect 1:10-10:1,
  // GIF as still; video mp4/mov, 1/post, 3-500s, aspect 1:3-3:1, 23-60fps.
  threads: {
    label: 'Threads',
    image: {
      maxImagesPerPost: 20,
      maxFileSizeMB: 8,
      aspectRatioMin: 0.1, // 1:10
      aspectRatioMax: 10, // 10:1
      gifSupport: false, // GIF rendered as still
    },
    video: {
      maxFileSizeMB: 1024,
      minLenSec: 3,
      maxLenSec: 500,
      aspectRatioMin: 0.333, // 1:3
      aspectRatioMax: 3, // 3:1
      fileTypes: ['mp4', 'mov'],
    },
  },
}

export type MediaKind = 'image' | 'video' | 'gif'

export interface MediaMeta {
  width: number
  height: number
  durationSec?: number
  sizeMB?: number
  kind?: MediaKind
  fileType?: string // extension, lowercase, no dot
}

export interface PlatformValidation {
  platform: string
  label: string
  ok: boolean
  warnings: string[]
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

// Returns a friendly aspect-ratio label like "4:5" or "16:9".
export function aspectRatioLabel(w: number, h: number): string {
  if (!w || !h) return '—'
  const g = gcd(Math.round(w), Math.round(h)) || 1
  const rw = Math.round(w) / g
  const rh = Math.round(h) / g
  // Collapse awkward ratios to a decimal for readability.
  if (rw > 40 || rh > 40) return (w / h).toFixed(2) + ':1'
  return `${rw}:${rh}`
}

function detectKind(file: { type?: string; name?: string }): MediaKind {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  if (type === 'image/gif' || name.endsWith('.gif')) return 'gif'
  if (type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mpeg|avi)$/.test(name)) return 'video'
  return 'image'
}

function fileExt(file: { name?: string; type?: string }): string {
  const name = (file.name || '').toLowerCase()
  const m = name.match(/\.([a-z0-9]+)$/)
  if (m) return m[1]
  const type = (file.type || '').toLowerCase()
  const t = type.split('/')[1]
  return t || ''
}

/**
 * Validate a single file (with its measured dimensions/duration) against the
 * selected platforms. Returns one result per platform. Warnings never block —
 * they inform the composer, mirroring how the schedulers surface warnings.
 */
export function validateMedia(
  file: { size?: number; type?: string; name?: string },
  meta: { width: number; height: number; durationSec?: number },
  platforms: string[],
): PlatformValidation[] {
  const kind = detectKind(file)
  const isVideo = kind === 'video'
  const sizeMB = typeof file.size === 'number' ? file.size / (1024 * 1024) : undefined
  const ext = fileExt(file)
  const aspect = meta.width && meta.height ? meta.width / meta.height : undefined

  return platforms.map((raw) => {
    const platform = raw.toLowerCase()
    const spec = SOCIAL_MEDIA_SPECS[platform]
    const label = spec?.label || raw
    const warnings: string[] = []

    if (!spec) {
      return { platform, label, ok: true, warnings: [] }
    }

    if (isVideo) {
      const v = spec.video
      if (sizeMB !== undefined && sizeMB > v.maxFileSizeMB) {
        warnings.push(`video ${sizeMB.toFixed(1)}MB exceeds ${v.maxFileSizeMB}MB limit`)
      }
      if (ext && v.fileTypes.length && !v.fileTypes.includes(ext)) {
        warnings.push(`file type .${ext} not supported (allowed: ${v.fileTypes.join(', ')})`)
      }
      if (meta.durationSec !== undefined) {
        if (meta.durationSec < v.minLenSec) {
          warnings.push(`video too short (${Math.round(meta.durationSec)}s < ${v.minLenSec}s min)`)
        }
        if (meta.durationSec > v.maxLenSec) {
          warnings.push(`video too long (${Math.round(meta.durationSec)}s > ${v.maxLenSec}s max)`)
        }
      }
      if (aspect !== undefined && (aspect < v.aspectRatioMin || aspect > v.aspectRatioMax)) {
        warnings.push(
          `aspect ratio ${aspectRatioLabel(meta.width, meta.height)} out of range`,
        )
      }
    } else {
      const img = spec.image
      if (kind === 'gif' && !img.gifSupport) {
        warnings.push('GIF not supported (may render as a still image)')
      }
      if (sizeMB !== undefined && sizeMB > img.maxFileSizeMB) {
        warnings.push(`image ${sizeMB.toFixed(1)}MB exceeds ${img.maxFileSizeMB}MB limit`)
      }
      if (aspect !== undefined && (aspect < img.aspectRatioMin || aspect > img.aspectRatioMax)) {
        warnings.push(
          `aspect ratio ${aspectRatioLabel(meta.width, meta.height)} out of range`,
        )
      }
    }

    return { platform, label, ok: warnings.length === 0, warnings }
  })
}
