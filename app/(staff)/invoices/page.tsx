'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Download, RefreshCw, Loader2, Search, ExternalLink, Send, CheckCircle2, AlertCircle, FileText, Ban, DollarSign, Printer } from 'lucide-react'
import Link from 'next/link'
import { downloadCsv } from '@/lib/csv'

interface Client { id: string; company_name: string }
interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  client?: { company_name: string }
  status: string
  issue_date: string
  due_date: string | null
  subtotal: number
  tax_amount: number
  total: number
  amount_paid: number
  qb_invoice_id: string | null
  paid_at?: string | null
  notes: string | null
  line_items: LineItem[]
}
interface LineItem {
  description: string
  qty: number
  unit_price: number
  amount: number
  qb_item_id?: string
}
interface QbItem { id: string; name: string; description: string; unit_price: number }

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-300',
  sent: 'bg-sky-500/20 text-sky-300',
  paid: 'bg-emerald-500/20 text-emerald-300',
  overdue: 'bg-red-500/20 text-red-300',
  voided: 'bg-slate-700/40 text-slate-500',
}

const selectClass = "bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50"

function fmt(n: number | null | undefined) {
  if (n == null) return '$0.00'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function balanceDue(inv: Invoice) {
  return Math.max(0, (inv.total || 0) - (inv.amount_paid || 0))
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [qbItems, setQbItems] = useState<QbItem[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [pushingQb, setPushingQb] = useState<string | null>(null)
  const [pushMsg, setPushMsg] = useState<Record<string, string>>({})
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [sendMsg, setSendMsg] = useState<Record<string, string>>({})
  const [newInvoice, setNewInvoice] = useState({
    client_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    tax_amount: '',
    notes: '',
    line_items: [{ description: '', qty: 1, unit_price: '', amount: '' }] as any[],
  })

  const loadInvoices = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (clientFilter) params.set('clientId', clientFilter)
    fetch(`/api/invoices?${params}`).then(r => r.json()).then(data => {
      setInvoices(Array.isArray(data) ? data : [])
    }).finally(() => setLoading(false))
  }, [clientFilter])

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(d => {
      const list = d?.clients || (Array.isArray(d) ? d : [])
      setClients(list)
    })
    fetch('/api/integrations/quickbooks/items').then(r => r.json()).then(d => {
      if (d?.items) setQbItems(d.items)
    }).catch(() => {})
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const filtered = invoices.filter(inv => {
    const name = inv.client?.company_name?.toLowerCase() || ''
    const num = inv.invoice_number?.toLowerCase() || ''
    const q = search.toLowerCase()
    if (search && !name.includes(q) && !num.includes(q)) return false
    if (statusFilter && inv.status !== statusFilter) return false
    return true
  })

  const totals = {
    total: filtered.reduce((s, i) => s + (i.total || 0), 0),
    paid: filtered.reduce((s, i) => s + (i.amount_paid || 0), 0),
    outstanding: filtered.reduce((s, i) => s + balanceDue(i), 0),
  }

  const updateLineItem = (idx: number, field: string, val: string) => {
    setNewInvoice(prev => {
      const items = [...prev.line_items]
      items[idx] = { ...items[idx], [field]: val }
      if (field === 'qty' || field === 'unit_price') {
        const qty = parseFloat(field === 'qty' ? val : items[idx].qty) || 0
        const up = parseFloat(field === 'unit_price' ? val : items[idx].unit_price) || 0
        items[idx].amount = (qty * up).toFixed(2)
      }
      return { ...prev, line_items: items }
    })
  }

  const addLineItem = () => setNewInvoice(prev => ({
    ...prev,
    line_items: [...prev.line_items, { description: '', qty: 1, unit_price: '', amount: '' }],
  }))

  const removeLineItem = (idx: number) => setNewInvoice(prev => ({
    ...prev,
    line_items: prev.line_items.filter((_, i) => i !== idx),
  }))

  const subtotal = newInvoice.line_items.reduce((s, li) => s + (parseFloat(li.amount) || 0), 0)
  const taxAmt = parseFloat(newInvoice.tax_amount) || 0
  const totalAmt = subtotal + taxAmt

  const saveInvoice = async () => {
    if (!newInvoice.client_id) return
    setSavingInvoice(true)
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: newInvoice.client_id,
        issue_date: newInvoice.issue_date,
        due_date: newInvoice.due_date || null,
        tax_amount: taxAmt,
        notes: newInvoice.notes || null,
        line_items: newInvoice.line_items.map(li => ({
          description: li.description,
          qty: parseFloat(li.qty) || 1,
          unit_price: parseFloat(li.unit_price) || 0,
          amount: parseFloat(li.amount) || 0,
          ...(li.qb_item_id ? { qb_item_id: li.qb_item_id } : {}),
        })),
      }),
    })
    setSavingInvoice(false)
    if (res.ok) {
      setShowForm(false)
      setNewInvoice({
        client_id: '', issue_date: new Date().toISOString().slice(0, 10),
        due_date: '', tax_amount: '', notes: '',
        line_items: [{ description: '', qty: 1, unit_price: '', amount: '' }],
      })
      loadInvoices()
    }
  }

  const pushToQb = async (inv: Invoice) => {
    setPushingQb(inv.id)
    const res = await fetch(`/api/invoices/${inv.id}/push-to-qb`, { method: 'POST' })
    const d = await res.json()
    setPushingQb(null)
    setPushMsg(prev => ({ ...prev, [inv.id]: res.ok ? 'Pushed to QB!' : (d.error || 'Failed') }))
    if (res.ok) loadInvoices()
    setTimeout(() => setPushMsg(prev => { const n = { ...prev }; delete n[inv.id]; return n }), 4000)
  }

  const sendInvoiceEmail = async (inv: Invoice) => {
    setSendingEmail(inv.id)
    const res = await fetch(`/api/invoices/${inv.id}/send`, { method: 'POST' })
    const d = await res.json()
    setSendingEmail(null)
    setSendMsg(prev => ({ ...prev, [inv.id]: res.ok ? 'Sent!' : (d.error || 'Failed') }))
    if (res.ok) loadInvoices()
    setTimeout(() => setSendMsg(prev => { const n = { ...prev }; delete n[inv.id]; return n }), 4000)
  }

  const updateStatus = async (inv: Invoice, status: string) => {
    await fetch(`/api/invoices/${inv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadInvoices()
  }

  const markPaid = async (inv: Invoice) => {
    await fetch(`/api/invoices/${inv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() }),
    })
    loadInvoices()
  }

  const voidInvoice = async (inv: Invoice) => {
    if (!confirm(`Void invoice ${inv.invoice_number}? This cannot be undone.`)) return
    await fetch(`/api/invoices/${inv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'voided' }),
    })
    loadInvoices()
  }

  const exportCsv = () => {
    downloadCsv('invoices.csv', filtered.map(inv => ({
      'Invoice #': inv.invoice_number,
      'Client': inv.client?.company_name || '',
      'Status': inv.status,
      'Issue Date': inv.issue_date,
      'Due Date': inv.due_date || '',
      'Paid Date': inv.paid_at ? inv.paid_at.slice(0, 10) : '',
      'Subtotal': inv.subtotal,
      'Tax': inv.tax_amount,
      'Total': inv.total,
      'Paid': inv.amount_paid,
      'Balance Due': balanceDue(inv),
      'QB Synced': inv.qb_invoice_id ? 'Yes' : 'No',
    })))
  }

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage all client invoices and QuickBooks sync</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-xl transition-all whitespace-nowrap">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => setShowForm(v => !v)} className="btn-brand flex items-center gap-1.5 px-4 py-2.5 text-sm">
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Invoiced', value: fmt(totals.total), color: 'text-white' },
          { label: 'Total Paid', value: fmt(totals.paid), color: 'text-emerald-400' },
          { label: 'Outstanding', value: fmt(totals.outstanding), color: 'text-amber-400' },
        ].map(t => (
          <div key={t.label} className="glass-card p-4">
            <p className="text-xs text-slate-400 mb-1">{t.label}</p>
            <p className={`text-xl font-bold ${t.color}`}>{t.value}</p>
          </div>
        ))}
      </div>

      {/* New Invoice Form */}
      {showForm && (
        <div className="glass-card p-5 mb-6">
          <h2 className="font-semibold text-white mb-4">Create Invoice</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Client *</label>
              <select value={newInvoice.client_id} onChange={e => setNewInvoice(p => ({ ...p, client_id: e.target.value }))} className={selectClass}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Issue Date</label>
              <input type="date" value={newInvoice.issue_date} onChange={e => setNewInvoice(p => ({ ...p, issue_date: e.target.value }))} className="input-glass" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Due Date</label>
              <input type="date" value={newInvoice.due_date} onChange={e => setNewInvoice(p => ({ ...p, due_date: e.target.value }))} className="input-glass" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tax Amount ($)</label>
              <input type="number" step="0.01" placeholder="0.00" value={newInvoice.tax_amount} onChange={e => setNewInvoice(p => ({ ...p, tax_amount: e.target.value }))} className="input-glass" />
            </div>
          </div>

          {/* Line items */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Line Items</p>
              <button onClick={addLineItem} className="text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Description', 'Qty', 'Unit Price', 'Amount', ''].map(h => (
                      <th key={h} className="text-left text-xs text-slate-500 pb-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {newInvoice.line_items.map((li, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 pr-3">
                        <div className="flex gap-1">
                          <input value={li.description} onChange={e => updateLineItem(idx, 'description', e.target.value)} placeholder="Service description" className="input-glass text-sm flex-1" />
                          {qbItems.length > 0 && (
                            <select
                              value=""
                              onChange={e => {
                                const item = qbItems.find(q => q.id === e.target.value)
                                if (!item) return
                                setNewInvoice(prev => {
                                  const items = [...prev.line_items]
                                  items[idx] = { ...items[idx], description: item.description || item.name, unit_price: String(item.unit_price), amount: String((parseFloat(String(items[idx].qty)) || 1) * item.unit_price), qb_item_id: item.id }
                                  return { ...prev, line_items: items }
                                })
                              }}
                              className="bg-[rgba(255,255,255,0.06)] border border-white/[0.12] text-slate-400 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500/50 max-w-[120px]"
                            >
                              <option value="">QB item…</option>
                              {qbItems.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 w-20">
                        <input type="number" value={li.qty} onChange={e => updateLineItem(idx, 'qty', e.target.value)} className="input-glass text-sm" />
                      </td>
                      <td className="py-1.5 pr-3 w-28">
                        <input type="number" step="0.01" value={li.unit_price} onChange={e => updateLineItem(idx, 'unit_price', e.target.value)} placeholder="0.00" className="input-glass text-sm" />
                      </td>
                      <td className="py-1.5 pr-3 w-24 text-slate-300 tabular-nums text-right">${parseFloat(li.amount || '0').toFixed(2)}</td>
                      <td className="py-1.5 w-8">
                        {newInvoice.line_items.length > 1 && (
                          <button onClick={() => removeLineItem(idx)} className="text-slate-500 hover:text-red-400 transition-colors text-xs">✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-end mt-3 gap-1 text-sm text-slate-400">
              <span>Subtotal: <span className="text-white tabular-nums">{fmt(subtotal)}</span></span>
              <span>Tax: <span className="text-white tabular-nums">{fmt(taxAmt)}</span></span>
              <span className="text-base font-bold text-white">Total: <span className="tabular-nums">{fmt(totalAmt)}</span></span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea value={newInvoice.notes} onChange={e => setNewInvoice(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional notes for the client" className="input-glass resize-none" />
          </div>

          <div className="flex gap-2">
            <button onClick={saveInvoice} disabled={savingInvoice || !newInvoice.client_id} className="btn-brand px-5 py-2.5 text-sm disabled:opacity-50">
              {savingInvoice ? <><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Saving…</> : 'Save Invoice'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm border border-white/[0.10] text-slate-400 hover:text-white rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices…" className="input-glass pl-9 w-full" />
        </div>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className={selectClass}>
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          {['draft', 'sent', 'paid', 'overdue', 'voided'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button onClick={loadInvoices} className="flex items-center gap-1.5 px-3 py-2.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-xl transition-all">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading invoices…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No invoices found</p>
            <p className="text-slate-600 text-xs mt-1">Create your first invoice with the button above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Invoice #', 'Client', 'Status', 'Issue Date', 'Due Date', 'Total', 'Paid', 'Balance', 'QB', 'Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${inv.client_id}?tab=invoices`} className="text-sky-400 hover:text-sky-300 font-medium transition-colors">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{inv.client?.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={inv.status}
                        onChange={e => updateStatus(inv, e.target.value)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 focus:ring-1 focus:ring-sky-500/50 cursor-pointer ${STATUS_COLORS[inv.status] || 'bg-slate-500/20 text-slate-300'}`}
                        style={{ background: 'transparent' }}
                      >
                        {['draft', 'sent', 'paid', 'overdue', 'voided'].map(s => (
                          <option key={s} value={s} style={{ background: '#1a1f2e', color: '#fff' }}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-400 tabular-nums whitespace-nowrap">{inv.issue_date}</td>
                    <td className="px-4 py-3 text-slate-400 tabular-nums whitespace-nowrap">{inv.due_date || '—'}</td>
                    <td className="px-4 py-3 text-white tabular-nums whitespace-nowrap">{fmt(inv.total)}</td>
                    <td className="px-4 py-3 text-emerald-400 tabular-nums whitespace-nowrap">{fmt(inv.amount_paid)}</td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      <span className={balanceDue(inv) > 0 ? 'text-amber-400 font-medium' : 'text-slate-500'}>
                        {fmt(balanceDue(inv))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {inv.qb_invoice_id
                        ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Synced</span>
                        : <span className="text-xs text-slate-600">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => sendInvoiceEmail(inv)}
                          disabled={sendingEmail === inv.id}
                          title="Email invoice to client"
                          className="text-xs px-2 py-1.5 border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                        >
                          {sendingEmail === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          {sendMsg[inv.id] || 'Email'}
                        </button>
                        <button
                          onClick={() => pushToQb(inv)}
                          disabled={pushingQb === inv.id}
                          title="Push to QuickBooks"
                          className="text-xs px-2 py-1.5 border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                        >
                          {pushingQb === inv.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : pushMsg[inv.id]
                              ? (pushMsg[inv.id].includes('fail') || pushMsg[inv.id].includes('error') || pushMsg[inv.id].includes('No ') ? <AlertCircle className="h-3 w-3 text-red-400" /> : <CheckCircle2 className="h-3 w-3 text-emerald-400" />)
                              : <span className="font-bold text-[10px]">QB</span>
                          }
                          {pushMsg[inv.id] || 'Push'}
                        </button>
                        {inv.status !== 'paid' && inv.status !== 'voided' && (
                          <button
                            onClick={() => markPaid(inv)}
                            title="Mark as Paid"
                            className="text-xs px-2 py-1.5 border border-white/[0.10] text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all whitespace-nowrap flex items-center gap-1"
                          >
                            <DollarSign className="h-3 w-3" /> Paid
                          </button>
                        )}
                        {inv.status !== 'voided' && (
                          <button
                            onClick={() => voidInvoice(inv)}
                            title="Void invoice"
                            className="text-xs px-2 py-1.5 border border-white/[0.10] text-red-400 hover:bg-red-500/10 rounded-lg transition-all whitespace-nowrap flex items-center gap-1"
                          >
                            <Ban className="h-3 w-3" /> Void
                          </button>
                        )}
                        <Link
                          href={`/invoices/${inv.id}/print`}
                          target="_blank"
                          title="Print / PDF"
                          className="text-xs px-2 py-1.5 border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-lg transition-all whitespace-nowrap flex items-center"
                        >
                          <Printer className="h-3 w-3" />
                        </Link>
                        <Link href={`/clients/${inv.client_id}?tab=invoices`} title="View in client" className="text-slate-500 hover:text-slate-300 transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
