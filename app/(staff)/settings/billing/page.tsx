import { CreditCard, ExternalLink } from 'lucide-react'

export default function BillingPage() {
  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="h-6 w-6 text-sky-400" />
        <h1 className="text-2xl font-bold text-white">Billing</h1>
      </div>

      <div className="glass-card p-6 space-y-6">
        {/* Current plan */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Plan</p>
            <p className="text-xl font-bold text-white">Agency Plan</p>
            <p className="text-sm text-slate-400 mt-1">Full access to all Stratiq features for your team.</p>
          </div>
          <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/20">
            Active
          </span>
        </div>

        <hr className="border-white/[0.08]" />

        {/* Managed externally notice */}
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-4 text-sm text-slate-300 leading-relaxed">
          Billing is managed externally. To upgrade, downgrade, or cancel your subscription, please contact our support team.
        </div>

        <a
          href="mailto:support@stratiq.io"
          className="inline-flex items-center gap-2 btn-brand"
        >
          <ExternalLink className="h-4 w-4" />
          Contact Support
        </a>
      </div>
    </div>
  )
}
