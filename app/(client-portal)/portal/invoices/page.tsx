'use client'
import { useEffect, useState } from 'react'
import { FileText, CheckCircle2, Calendar, CreditCard, Loader2 } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  status: string
  total: number | null
  currency: string | null
  issue_date: string | null
  due_date: string | null
  paid_at: string | null
  payment_link: string | null
}

const statusStyles: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  voided: 'bg-slate-500/20 text-slate-500 border-slate-500/30',
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  voided: 'Voided',
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMoney(amount: number | null, currency: string | null) {
  const value = amount ?? 0
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'USD').toUpperCase(),
    }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [unavailableId, setUnavailableId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/invoices')
      .then(r => r.json())
      .then(d => { setInvoices(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setInvoices([]); setLoading(false) })
  }, [])

  async function handlePay(inv: Invoice) {
    setPayingId(inv.id)
    setUnavailableId(null)
    try {
      const res = await fetch(`/api/portal/invoices/${inv.id}/pay`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        setUnavailableId(inv.id)
      }
    } catch {
      setUnavailableId(inv.id)
    } finally {
      setPayingId(null)
    }
  }

  if (loading) return (
    <div className="p-4 lg:p-8 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">View and pay your invoices</p>
      </div>

      {invoices.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-600 dark:text-slate-400">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map(inv => {
            const isPaid = inv.status === 'paid'
            const isPayable = inv.status === 'sent' || inv.status === 'overdue'
            return (
              <div key={inv.id} className="glass-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-slate-900 dark:text-white text-lg leading-tight">
                          {inv.invoice_number}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusStyles[inv.status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                          {statusLabels[inv.status] ?? inv.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-600 dark:text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>Due {formatDate(inv.due_date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      {formatMoney(inv.total, inv.currency)}
                    </span>

                    {isPaid && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Paid {inv.paid_at ? `on ${formatDate(inv.paid_at)}` : ''}
                      </span>
                    )}

                    {isPayable && (
                      <button
                        onClick={() => handlePay(inv)}
                        disabled={payingId === inv.id}
                        className="btn-brand inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                      >
                        {payingId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                        Pay Now
                      </button>
                    )}
                  </div>
                </div>

                {unavailableId === inv.id && (
                  <p className="mt-3 text-xs text-amber-400/90 text-right">
                    Online payment isn&apos;t available yet — please contact us to pay this invoice.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
