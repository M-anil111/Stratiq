'use client'
import { useCallback, useRef, useState } from 'react'
import {
  Image as ImageIcon, Video, UploadCloud, Link2, X, Loader2,
  CheckCircle2, AlertTriangle, Plus,
} from 'lucide-react'
import {
  SOCIAL_MEDIA_SPECS, validateMedia, aspectRatioLabel,
  type PlatformValidation,
} from '@/lib/social-media-specs'

export interface MediaItem {
  url: string
  file_id?: string
  kind: 'image' | 'video' | 'gif'
  name?: string
  width?: number
  height?: number
  durationSec?: number
  sizeMB?: number
  validations?: PlatformValidation[]
  compressedNote?: string
}

interface Props {
  platforms: string[] // selected platform keys (lowercase)
  clientId: string
  media: MediaItem[]
  onChange: (media: MediaItem[]) => void
}

const inputClass = 'w-full bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 placeholder:text-slate-500'

function detectKind(file: File): 'image' | 'video' | 'gif' {
  const type = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  if (type === 'image/gif' || name.endsWith('.gif')) return 'gif'
  if (type.startsWith('video/')) return 'video'
  return 'image'
}

// Reads image dimensions via an off-screen <img>.
function readImageMeta(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }) }
    img.src = url
  })
}

// Reads video dimensions + duration via a metadata-only <video> load.
function readVideoMeta(file: Blob): Promise<{ width: number; height: number; durationSec: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const vid = document.createElement('video')
    vid.preload = 'metadata'
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({ width: vid.videoWidth, height: vid.videoHeight, durationSec: vid.duration })
    }
    vid.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0, durationSec: 0 }) }
    vid.src = url
  })
}

// Best-effort client-side image compression via canvas. Targets the smallest
// selected network's max size. Returns the original file if it can't help.
async function compressImage(file: File, targetMB: number): Promise<{ blob: Blob; note?: string }> {
  const origMB = file.size / (1024 * 1024)
  // Only attempt for images <= 20MB, and only if we're actually over target.
  if (file.type === 'image/gif' || origMB <= targetMB || origMB > 20) return { blob: file }

  const meta = await readImageMeta(file)
  if (!meta.width || !meta.height) return { blob: file }

  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = url
  }).catch(() => null)
  URL.revokeObjectURL(url)
  if (!img) return { blob: file }

  // Scale down progressively and reduce quality until under target (or give up).
  let scale = 1
  const tryEncode = (s: number, q: number): Promise<Blob | null> => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * s))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * s))
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.resolve(null)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', q))
  }

  let best: Blob | null = null
  for (const [s, q] of [[1, 0.82], [0.8, 0.8], [0.6, 0.75], [0.45, 0.7]] as [number, number][]) {
    scale = s
    const blob = await tryEncode(s, q)
    if (blob) {
      best = blob
      if (blob.size / (1024 * 1024) <= targetMB) break
    }
  }
  if (!best || best.size >= file.size) return { blob: file }
  const newMB = best.size / (1024 * 1024)
  return {
    blob: best,
    note: `compressed ${origMB.toFixed(1)}MB → ${newMB.toFixed(1)}MB`,
  }
}

