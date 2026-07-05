'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Printer } from 'lucide-react'

interface LineItem {
  description: string
  qty: number
  unit_price: number
  amount: number
}

interface Invoice {
  id: string
  invoice_number: string
  client?: { company_name: string }
  status: string
  issue_date: string
  due_date: string | null
  subtotal: number
  tax_amount: number
  total: number
  amount_paid: number
  notes: string | null
  line_items: LineItem[]
}

interface Company {
  name?: string
  contact_email?: string
  website?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
}

function fmt(n: number | null | undefined) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function InvoicePrintPage() {
  const params = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<Company>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!params?.id) return
    Promise.all([
      fetch(`/api/invoices/${params.id}`).then(async r => {
        if (!r.ok) throw new Error((await r.json())?.error || 'Invoice not found')
        return r.json()
      }),
      fetch('/api/settings/company').then(r => r.ok ? r.json() : {}).catch(() => ({})),
    ])
      .then(([inv, co]) => {
        setInvoice(inv)
        setCompany(co || {})
      })
      .catch(e => setError(e.message || 'Failed to load invoice'))
      .finally(() => setLoading(false))
  }, [params?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading invoice…
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="p-8">
        <div className="glass-card p-8 text-center text-slate-400">{error || 'Invoice not found'}</div>
      </div>
    )
  }

  const lineItems: LineItem[] = invoice.line_items || []
  const balance = Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0))
  const companyAddress = [company.address, [company.city, company.state, company.postcode].filter(Boolean).join(', '), company.country]
    .filter(Boolean)

  return (
    <div className="invoice-print-root p-4 lg:p-8">
      <style>{`
        @media print {
          /* Hide the app chrome: sidebar, top header, mobile nav */
          aside, nav, header, [class*="glass-sidebar"] { display: none !important; }
          body, html { background: #fff !important; }
          .bg-mesh { background: #fff !important; }
          .lg\\:ml-20 { margin-left: 0 !important; }
          .print-hide { display: none !important; }
          .invoice-print-root { padding: 0 !important; }
          .invoice-sheet { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="print-hide flex items-center justify-between max-w-[820px] mx-auto mb-4">
        <p className="text-slate-400 text-sm">Print preview — invoice {invoice.invoice_number}</p>
        <button onClick={() => window.print()} className="btn-brand flex items-center gap-1.5 px-4 py-2.5 text-sm">
          <Printer className="h-4 w-4" /> Download PDF
        </button>
      </div>

      {/* Printable invoice sheet */}
      <div className="invoice-sheet bg-white text-gray-900 rounded-xl shadow-xl max-w-[820px] mx-auto p-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company.name || 'Invoice'}</h1>
            {companyAddress.map((line, i) => (
              <p key={i} className="text-sm text-gray-500">{line}</p>
            ))}
            {company.phone && <p className="text-sm text-gray-500">{company.phone}</p>}
            {company.contact_email && <p className="text-sm text-gray-500">{company.contact_email}</p>}
            {company.website && <p className="text-sm text-gray-500">{company.website}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tracking-tight text-gray-900 uppercase">Invoice</p>
            <p className="text-sm text-gray-600 mt-1">#{invoice.invoice_number}</p>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide">{invoice.status}</p>
          </div>
        </div>

        {/* Bill to + dates */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
            <p className="text-base font-medium text-gray-900">{invoice.client?.company_name || '—'}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-gray-600">Issue Date: <span className="text-gray-900 font-medium">{invoice.issue_date}</span></p>
            {invoice.due_date && (
              <p className="text-gray-600 mt-1">Due Date: <span className="text-gray-900 font-medium">{invoice.due_date}</span></p>
            )}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-2">Description</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 w-16">Qty</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 w-28">Unit Price</th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center text-gray-400">No line items</td></tr>
            ) : lineItems.map((li, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-3 text-gray-800">{li.description || '—'}</td>
                <td className="py-3 text-right text-gray-700 tabular-nums">{li.qty || 1}</td>
                <td className="py-3 text-right text-gray-700 tabular-nums">{fmt(li.unit_price)}</td>
                <td className="py-3 text-right text-gray-900 tabular-nums font-medium">{fmt(li.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1.5 text-gray-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-gray-600">
              <span>Tax</span>
              <span className="tabular-nums">{fmt(invoice.tax_amount)}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-gray-200 text-gray-900 font-bold text-base">
              <span>Total</span>
              <span className="tabular-nums">{fmt(invoice.total)}</span>
            </div>
            {(invoice.amount_paid || 0) > 0 && (
              <>
                <div className="flex justify-between py-1.5 text-gray-600">
                  <span>Amount Paid</span>
                  <span className="tabular-nums">-{fmt(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between py-1.5 text-gray-900 font-semibold">
                  <span>Balance Due</span>
                  <span className="tabular-nums">{fmt(balance)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-10 text-center">
          Thank you for your business{company.name ? ` — ${company.name}` : ''}.
        </p>
      </div>
    </div>
  )
}
