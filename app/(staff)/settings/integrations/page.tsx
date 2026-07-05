'use client'
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, RefreshCw, Loader2, Briefcase, CreditCard } from 'lucide-react'

type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'loading'

const statusConfig = {
  connected: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Connected' },
  disconnected: { icon: XCircle, color: 'text-slate-400', bg: 'bg-white/[0.05]', label: 'Not Connected' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Error' },
  loading: { icon: Loader2, color: 'text-slate-400', bg: 'bg-white/[0.05]', label: 'Checking...' },
}

function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} />
      {config.label}
    </div>
  )
}

export default function IntegrationsPage() {
  const [googleStatus, setGoogleStatus] = useState<IntegrationStatus>('loading')
  const [metaStatus, setMetaStatus] = useState<IntegrationStatus>('loading')
  const [qbStatus, setQbStatus] = useState<IntegrationStatus>('loading')
  const [helcimStatus, setHelcimStatus] = useState<IntegrationStatus>('loading')

  const [disconnecting, setDisconnecting] = useState(false)
  const [metaDisconnecting, setMetaDisconnecting] = useState(false)
  const [qbDisconnecting, setQbDisconnecting] = useState(false)

  const [googleAdsSyncing, setGoogleAdsSyncing] = useState(false)
  const [googleDriveSyncing, setGoogleDriveSyncing] = useState(false)
  const [metaSyncing, setMetaSyncing] = useState(false)
  const [qbSyncing, setQbSyncing] = useState(false)

  const [lastSynced, setLastSynced] = useState<{
    qb: string | null
    meta: string | null
    google_ads: string | null
    google_drive: string | null
  }>({ qb: null, meta: null, google_ads: null, google_drive: null })

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showBanner = useCallback((type: 'success' | 'error', message: string) => {
    setBanner({ type, message })
    setTimeout(() => setBanner(null), type === 'error' ? 5000 : 3500)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'google') {
      setGoogleStatus('connected')
      window.history.replaceState({}, '', '/settings/integrations')
      return
    }
    if (params.get('connected') === 'meta') {
      setMetaStatus('connected')
      showBanner('success', 'Meta Ads connected successfully!')
      window.history.replaceState({}, '', '/settings/integrations')
    }
    if (params.get('connected') === 'quickbooks') {
      setQbStatus('connected')
      showBanner('success', 'QuickBooks Online connected successfully!')
      window.history.replaceState({}, '', '/settings/integrations')
    }
    if (params.get('error') === 'meta_auth_failed') {
      setMetaStatus('disconnected')
      showBanner('error', 'Meta Ads connection failed. Please try again.')
      window.history.replaceState({}, '', '/settings/integrations')
    }

    fetch('/api/settings/integrations')
      .then(r => r.json())
      .then(data => {
        setGoogleStatus(data.google_connected === 'true' ? 'connected' : 'disconnected')
        setQbStatus(data.qb_connected === 'true' ? 'connected' : 'disconnected')
        setHelcimStatus(data.helcim_connected === 'true' ? 'connected' : 'disconnected')
        setLastSynced({
          qb: data.qb_last_synced || null,
          meta: data.meta_last_synced || null,
          google_ads: data.google_ads_last_synced || null,
          google_drive: data.google_drive_last_synced || null,
        })

        if (data.meta_connected === 'true') {
          setMetaStatus('connected')
        } else {
          // Verify meta by attempting to fetch accounts
          fetch('/api/integrations/meta-ads/accounts')
            .then(r => r.json())
            .then(d => setMetaStatus(d.error === 'not_connected' ? 'disconnected' : d.error ? 'error' : 'connected'))
            .catch(() => setMetaStatus('disconnected'))
        }
      })
      .catch(() => {
        setGoogleStatus('disconnected')
        setQbStatus('disconnected')
        setMetaStatus('disconnected')
        setHelcimStatus('disconnected')
      })
  }, [showBanner])

  const handleGoogleDisconnect = async () => {
    if (!confirm('Disconnect Google account? This will stop all Google integrations.')) return
    setDisconnecting(true)
    await fetch('/api/auth/google/disconnect', { method: 'POST' })
    setGoogleStatus('disconnected')
    setDisconnecting(false)
    showBanner('success', 'Google account disconnected.')
  }

  const handleGoogleAdsSync = async () => {
    setGoogleAdsSyncing(true)
    try {
      const res = await fetch('/api/integrations/google-ads/verify', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setLastSynced(prev => ({ ...prev, google_ads: d.synced_at }))
        showBanner('success', `Google Ads verified — ${d.accounts} accessible account${d.accounts !== 1 ? 's' : ''} found.`)
      } else {
        showBanner('error', d.error || 'Google Ads verification failed.')
      }
    } catch {
      showBanner('error', 'Google Ads verification failed.')
    }
    setGoogleAdsSyncing(false)
  }

  const handleGoogleDriveTest = async () => {
    setGoogleDriveSyncing(true)
    try {
      const res = await fetch('/api/integrations/google-drive/test')
      const d = await res.json()
      if (res.ok) {
        setLastSynced(prev => ({ ...prev, google_drive: d.synced_at }))
        showBanner('success', `Google Drive connection OK — root folder accessible.`)
      } else {
        showBanner('error', d.error || 'Google Drive test failed.')
      }
    } catch {
      showBanner('error', 'Google Drive test failed.')
    }
    setGoogleDriveSyncing(false)
  }

  const handleMetaDisconnect = async () => {
    if (!confirm('Disconnect Meta Ads? This will stop all Meta Ads syncing.')) return
    setMetaDisconnecting(true)
    await fetch('/api/auth/meta/disconnect', { method: 'POST' })
    setMetaStatus('disconnected')
    setMetaDisconnecting(false)
    showBanner('success', 'Meta Ads disconnected.')
  }

  const handleMetaSync = async () => {
    setMetaSyncing(true)
    try {
      const res = await fetch('/api/integrations/meta-ads/verify', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setLastSynced(prev => ({ ...prev, meta: d.synced_at }))
        showBanner('success', `Meta Ads verified — ${d.accounts} ad account${d.accounts !== 1 ? 's' : ''} accessible.`)
      } else {
        showBanner('error', d.error || 'Meta Ads verification failed.')
      }
    } catch {
      showBanner('error', 'Meta Ads verification failed.')
    }
    setMetaSyncing(false)
  }

  const handleQbDisconnect = async () => {
    if (!confirm('Disconnect QuickBooks? This will stop all QB syncing.')) return
    setQbDisconnecting(true)
    await fetch('/api/auth/quickbooks/disconnect', { method: 'POST' })
    setQbStatus('disconnected')
    setQbDisconnecting(false)
    showBanner('success', 'QuickBooks disconnected.')
  }

  const handleQbSync = async () => {
    setQbSyncing(true)
    try {
      const res = await fetch('/api/integrations/quickbooks/items/sync', { method: 'POST' })
      const d = await res.json()
      if (res.ok) {
        setLastSynced(prev => ({ ...prev, qb: new Date().toISOString() }))
        showBanner('success', `QuickBooks synced — ${d.synced} products & services imported.`)
      } else {
        showBanner('error', d.error || 'QB sync failed.')
      }
    } catch {
      showBanner('error', 'QB sync failed.')
    }
    setQbSyncing(false)
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
        {/* Google Ads */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔵</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">Google Ads</h2>
                  {googleStatus !== 'loading' && <StatusBadge status={googleStatus} />}
                  {googleStatus === 'loading' && <StatusBadge status="loading" />}
                </div>
                <p className="text-sm text-slate-400 mt-1">Pull campaign performance data for all client accounts via Google Ads MCC. Also enables Google Drive, Analytics, and Search Console.</p>
                {lastSynced.google_ads && googleStatus === 'connected' && (
                  <p className="text-xs text-slate-500 mt-1.5">Last synced: {timeAgo(lastSynced.google_ads)}</p>
                )}
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
                <div className="flex gap-2 flex-wrap justify-end">
                  <button
                    onClick={handleGoogleAdsSync}
                    disabled={googleAdsSyncing}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${googleAdsSyncing ? 'animate-spin' : ''}`} />
                    Sync Data
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

        {/* Google Drive */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="text-2xl">📁</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">Google Drive</h2>
                  {googleStatus === 'loading' ? (
                    <StatusBadge status="loading" />
                  ) : googleStatus === 'connected' ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Connected via Google
                    </div>
                  ) : (
                    <StatusBadge status="disconnected" />
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">Store all client files in Google Drive. Files are organized per client automatically.</p>
                {lastSynced.google_drive && googleStatus === 'connected' && (
                  <p className="text-xs text-slate-500 mt-1.5">Last tested: {timeAgo(lastSynced.google_drive)}</p>
                )}
              </div>
            </div>
            <div className="shrink-0">
              {googleStatus === 'loading' ? (
                <div className="h-9 w-28 skeleton rounded-xl" />
              ) : googleStatus === 'connected' ? (
                <button
                  onClick={handleGoogleDriveTest}
                  disabled={googleDriveSyncing}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${googleDriveSyncing ? 'animate-spin' : ''}`} />
                  Test Connection
                </button>
              ) : (
                <span className="text-xs text-slate-500">Requires Google OAuth</span>
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
                  <StatusBadge status={metaStatus} />
                </div>
                <p className="text-sm text-slate-400 mt-1">Pull Ads Insights data for all connected client ad accounts.</p>
                {lastSynced.meta && metaStatus === 'connected' && (
                  <p className="text-xs text-slate-500 mt-1.5">Last synced: {timeAgo(lastSynced.meta)}</p>
                )}
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
                <div className="flex gap-2 flex-wrap justify-end">
                  <button
                    onClick={handleMetaSync}
                    disabled={metaSyncing}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-white/[0.10] text-slate-300 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${metaSyncing ? 'animate-spin' : ''}`} />
                    Sync Data
                  </button>
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

        {/* QuickBooks Online */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-9 w-9 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">QuickBooks Online</h2>
                  <StatusBadge status={qbStatus} />
                </div>
                <p className="text-sm text-slate-400 mt-1">Sync invoices and client billing with QuickBooks Online.</p>
                {lastSynced.qb && qbStatus === 'connected' && (
                  <p className="text-xs text-slate-500 mt-1.5">Last synced: {timeAgo(lastSynced.qb)}</p>
                )}
                {qbStatus === 'disconnected' && (
                  <ol className="mt-3 space-y-1">
                    {['Connect your QuickBooks Online account', 'Authorize accounting scope', 'Map QB customers per client in their detail page'].map((step, i) => (
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
              {qbStatus === 'loading' ? (
                <div className="h-9 w-24 skeleton rounded-xl" />
              ) : qbStatus === 'connected' ? (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={handleQbSync}
                    disabled={qbSyncing}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-white/[0.08] text-slate-300 rounded-xl hover:bg-white/[0.06] transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${qbSyncing ? 'animate-spin' : ''}`} />
                    Sync Products
                  </button>
                  <button
                    onClick={handleQbDisconnect}
                    disabled={qbDisconnecting}
                    className="px-3 py-1.5 text-sm border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    {qbDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <a href="/api/auth/quickbooks/connect" className="btn-brand">
                  Connect QuickBooks
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Helcim (invoice payments) */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-9 w-9 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-sky-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">Helcim</h2>
                  <StatusBadge status={helcimStatus} />
                </div>
                <p className="text-sm text-slate-400 mt-1">Collect invoice payments online via Helcim Hosted Payment Pages. A "Pay Now" button is added to sent invoices when configured.</p>
                {helcimStatus === 'disconnected' && (
                  <ol className="mt-3 space-y-1">
                    {[
                      'Set HELCIM_API_TOKEN (Payment API token) in your environment',
                      'Set HELCIM_PAYMENT_PAGE_URL to your Hosted Payment Page base URL',
                      'Set HELCIM_WEBHOOK_VERIFIER_TOKEN and point Helcim webhooks at /api/webhooks/payments',
                    ].map((step, i) => (
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
              {helcimStatus === 'loading' ? (
                <div className="h-9 w-24 skeleton rounded-xl" />
              ) : helcimStatus === 'connected' ? (
                <StatusBadge status="connected" />
              ) : (
                <span className="text-xs text-slate-500">Configure via environment</span>
              )}
            </div>
          </div>
        </div>

        {/* Google Analytics 4 */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="text-2xl">📊</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">Google Analytics 4</h2>
                  {googleStatus === 'connected' ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Connected via Google
                    </div>
                  ) : (
                    <StatusBadge status={googleStatus === 'loading' ? 'loading' : 'disconnected'} />
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">Pull website traffic, sessions, and goal data per client.</p>
              </div>
            </div>
            <div className="shrink-0">
              <span className="text-xs text-slate-500">Via Google OAuth</span>
            </div>
          </div>
        </div>

        {/* Google Search Console */}
        <div className="glass-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="text-2xl">🔍</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-white">Google Search Console</h2>
                  {googleStatus === 'connected' ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Connected via Google
                    </div>
                  ) : (
                    <StatusBadge status={googleStatus === 'loading' ? 'loading' : 'disconnected'} />
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">Pull keyword rankings, impressions, and click data per client site.</p>
              </div>
            </div>
            <div className="shrink-0">
              <span className="text-xs text-slate-500">Via Google OAuth</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
