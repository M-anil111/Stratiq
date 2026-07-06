'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Loader2, X, Info } from 'lucide-react'
import { InfoHint } from '@/components/ui/InfoHint'

type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox'
type EntityType = 'client' | 'project'

interface CustomField {
  id: string
  name: string
  field_type: FieldType
  required: boolean
  entity_type: EntityType
  position?: number
}

const FIELD_TYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'A single line of free text — names, IDs, short notes.' },
  { value: 'number', label: 'Number', hint: 'Numeric values only — counts, amounts, scores.' },
  { value: 'date', label: 'Date', hint: 'A calendar date, shown with a date picker.' },
  { value: 'dropdown', label: 'Dropdown', hint: 'A choice from a preset list of options. Tip: reusable option lists are managed under Data Sets.' },
  { value: 'checkbox', label: 'Checkbox', hint: 'A simple yes / no (true / false) toggle.' },
]

const selectClass =
  'w-full bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

const tabs: { label: string; entity: EntityType }[] = [
  { label: 'Client Fields', entity: 'client' },
  { label: 'Project Fields', entity: 'project' },
]

export default function CustomFieldsPage() {
  const [activeTab, setActiveTab] = useState(0)
  const entity = tabs[activeTab].entity

  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalName, setModalName] = useState('')
  const [modalType, setModalType] = useState<FieldType>('text')
  const [modalRequired, setModalRequired] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/settings/custom-fields?entity_type=${entity}`)
      .then(r => r.json())
      .then(d => setFields(Array.isArray(d) ? d : []))
      .catch(() => setFields([]))
      .finally(() => setLoading(false))
  }, [entity])

  useEffect(() => {
    if (showModal) setTimeout(() => nameInputRef.current?.focus(), 50)
  }, [showModal])

  function openModal() {
    setModalName('')
    setModalType('text')
    setModalRequired(false)
    setModalError('')
    setShowModal(true)
  }

  async function saveField() {
    if (!modalName.trim()) { setModalError('Field name is required'); return }
    setModalSaving(true)
    setModalError('')
    try {
      const res = await fetch('/api/settings/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modalName.trim(), field_type: modalType, required: modalRequired, entity_type: entity }),
      })
      const data = await res.json()
      if (!res.ok) { setModalError(data.error || 'Failed to save'); setModalSaving(false); return }
      setFields(prev => [...prev, data])
      setShowModal(false)
    } catch {
      setModalError('Network error')
    }
    setModalSaving(false)
  }

  async function deleteField(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/settings/custom-fields?id=${id}`, { method: 'DELETE' })
      setFields(prev => prev.filter(f => f.id !== id))
    } catch {}
    setDeleting(null)
    setConfirmDeleteId(null)
  }

  async function toggleRequired(field: CustomField) {
    const updated = { ...field, required: !field.required }
    setFields(prev => prev.map(f => f.id === field.id ? updated : f))
    await fetch('/api/settings/custom-fields', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: field.id, required: updated.required }),
    }).catch(() => setFields(prev => prev.map(f => f.id === field.id ? field : f)))
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Custom Fields</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Define extra fields to capture on clients and projects</p>
      </div>

      {/* What are custom fields? */}
      <div className="glass-card p-4 mb-6 flex gap-3">
        <div className="shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-sky-500/15 text-sky-500 dark:text-sky-400 flex items-center justify-center">
          <Info className="h-4 w-4" />
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          <span className="font-medium text-slate-900 dark:text-white">Custom fields let admins capture extra information</span> on
          each client or project beyond the built-in fields. For example, add a "Contract renewal date" to clients or a
          "Kick-off owner" to projects. Fields you define here appear on the matching record's create and edit forms,
          in the order they are listed.
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-900/10 dark:border-white/[0.08] mb-6">
        {tabs.map((tab, i) => (
          <button key={tab.entity} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === i ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-900/10 dark:border-white/[0.08] flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            {tabs[activeTab].label}
            <InfoHint content={`Extra fields shown on every ${entity} record. Drag-free ordering follows the order fields are added.`} />
          </h2>
          <button onClick={openModal} className="btn-brand flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Field
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 opacity-40" />
            <p className="text-sm">Loading fields…</p>
          </div>
        ) : fields.length === 0 ? (
          <div className="p-10 text-center text-slate-600 dark:text-slate-400">
            <div className="mx-auto mb-3 h-11 w-11 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.06] flex items-center justify-center">
              <Plus className="h-5 w-5 opacity-50" />
            </div>
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">No custom fields yet</p>
            <p className="text-sm max-w-sm mx-auto">Add one to capture extra info on your {entity} records — it will appear on the {entity} create and edit forms.</p>
            <button onClick={openModal} className="btn-brand inline-flex items-center gap-2 mt-4">
              <Plus className="h-4 w-4" /> Add your first field
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/[0.04] dark:bg-white/[0.03]">
                <tr>
                  {([
                    { h: 'Field Name', hint: '' },
                    { h: 'Type', hint: 'How data for this field is entered and stored.' },
                    { h: 'Required', hint: 'When on, users must fill this field before saving the record.' },
                    { h: 'Actions', hint: '' },
                  ]).map(({ h, hint }) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1">{h}{hint && <InfoHint content={hint} />}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/10 dark:divide-white/[0.06]">
                {fields.map(field => (
                  <tr key={field.id} className="hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{field.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 capitalize">{field.field_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRequired(field)}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${field.required ? 'bg-sky-500' : 'bg-slate-900/10 dark:bg-white/[0.12]'}`}
                        title="Toggle required"
                      >
                        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${field.required ? 'translate-x-4' : ''}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {confirmDeleteId === field.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 dark:text-slate-400">Delete?</span>
                          <button onClick={() => deleteField(field.id)} disabled={deleting === field.id}
                            className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                            {deleting === field.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs px-2 py-1 rounded-lg bg-slate-900/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.10] transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(field.id)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Field Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="glass-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Add Custom Field</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.08] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Field Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="e.g. Company Size"
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveField()}
                  className="input-glass"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Type
                  <InfoHint content="Choose how this field is entered. Each type stores and validates data differently." />
                </label>
                <select value={modalType} onChange={e => setModalType(e.target.value as FieldType)} className={selectClass}>
                  {FIELD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-snug">
                  {FIELD_TYPES.find(t => t.value === modalType)?.hint}
                </p>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    Required
                    <InfoHint content="When on, this field must be filled before the record can be saved." />
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Force users to fill this field</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalRequired(r => !r)}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${modalRequired ? 'bg-sky-500' : 'bg-slate-900/10 dark:bg-white/[0.12]'}`}
                >
                  <span className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${modalRequired ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {modalError && (
                <p className="text-sm text-red-400">{modalError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 text-sm font-medium border border-slate-900/10 dark:border-white/[0.12] text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                Cancel
              </button>
              <button onClick={saveField} disabled={modalSaving} className="flex-1 btn-brand flex items-center justify-center gap-2">
                {modalSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Add Field'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
