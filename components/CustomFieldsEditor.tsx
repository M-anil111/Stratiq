'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, ListPlus, Check } from 'lucide-react'
import CustomFieldsSection from './CustomFieldsSection'

type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox'
type CustomField = { id: string; name: string; field_type: FieldType; required: boolean; options?: string[] }

// Displays + persists custom field values directly on an entity detail page.
// Wraps CustomFieldsSection (which renders the inputs) with its own fetch of
// field definitions (just to know whether any exist, so we can skip rendering
// the wrapping card + save button entirely when there are none) and a Save
// button that PATCHes `patchUrl` with { [fieldKey]: values }.
export default function CustomFieldsEditor({
  entityType,
  patchUrl,
  initialValues,
  fieldKey = 'custom_field_values',
  onSaved,
}: {
  entityType: 'client' | 'project'
  patchUrl: string
  initialValues: Record<string, any> | null | undefined
  fieldKey?: string
  onSaved?: (values: Record<string, any>) => void
}) {
  const [hasFields, setHasFields] = useState<boolean | null>(null)
  const [values, setValues] = useState<Record<string, any>>(initialValues || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setValues(initialValues || {})
    setDirty(false)
  }, [initialValues])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/settings/custom-fields?entity_type=${entityType}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((j: CustomField[]) => { if (!cancelled) setHasFields(Array.isArray(j) && j.length > 0) })
      .catch(() => { if (!cancelled) setHasFields(false) })
    return () => { cancelled = true }
  }, [entityType])

  const handleChange = useCallback((next: Record<string, any>) => {
    setValues(next)
    setDirty(true)
    setSaved(false)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldKey]: values }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to save custom fields')
      }
      setDirty(false)
      setSaved(true)
      onSaved?.(values)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message || 'Failed to save custom fields')
    } finally {
      setSaving(false)
    }
  }

  if (hasFields === false) return null

  return (
    <div className="space-y-2">
      <CustomFieldsSection entityType={entityType} values={values} onChange={handleChange} />
      {hasFields && (
        <div className="flex items-center justify-end gap-3 px-1">
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="btn-brand flex items-center gap-2 px-4 py-2 disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <ListPlus className="h-4 w-4" />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Custom Fields'}
          </button>
        </div>
      )}
    </div>
  )
}