export default function MediaUpload({ platforms, clientId, media, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [manualUrl, setManualUrl] = useState('')

  const smallestImageMax = platforms.reduce((min, p) => {
    const spec = SOCIAL_MEDIA_SPECS[p.toLowerCase()]
    return spec ? Math.min(min, spec.image.maxFileSizeMB) : min
  }, Infinity)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError('')
    if (!clientId) { setError('Pick a client first — uploads go to their Google Drive.'); return }
    const list = Array.from(files)
    if (list.length === 0) return

    setBusy(true)
    try {
      const added: MediaItem[] = []
      for (const file of list) {
        const kind = detectKind(file)

        // Measure dimensions / duration for validation.
        let width = 0, height = 0, durationSec: number | undefined
        if (kind === 'video') {
          const m = await readVideoMeta(file)
          width = m.width; height = m.height; durationSec = m.durationSec
        } else {
          const m = await readImageMeta(file)
          width = m.width; height = m.height
        }

        // Attempt compression for images when it can help.
        let uploadBlob: Blob = file
        let uploadName = file.name
        let compressedNote: string | undefined
        if (kind === 'image' && isFinite(smallestImageMax)) {
          const { blob, note } = await compressImage(file, smallestImageMax)
          uploadBlob = blob
          compressedNote = note
          if (note && !/\.(jpe?g)$/i.test(uploadName)) {
            uploadName = uploadName.replace(/\.[a-z0-9]+$/i, '') + '.jpg'
          }
        }

        const sizeMB = uploadBlob.size / (1024 * 1024)
        const validations = validateMedia(
          { size: uploadBlob.size, type: file.type, name: uploadName },
          { width, height, durationSec },
          platforms,
        )

        // Upload the (possibly compressed) file to Drive.
        const fd = new FormData()
        fd.append('file', uploadBlob, uploadName)
        fd.append('client_id', clientId)
        const res = await fetch('/api/social/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) { setError(data?.error || 'Upload failed.'); continue }

        added.push({
          url: data.url,
          file_id: data.file_id,
          kind,
          name: uploadName,
          width, height, durationSec, sizeMB,
          validations,
          compressedNote,
        })
      }
      if (added.length) onChange([...media, ...added])
    } catch {
      setError('Network error during upload.')
    } finally {
      setBusy(false)
    }
  }, [clientId, platforms, media, onChange, smallestImageMax])

  function addManualUrl() {
    const u = manualUrl.trim()
    if (!u) return
    const kind: MediaItem['kind'] = /\.(mp4|mov|m4v|webm|mpeg)$/i.test(u) ? 'video' : /\.gif$/i.test(u) ? 'gif' : 'image'
    onChange([...media, { url: u, kind, name: u }])
    setManualUrl('')
  }

  function removeAt(i: number) {
    onChange(media.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      {!clientId && (
        <div className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> Select a client above — media is uploaded to their Google Drive.
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => clientId && !busy && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-disabled={!clientId}
        className={`rounded-xl border border-dashed p-6 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-sky-400 bg-sky-500/10' : 'border-white/[0.14] bg-white/[0.03] hover:bg-white/[0.05]'
        } ${(!clientId || busy) ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
        />
        {busy ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </div>
        ) : (
          <div className="text-sm text-slate-400">
            <UploadCloud className="h-6 w-6 mx-auto mb-2 text-slate-500" />
            <span className="text-slate-300 font-medium">Drop images or video</span> or click to browse
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {/* Manual URL add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualUrl() } }}
            placeholder="Or paste a media URL…"
            className={inputClass + ' pl-8'}
          />
        </div>
        <button
          type="button"
          onClick={addManualUrl}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {/* Media list */}
      {media.length > 0 && (
        <div className="space-y-2.5">
          {media.map((m, i) => (
            <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.08] shrink-0 flex items-center justify-center text-slate-600">
                {m.kind === 'video' ? (
                  <Video className="h-5 w-5" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.name || 'media'} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {m.kind === 'video' ? <Video className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ImageIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                  <span className="text-xs text-slate-300 truncate">{m.name || m.url}</span>
                  <button type="button" onClick={() => removeAt(i)} aria-label="Remove" className="ml-auto text-slate-500 hover:text-red-400 shrink-0"><X className="h-4 w-4" /></button>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {m.width && m.height ? `${m.width}×${m.height} · ${aspectRatioLabel(m.width, m.height)}` : null}
                  {m.durationSec ? ` · ${Math.round(m.durationSec)}s` : ''}
                  {m.sizeMB ? ` · ${m.sizeMB.toFixed(1)}MB` : ''}
                </div>
                {m.compressedNote && (
                  <div className="text-[11px] text-emerald-400 mt-0.5">{m.compressedNote}</div>
                )}
                {/* Per-network pass / warning chips */}
                {m.validations && m.validations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.validations.map((v) => (
                      <span
                        key={v.platform}
                        title={v.warnings.join('; ')}
                        className={`text-[10px] px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 ${
                          v.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {v.ok
                          ? <><CheckCircle2 className="h-3 w-3" /> {v.label}</>
                          : <><AlertTriangle className="h-3 w-3" /> {v.label}: {v.warnings[0]}</>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
