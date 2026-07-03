'use client'
import { useState, KeyboardEvent } from 'react'
import { Plus, Edit2, Trash2, X, Loader2, Send } from 'lucide-react'

const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"

function today() { return new Date().toISOString().split('T')[0] }

const emptyForm = () => ({
  url: '',
  h1: '',
  meta_title: '',
  meta_description: '',
  primary_keywords: [] as string[],
  secondary_keywords: [] as string[],
  rankings: '',
  submission_date: today(),
  comment: '',
})

function TagInput({ label, tags, onChange }: { label: string; tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) onChange([...tags, val])
    setInput('')
  }
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1))
  }
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 p-2 border border-gray-300 rounded-lg bg-white min-h-[42px] focus-within:ring-2 focus-within:ring-sky-500">
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-800 text-sm rounded-full">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-sky-600">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[100px] text-sm outline-none bg-transparent"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={add}
          placeholder={tags.length === 0 ? 'Type and press Enter...' : ''}
        />
      </div>
    </div>
  )
}

export default function OnPagePage({ params }: { params: { id: string; projectId: string } }) {
  const [entries, setEntries] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${params.projectId}/onpage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        setEntries(p => [data, ...p])
        setShowForm(false)
        setForm(emptyForm())
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">OnPage Details ({entries.length})</h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add OnPage Detail
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-medium">No OnPage details yet</p>
            <p className="text-sm mt-1">Click "Add OnPage Detail" to log your first entry</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['#', 'URL', 'H1', 'Meta Title', 'Primary KWs', 'Rankings', 'Date', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map((entry, i) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium max-w-[160px] truncate">{entry.url}</td>
                    <td className="px-4 py-3 max-w-[140px] truncate">{entry.h1}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate">{entry.meta_title}</td>
                    <td className="px-4 py-3 max-w-[140px]">
                      <div className="flex flex-wrap gap-1">
                        {(entry.primary_keywords || []).slice(0, 2).map((kw: string) => (
                          <span key={kw} className="px-1.5 py-0.5 bg-sky-50 text-sky-700 text-xs rounded">{kw}</span>
                        ))}
                        {(entry.primary_keywords || []).length > 2 && (
                          <span className="text-xs text-gray-400">+{entry.primary_keywords.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{entry.rankings}</td>
                    <td className="px-4 py-3 text-gray-500">{entry.submission_date}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button className="p-1 text-gray-400 hover:text-sky-600"><Edit2 className="h-4 w-4" /></button>
                        <button className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-gray-100 flex flex-wrap gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg transition-colors">
            <Send className="h-3.5 w-3.5" /> Send to All
          </button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to DM Manager</button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to Sales Manager</button>
          <button className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">Send to Client</button>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold">Add OnPage Detail</h3>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL <span className="text-red-500">*</span></label>
                <input className={inputClass} type="url" value={form.url} onChange={set('url')} placeholder="https://..." required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">H1 <span className="text-red-500">*</span></label>
                <input className={inputClass} value={form.h1} onChange={set('h1')} placeholder="Page heading" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Title
                  <span className={`ml-2 font-normal ${form.meta_title.length > 60 ? 'text-red-500' : 'text-gray-400'}`}>
                    {form.meta_title.length}/60
                  </span>
                </label>
                <input className={inputClass} value={form.meta_title} onChange={set('meta_title')} placeholder="SEO title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Description
                  <span className={`ml-2 font-normal ${form.meta_description.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                    {form.meta_description.length}/160
                  </span>
                </label>
                <textarea className={`${inputClass} resize-none h-20`} value={form.meta_description} onChange={set('meta_description')} placeholder="SEO description" />
              </div>
              <TagInput
                label="Primary Keywords"
                tags={form.primary_keywords}
                onChange={t => setForm(f => ({ ...f, primary_keywords: t }))}
              />
              <TagInput
                label="Secondary Keywords"
                tags={form.secondary_keywords}
                onChange={t => setForm(f => ({ ...f, secondary_keywords: t }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rankings</label>
                <input className={inputClass} value={form.rankings} onChange={set('rankings')} placeholder="e.g. #3 for keyword X" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Submission Date</label>
                <input className={inputClass} type="date" value={form.submission_date} onChange={set('submission_date')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment</label>
                <textarea className={`${inputClass} resize-none h-16`} value={form.comment} onChange={set('comment')} placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
