'use client'
import { useState, useEffect } from 'react'
import { Loader2, ListPlus } from 'lucide-react'

type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox'
type CustomField = {
  id: string
  name: string
  field_type: FieldType
  required: boolean
  options?: string[]
}

const inputClass =
  'w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

// Renders whatever Custom Fields the org has defined for `entityType` (client
// or project) and reports values back via onChange as {definitionId: value}.
// Degrades to nothing when no fields are defined or the feature isn't set up.
export default function CustomFieldsSection({
  entityType,
  values,
  onChange,
}: {
  entityType: 'client' | 'project'
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
}) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/custom-fields?entity_type=${entityType}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => setFields(Array.isArray(j) ? j : []))
      .catch(() => setFields([]))
      .finally(() => setLoading(false))
  }, [entityType])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking custom fields…
      </div>
    )
  }

  if (fields.length === 0) return null

  const setValue = (id: string, v: any) => onChange({ ...values, [id]: v })

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
        <ListPlus className="h-4 w-4 text-sky-500" /> Custom Fields
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              {f.name}
              {f.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {f.field_type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={!!values[f.id]}
                  onChange={(e) => setValue(f.id, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Yes
              </label>
            ) : f.field_type === 'dropdown' ? (
              <select
                className={inputClass}
                value={values[f.id] ?? ''}
                onChange={(e) => setValue(f.id, e.target.value)}
                required={f.required}
              >
                <option value="">Select…</option>
                {(f.options || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : 'text'}
                className={inputClass}
                value={values[f.id] ?? ''}
                onChange={(e) => setValue(f.id, e.target.value)}
                required={f.required}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
