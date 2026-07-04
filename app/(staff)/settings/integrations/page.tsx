'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'

type IntegrationStatus = 'connected' | 'disconnected' | 'error'

const integrations = [
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Pull campaign performance data for all client accounts via Google Ads MCC',
    status: 'disconnected' as IntegrationStatus,
    icon: '🔵',
    steps: ['Connect your Google Ads Manager (MCC) account', 'Authorize ads_read scope', 'Set customer IDs per client in Tracking Tools'],
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads (Facebook & Instagram)',
    description: 'Pull Ads Insights data for all connected client ad accounts',
    status: 'disconnected' as IntegrationStatus,
    icon: '🔷',
    steps: ['Connect Meta Business Manager account', 'Authorize ads_read scope', 'Set Ad Account IDs per client'],
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Store all client files in Google Drive. Files are organized per client automatically',
    status: 'disconnected' as IntegrationStatus,
    icon: '📁',
    steps: ['Set up service account in Google Cloud Console', 'Add GOOGLE_DRIVE_SERVICE_ACCOUNT to env vars', 'Share root folder with service account'],
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    description: 'Pull website traffic, sessions, and goal data per client',
    status: 'disconnected' as IntegrationStatus,
    icon: '📊',
    steps: ['Enable GA4 Data API in Google Cloud Console', 'Client grants Mindshare access to their GA4 property'],
  },
  {
    id: 'google_search_console',
    name: 'Google Search Console',
    description: 'Pull keyword rankings, impressions, and click data per client site',
    status: 'disconnected' as IntegrationStatus,
    icon: '🔍',
    steps: ['Enable Search Console API in Google Cloud Console', 'Client grants Mindshare access to their GSC property'],
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync invoices, clients, and revenue data. Bidirectional sync.',
    status: 'disconnected' as IntegrationStatus,
    icon: '💼',
    badge: 'Phase 2',
  },
]

const statusConfig = {
  connected: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Connected' },
  disconnected: { icon: XCircle, color: 'text-slate-400', bg: 'bg-white/[0.05]', label: 'Not Connected' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Error' },
}

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>(
    Object.fromEntries(integrations.map(i => [i.id, i.status]))
  )

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-slate-400 text-sm">Connect external platforms to pull data automatically</p>
      </div>

      <div className="space-y-4">
        {integrations.map(integration => {
          const status = statuses[integration.id]
          const config = statusConfig[status]
          const Icon = config.icon
          return (
            <div key={integration.id} className="glass-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{integration.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-white">{integration.name}</h2>
                      {integration.badge && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded-full">{integration.badge}</span>
                      )}
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{integration.description}</p>
                    {integration.steps && status === 'disconnected' && (
                      <ol className="mt-3 space-y-1">
                        {integration.steps.map((step, i) => (
                          <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                            <span className="font-medium text-slate-300">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {integration.badge ? (
                    <span className="text-xs text-slate-400">Available in Phase 2</span>
                  ) : status === 'connected' ? (
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-xl transition-all">
                        <RefreshCw className="h-3.5 w-3.5" /> Sync
                      </button>
                      <button onClick={() => setStatuses(s => ({ ...s, [integration.id]: 'disconnected' }))}
                        className="px-3 py-1.5 text-sm border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-all">
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setStatuses(s => ({ ...s, [integration.id]: 'connected' }))}
                      className="btn-brand"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
