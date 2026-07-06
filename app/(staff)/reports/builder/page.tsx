'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Trash2, Save, FolderOpen, Table2, LineChart as LineIcon, BarChart3, PieChart, Loader2, Printer } from 'lucide-react'
import { TrendChart, ComparisonBar, BreakdownPie } from '@/components/charts'
import DateRangeControl from '../_components/DateRangeControl'
import { useDateRange, RangePreset } from '../_components/useDateRange'
import { openBrandedPrint, metricTableHtml } from '../_components/printReport'

// ─── Metric / dimension / visualization vocabulary ───────────────────────────
type Viz = 'table' | 'line' | 'bar' | 'pie'
type MetricKey = 'spend' | 'impressions' | 'clicks' | 'conversions' | 'revenue' | 'published' | 'engagement'
type DimensionKey = 'month' | 'network' | 'client' | 'platform'

interface Block {
  id: string
  title: string
  metric: MetricKey
  dimension: DimensionKey
  viz: Viz
}

const METRICS: { key: MetricKey; label: string; source: 'ads' | 'social'; currency?: boolean }[] = [
  { key: 'spend', label: 'Ad Spend', source: 'ads', currency: true },
  { key: 'impressions', label: 'Impressions', source: 'ads' },
  { key: 'clicks', label: 'Clicks', source: 'ads' },
  { key: 'conversions', label: 'Conversions', source: 'ads' },
  { key: 'revenue', label: 'Revenue', source: 'ads', currency: true },
  { key: 'published', label: 'Posts Published', source: 'social' },
  { key: 'engagement', label: 'Engagement', source: 'social' },
]
const DIMENSIONS: { key: DimensionKey; label: string; source: 'ads' | 'social' }[] = [
  { key: 'month', label: 'Month', source: 'ads' },
  { key: 'network', label: 'Network', source: 'ads' },
  { key: 'client', label: 'Client', source: 'ads' },
  { key: 'platform', label: 'Platform', source: 'social' },
]
const VIZ_OPTIONS: { key: Viz; label: string; icon: any }[] = [
  { key: 'table', label: 'Table', icon: Table2 },
  { key: 'line', label: 'Line', icon: LineIcon },
  { key: 'bar', label: 'Bar', icon: BarChart3 },
  { key: 'pie', label: 'Pie', icon: PieChart },
]

const metricMeta = (k: MetricKey) => METRICS.find(m => m.key === k)!
const labelize = (p: string) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Unknown')
const fmtMonth = (key: string) => {
  const [y, m] = String(key).split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}
