'use client'
import { useState, useEffect } from 'react'
import { Loader2, Users, Check } from 'lucide-react'
import MultiSelectPeople, { PersonOption } from './ui/MultiSelectPeople'

export type ResourceAssignments = {
  seo: string[]
  ppc: string[]
  content: string[]
  video: string[]
  social_media: string[]
}

const EMPTY: ResourceAssignments = { seo: [], ppc: [], content: [], video: [], social_media: [] }

const DELIVERABLES: { key: keyof ResourceAssignments; label: string }[] = [
  { key: 'seo', label: 'SEO Resource' },
  { key: 'ppc', label: 'PPC Resource' },
  { key: 'content', label: 'Content Resource' },
  { key: 'video', label: 'Video Resource' },
  { key: 'social_media', label: 'Social Media Resource' },
]

function normalize(value: any): ResourceAssignments {
  return {
    seo: Array.isArray(value?.seo) ? value.seo : [],
    ppc: Array.isArray(value?.ppc) ? value.ppc : [],
    content: Array.isArray(value?.content) ? value.content : [],
    video: Array.isArray(value?.video) ? value.video : [],
    social_media: Array.isArray(value?.social_media) ? value.social_media : [],
  }
}

// Displays + persists granular per-deliverable resource assignments directly
// on the project detail page, following the same fetch-and-PATCH convention
// as CustomFieldsEditor: local edit state + an explicit Save button that
// PATCHes the project with { resource_assignments }.
export default function ResourceAssignmentsEditor({
  patchUrl,
  initialValue,
  onSaved,
}: {
  patchUrl: string
  initialValue: any
  onSaved?: (value: ResourceAssignments) => void
}) {
  const [users, setUsers] = useState<PersonOption[]>([])
  const [value, setValue] = useState<ResourceAssignments>(normalize(initialValue))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setValue(normalize(initialValue))
    setDirty(false)
  }, [initialValue])

  useEffect(() => {
    let cancelled = false
    fetch('/api/users')
      .then(r => (r.ok ? r.json() : []))
      .then((u) => { if (!cancelled && Array.isArray(u)) setUsers(u) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const handleChange = (key: keyof ResourceAssignments) => (ids: string[]) => {
    setValue(v => ({ ...v, [key]: ids }))
    setDirty(true)
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_assignments: value }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to save resource assignments')
      }
      setDirty(false)
      setSaved(true)
      onSaved?.(value)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message || 'Failed to save resource assignments')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-sky-400" />
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resource Assignments</h3>
      </div>
      <div className="space-y-4">
        {DELIVERABLES.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
            <MultiSelectPeople options={users} value={value[key]} onChange={handleChange(key)} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 px-1">
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="btn-brand flex items-center gap-2 px-4 py-2 disabled:opacity-50 rounded-lg text-sm font-medium"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Resource Assignments'}
        </button>
      </div>
    </div>
  )
}
