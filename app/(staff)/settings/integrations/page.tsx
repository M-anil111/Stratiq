'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react'

type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'loading'

const statusConfig = {
  connected: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Connected' },
  disconnected: { icon: XCircle, color: 'text-slate-400', bg: 'bg-white/[0.05]', label: 'Not Connected' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Error' },
  loading: { icon: Loader2, color: 'text-slate-400', bg: 'bg-white/[0.05]', label: 'Checking...' },
}

const staticIntegrations = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Store all client files in Google Drive. Files are organized per client automatically',
    icon: '📁',
    steps: ['Set up service account in Google Cloud Console', 'Add GOOGLE_DRIVE_SERVICE_ACCOUNT to env vars', 'Share root folder with service account'],
    oauthKey: 'google_connected',
    connectsViaGoogle: true,
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    description: 'Pull website traffic, sessions, and goal data per client',
    icon: '📊',
    steps: ['Enable GA4 Data API in Google Cloud Console', 'Client grants access to their GA4 property'],
    oauthKey: 'google_connected',
    connectsViaGoogle: true,
  },
  {
    id: 'google_search_console',
    name: 'Google Search Console',
    description: 'Pull keyword rankings, impressions, and click data per client site',
    icon: '🔍',
    steps: ['Enable Search Console API in Google Cloud Console', 'Client grants access to their GSC property'],
    oauthKey: 'google_connected',
    connectsViaGoogle: true,
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync invoices, clients, and revenue data. Bidirectional sync.',
    icon: '💼',
    badge: 'Phase 2',
  },
]

export default function IntegrationsPage() {
  const [googleStatus, setGoogleStatus] = useState<IntegrationStatus>('loading')
  const [metaStatus, setMetaStatus] = useState<IntegrationStatus>('loading')
  const [disconnecting, setDisconnecting] = useState(false)
  const [metaDisconnecting, setMetaDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'google') {
      setGoogleStatus('connected')
      window.history.replaceState({}, '', '/settings/integrations')
      return
    }
    if (params.get('connected') === 'meta') {
      setMetaStatus('connected')
      setBanner({ type: 'success', message: 'Meta Ads connected successfully!' })
      setTimeout(() => setBanner(null), 4000)
      window.history.replaceState({}, '', '/settings/integrations')
    }
    if (params.get('error') === 'meta_auth_failed') {
      setMetaStatus('disconnected')
      setBanner({ type: 'error', message: 'Meta Ads connection failed. Please try again.' })
      setTimeout(() => setBanner(null), 5000)
      window.history.replaceState({}, '', '/settings/integrations')
    }
    fetch('/api/settings/integrations')
      .then(r => r.json())
      .then(data => {
        setGoogleStatus(data.google_connected === 'true' ? 'connected' : 'disconnected')
      })
      .catch(() => setGoogleStatus('disconnected'))
    // Check Meta status
    fetch('/api/integrations/meta-ads/accounts')
      .then(r => r.json())
      .then(d => {
        setMetaStatus(d.error === 'not_connected' ? 'disconnected' : d.error ? 'error' : 'connected')
      })
      .catch(() => setMetaStatus('disconnected'))
  }, [])

  const handleGoogleDisconnect = async () => {
    if (!confirm('Disconnect Google account? This will stop all Google integrations.')) return
    setDisconnecting(true)
    await fetch('/api/auth/google/disconnect', { method: 'POST' })
    setGoogleStatus('disconnected')
    setDisconnecting(false)
  }

  const handleGoogleSync = async () => {
    setSyncing(true)
    // Re-check connection status
    const data = await fetch('/api/settings/integrations').then(r => r.json())
    setGoogleStatus(data.google_connected === 'true' ? 'connected' : 'disconnected')
    setSyncing(false)
  }

  const handleMetaDisconnect = async () => {
    if (!confirm('Disconnect Meta Ads? This will stop all Meta Ads syncing.')) return
    setMetaDisconnecting(true)
    await fetch('/api/auth/meta/disconnect', { method: 'POST' })
    setMetaStatus('disconnected')
    setMetaDisconnecting(false)
    setBanner({ type: 'success', message: 'Meta Ads disconnected.' })
    setTimeout(() => setBanner(null), 3000)
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-slate-400 text-sm">Connect external platforms to pull data automatically</p>
      </div>

      {banner && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${banner.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}>
          {banner.message}
        </div>
      )}

      <div className="space-y-4">
        {/* Google Ads — primary OAuth connection */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔵</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">Google Ads</h2>
                  {(() => {
                    const config = statusConfig[googleStatus]
                    const Icon = config.icon
                    return (
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        <Icon className={`h-3 w-3 ${googleStatus === 'loading' ? 'animate-spin' : ''}`} />
                        {config.label}
                      </div>
                    )
                  })()}
                </div>
                <p className="text-sm text-slate-400 mt-1">Pull campaign performance data for all client accounts via Google Ads MCC. Also enables Google Drive, Analytics, and Search Console.</p>
                {googleStatus === 'disconnected' && (
                  <ol className="mt-3 space-y-1">
                    {['Connect your Google account (MCC)', 'Authorize ads, drive, analytics, and search console scopes', 'Map customer accounts per client in their detail page'].map((step, i) => (
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
              {googleStatus === 'loading' ? (
                <div className="h-9 w-24 skeleton rounded-xl" />
              ) : googleStatus === 'connected' ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleGoogleSync}
                    disabled={syncing}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    Re-sync
                  </button>
                  <button
                    onClick={handleGoogleDisconnect}
                    disabled={disconnecting}
                    className="px-3 py-1.5 text-sm border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <a href="/api/auth/google/connect" className="btn-brand">
                  Connect Google Account
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Meta Ads */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔷</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">Meta Ads (Facebook & Instagram)</h2>
                  {(() => {
                    const config = statusConfig[metaStatus]
                    const Icon = config.icon
                    return (
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </div>
                    )
                  })()}
                </div>
                <p className="text-sm text-slate-400 mt-1">Pull Ads Insights data for all connected client ad accounts</p>
                {metaStatus === 'disconnected' && (
                  <ol className="mt-3 space-y-1">
                    {['Connect Meta Business Manager account', 'Authorize ads_read scope', 'Set Ad Account IDs per client'].map((step, i) => (
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
              {metaStatus === 'loading' ? (
                <div className="h-9 w-24 skeleton rounded-xl" />
              ) : metaStatus === 'connected' ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleMetaDisconnect}
                    disabled={metaDisconnecting}
                    className="px-3 py-1.5 text-sm border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    {metaDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <a href="/api/auth/meta/connect" className="btn-brand">
                  Connect Meta Account
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Static integrations that use Google OAuth */}
        {staticIntegrations.map(integration => {
          const status = integration.connectsViaGoogle ? googleStatus : 'disconnected'
          const config = statusConfig[status === 'loading' ? 'disconnected' : status]
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
                      {!integration.badge && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                          <Icon className="h-3 w-3" />
                          {integration.connectsViaGoogle && googleStatus === 'connected' ? 'Connected via Google' : config.label}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{integration.description}</p>
                    {integration.steps && !integration.connectsViaGoogle && (
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
                  ) : integration.connectsViaGoogle ? (
                    <span className="text-xs text-slate-500">Via Google OAuth</span>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