const fmtVal = (v: number, currency?: boolean) =>
  currency ? `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : Number(v).toLocaleString()

const selectClass = 'bg-slate-900/[0.04] dark:bg-[rgba(255,255,255,0.06)] border border-slate-900/10 dark:border-white/[0.12] text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50'

interface AdsReport {
  by_network: Record<string, any>
  by_client: any[]
  by_month: any[]
}
interface SocialReport {
  by_platform: { platform: string; published: number; engagement: Record<string, number> }[]
}
interface SavedDefinition {
  id: string
  name: string
  description?: string | null
  blocks: Block[]
  date_range?: { preset?: RangePreset }
}

let blockSeq = 0
const newBlock = (): Block => ({
  id: `b${Date.now()}_${blockSeq++}`,
  title: 'New block',
  metric: 'spend',
  dimension: 'month',
  viz: 'line',
})

// Build a { name, value }[] dataset for a block from the fetched reports.
function buildDataset(block: Block, ads: AdsReport | null, social: SocialReport | null): { name: string; value: number }[] {
  const { metric, dimension } = block
  const m = metricMeta(metric)
  if (dimension === 'platform') {
    return (social?.by_platform || []).map(p => ({
      name: labelize(p.platform),
      value: metric === 'published' ? p.published
        : metric === 'engagement' ? (p.engagement?.likes || 0) + (p.engagement?.comments_count || 0) + (p.engagement?.shares || 0)
        : Number(p.engagement?.[metric] || 0),
    }))
  }
  if (m.source === 'social') return [] // social metric needs the platform dimension
  if (dimension === 'month') {
    return (ads?.by_month || []).map((r: any) => ({ name: fmtMonth(r.month), value: Number(r[metric] || 0) }))
  }
  if (dimension === 'network') {
    return ['meta', 'google'].map(n => ({ name: labelize(n), value: Number(ads?.by_network?.[n]?.[metric] || 0) }))
  }
  if (dimension === 'client') {
    return (ads?.by_client || [])
      .map((c: any) => ({ name: `${c.company_name} · ${labelize(c.network)}`, value: Number(c[metric] || 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }
  return []
}

function BlockPreview({ block, ads, social }: { block: Block; ads: AdsReport | null; social: SocialReport | null }) {
  const data = useMemo(() => buildDataset(block, ads, social), [block, ads, social])
  const m = metricMeta(block.metric)

  if (data.length === 0) {
    return <p className="text-sm text-slate-500 italic py-8 text-center">No data for this metric/dimension combination.</p>
  }
  if (block.viz === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 font-medium">{DIMENSIONS.find(d => d.key === block.dimension)?.label}</th>
              <th className="pb-2 font-medium text-right">{m.label}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-t border-slate-900/10 dark:border-white/[0.08]">
                <td className="py-2 text-slate-700 dark:text-slate-300">{r.name}</td>
                <td className="py-2 text-right text-slate-900 dark:text-white tabular-nums">{fmtVal(r.value, m.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (block.viz === 'line') {
    return <TrendChart data={data} xKey="name" variant="line" series={[{ key: 'value', label: m.label }]} yTickFormatter={(v) => fmtVal(v, m.currency)} />
  }
  if (block.viz === 'bar') {
    return <ComparisonBar data={data} xKey="name" colorByCategory series={[{ key: 'value', label: m.label }]} yTickFormatter={(v) => fmtVal(v, m.currency)} />
  }
  return <BreakdownPie data={data} valueFormatter={(v) => fmtVal(v, m.currency)} />
}

export default function ReportBuilderPage() {
  const range = useDateRange('90d')
  const [reportName, setReportName] = useState('Untitled report')
  const [blocks, setBlocks] = useState<Block[]>([newBlock()])
  const [ads, setAds] = useState<AdsReport | null>(null)
  const [social, setSocial] = useState<SocialReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<SavedDefinition[]>([])
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [currentId, setCurrentId] = useState<string | null>(null)

  // Fetch data for previews.
  useEffect(() => {
    setLoading(true)
    const p = new URLSearchParams({ start: range.start, end: range.end })
    Promise.all([
      fetch('/api/reports/ads?months=12').then(r => r.json()).then(d => setAds(d?.summary ? d : null)).catch(() => setAds(null)),
      fetch(`/api/reports/social?${p}`).then(r => r.json()).then(setSocial).catch(() => setSocial(null)),
    ]).finally(() => setLoading(false))
  }, [range.start, range.end])

  const loadDefinitions = useCallback(() => {
    fetch('/api/reports/builder?definitions=1')
      .then(r => r.json())
      .then(d => setSaved(Array.isArray(d?.definitions) ? d.definitions : []))
      .catch(() => setSaved([]))
  }, [])
  useEffect(() => { loadDefinitions() }, [loadDefinitions])

  const updateBlock = (id: string, patch: Partial<Block>) =>
    setBlocks(bs => bs.map(b => (b.id === id ? { ...b, ...patch } : b)))
  const removeBlock = (id: string) => setBlocks(bs => bs.filter(b => b.id !== id))
  const addBlock = () => setBlocks(bs => [...bs, newBlock()])

  const saveDefinition = async () => {
    if (!reportName.trim()) { setStatus('Enter a report name first.'); return }
    setSaving(true); setStatus('')
    try {
      const res = await fetch('/api/reports/builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definition: {
            id: currentId || undefined,
            name: reportName.trim(),
            blocks,
            date_range: { preset: range.preset },
          },
        }),
      })
      const d = await res.json()
      if (!res.ok) { setStatus(d.error || 'Failed to save'); return }
      if (d.definition?.id) setCurrentId(String(d.definition.id))
      setStatus(`Saved "${reportName.trim()}".`)
      loadDefinitions()
      setTimeout(() => setStatus(''), 3000)
    } catch {
      setStatus('Network error saving report')
    } finally {
      setSaving(false)
    }
  }

  const openDefinition = (def: SavedDefinition) => {
    setReportName(def.name)
    setBlocks(Array.isArray(def.blocks) && def.blocks.length ? def.blocks.map(b => ({ ...b })) : [newBlock()])
    setCurrentId(String(def.id))
    if (def.date_range?.preset) range.setPreset(def.date_range.preset)
    setStatus(`Loaded "${def.name}".`)
    setTimeout(() => setStatus(''), 3000)
  }

  const deleteDefinition = async (id: string) => {
    setSaved(s => s.filter(d => String(d.id) !== String(id)))
    if (currentId === String(id)) setCurrentId(null)
    await fetch(`/api/reports/builder?definition_id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
  }

  const downloadPdf = () => {
    openBrandedPrint({
      title: reportName,
      periodLabel: range.rangeLabel,
      sections: blocks.map(b => {
        const data = buildDataset(b, ads, social)
        const m = metricMeta(b.metric)
        return {
          heading: b.title || m.label,
          html: metricTableHtml(data.map(r => [r.name, fmtVal(r.value, m.currency)] as [string, string])),
        }
      }),
    })
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Custom Report Builder</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">Assemble metrics, dimensions and visualizations into a saved report</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadPdf} className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm border border-slate-900/10 dark:border-white/[0.10] text-slate-700 dark:text-slate-300 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] rounded-xl transition-all">
            <Printer className="h-4 w-4" /> Download PDF
          </button>
          <button onClick={saveDefinition} disabled={saving} className="btn-brand inline-flex items-center gap-1.5 text-sm px-4 py-2.5 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {currentId ? 'Update' : 'Save'} report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: config */}
        <div className="space-y-4 lg:col-span-1">
          <div className="glass-card p-5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Report name</label>
            <input value={reportName} onChange={e => setReportName(e.target.value)} className="input-glass w-full" placeholder="e.g. Q3 Client Performance" />
            {status && <p className="text-xs text-sky-400 mt-2">{status}</p>}
          </div>

          <DateRangeControl range={range} />

          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Saved reports</h2>
            </div>
            {saved.length === 0 ? (
              <p className="text-xs text-slate-500">No saved reports yet.</p>
            ) : (
              <div className="space-y-2">
                {saved.map(def => (
                  <div key={def.id} className="flex items-center justify-between bg-slate-900/[0.04] dark:bg-white/[0.04] rounded-xl px-3 py-2">
                    <button onClick={() => openDefinition(def)} className="text-left min-w-0 flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate">{def.name}</p>
                      <p className="text-xs text-slate-500">{(def.blocks?.length || 0)} block{(def.blocks?.length || 0) === 1 ? '' : 's'}</p>
                    </button>
                    <button onClick={() => deleteDefinition(String(def.id))} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: blocks + preview */}
        <div className="space-y-4 lg:col-span-2">
          {blocks.map((block, idx) => {
            const dimOptions = DIMENSIONS.filter(d =>
              metricMeta(block.metric).source === 'social' ? d.key === 'platform' : d.key !== 'platform',
            )
            return (
              <div key={block.id} className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    value={block.title}
                    onChange={e => updateBlock(block.id, { title: e.target.value })}
                    className="input-glass flex-1 text-sm font-medium"
                    placeholder={`Block ${idx + 1}`}
                  />
                  {blocks.length > 1 && (
                    <button onClick={() => removeBlock(block.id)} className="text-slate-500 hover:text-red-400 transition-colors p-2">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Metric</label>
                    <select
                      value={block.metric}
                      onChange={e => {
                        const metric = e.target.value as MetricKey
                        const src = metricMeta(metric).source
                        const dimension: DimensionKey = src === 'social' ? 'platform' : (block.dimension === 'platform' ? 'month' : block.dimension)
                        updateBlock(block.id, { metric, dimension })
                      }}
                      className={`${selectClass} w-full`}
                    >
                      {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Dimension</label>
                    <select value={block.dimension} onChange={e => updateBlock(block.id, { dimension: e.target.value as DimensionKey })} className={`${selectClass} w-full`}>
                      {dimOptions.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Visualization</label>
                    <div className="flex gap-1">
                      {VIZ_OPTIONS.map(v => {
                        const Icon = v.icon
                        return (
                          <button
                            key={v.key}
                            onClick={() => updateBlock(block.id, { viz: v.key })}
                            title={v.label}
                            className={`flex-1 flex items-center justify-center py-2 rounded-lg border transition-all ${
                              block.viz === v.key
                                ? 'bg-sky-500 text-white border-transparent'
                                : 'border-slate-900/10 dark:border-white/[0.12] text-slate-600 dark:text-slate-400 hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-900/10 dark:border-white/[0.08] pt-4">
                  {loading ? (
                    <div className="h-40 flex items-center justify-center text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                    </div>
                  ) : (
                    <BlockPreview block={block} ads={ads} social={social} />
                  )}
                </div>
              </div>
            )
          })}

          <button
            onClick={addBlock}
            className="w-full glass-card p-4 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-dashed border-slate-900/15 dark:border-white/[0.12] transition-colors"
          >
            <Plus className="h-4 w-4" /> Add block
          </button>
        </div>
      </div>
    </div>
  )
}
