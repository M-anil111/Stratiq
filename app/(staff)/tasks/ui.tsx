'use client'
import { Person, PHLabel, PHCustomFieldLite } from './types'

// Deterministic color for an avatar chip based on id/name.
const AVATAR_COLORS = [
  'from-sky-400 to-blue-600',
  'from-violet-400 to-purple-600',
  'from-emerald-400 to-teal-600',
  'from-amber-400 to-orange-600',
  'from-rose-400 to-pink-600',
  'from-cyan-400 to-sky-600',
  'from-indigo-400 to-blue-600',
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')
}

export function Avatar({ person, size = 24 }: { person: Person | undefined; size?: number }) {
  if (!person) return null
  const color = AVATAR_COLORS[person.id % AVATAR_COLORS.length]
  const style = { width: size, height: size, fontSize: size * 0.4 }
  if (person.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={person.avatar}
        alt={person.name}
        title={person.name}
        className="rounded-full object-cover ring-2 ring-white dark:ring-[#0f1e35]"
        style={style}
      />
    )
  }
  return (
    <span
      title={person.name}
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br ${color} text-white font-semibold ring-2 ring-white dark:ring-[#0f1e35]`}
      style={style}
    >
      {initials(person.name)}
    </span>
  )
}

export function AvatarStack({ ids, people, size = 24 }: { ids: number[]; people: Person[]; size?: number }) {
  const map = new Map(people.map((p) => [p.id, p]))
  const shown = ids.slice(0, 4)
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((id) => (
        <Avatar key={id} person={map.get(id)} size={size} />
      ))}
      {ids.length > shown.length && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold ring-2 ring-white dark:ring-[#0f1e35]"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
        >
          +{ids.length - shown.length}
        </span>
      )}
    </div>
  )
}

// Map a ProofHub label color to tailwind-ish inline styles. ProofHub returns
// hex-ish strings; fall back to a neutral pill.
export function LabelPill({ label }: { label: PHLabel }) {
  const color = label.color && /^#?[0-9a-fA-F]{3,8}$/.test(label.color)
    ? (label.color.startsWith('#') ? label.color : `#${label.color}`)
    : null
  if (color) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
        style={{ backgroundColor: `${color}22`, color, borderColor: `${color}55` }}
      >
        {label.name}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-900/[0.05] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-slate-900/10 dark:border-white/10">
      {label.name}
    </span>
  )
}

// ProofHub's "priority" custom field — an opt-in per-todolist field, so this
// renders whatever label the field's current value resolves to, or nothing
// if the task's list doesn't have one configured.
export function PriorityPill({ customFields }: { customFields: PHCustomFieldLite[] | undefined }) {
  const field = customFields?.find((f) => (f.type || '').toLowerCase() === 'priority')
  if (!field) return null
  const rawValue = Array.isArray(field.value) ? field.value[0] : field.value
  if (rawValue == null || rawValue === '') return null
  const option = field.options?.find((o) => String(o.id) === String(rawValue))
  const label = option?.label ?? String(rawValue)
  const color = option?.color && /^#?[0-9a-fA-F]{3,8}$/.test(option.color)
    ? (option.color.startsWith('#') ? option.color : `#${option.color}`)
    : null
  if (color) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border"
        style={{ backgroundColor: `${color}22`, color, borderColor: `${color}55` }}
      >
        {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
      {label}
    </span>
  )
}

export function formatDue(due: string | null | undefined): { text: string; tone: string } | null {
  if (!due) return null
  const d = new Date(due + (due.length <= 10 ? 'T00:00:00' : ''))
  if (Number.isNaN(d.getTime())) return { text: due, tone: 'text-slate-500' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000)
  const text = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (diff < 0) return { text, tone: 'text-red-600 dark:text-red-400' }
  if (diff === 0) return { text: 'Today', tone: 'text-amber-600 dark:text-amber-400' }
  if (diff === 1) return { text: 'Tomorrow', tone: 'text-sky-600 dark:text-sky-400' }
  return { text, tone: 'text-slate-500 dark:text-slate-400' }
}

// Bucket a due date into My-Tasks groups.
export function dueBucket(due: string | null | undefined): 'today' | 'upcoming' | 'later' | 'none' {
  if (!due) return 'none'
  const d = new Date(due + (due.length <= 10 ? 'T00:00:00' : ''))
  if (Number.isNaN(d.getTime())) return 'none'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000)
  if (diff <= 0) return 'today'
  if (diff <= 7) return 'upcoming'
  return 'later'
}
