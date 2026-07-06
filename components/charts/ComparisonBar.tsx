'use client'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts'
import { useChartTheme, colorAt } from './chart-theme'

export interface BarSeries {
  key: string
  label: string
  color?: string
}

interface ComparisonBarProps {
  data: Array<Record<string, any>>
  xKey: string
  series: BarSeries[]
  height?: number
  layout?: 'horizontal' | 'vertical'
  xTickFormatter?: (v: any) => string
  yTickFormatter?: (v: number) => string
  /** Colour each bar of a single series distinctly (categorical). */
  colorByCategory?: boolean
  className?: string
}

/**
 * Bar comparison chart. Theme-aware, faint grid, rounded bars.
 */
export default function ComparisonBar({
  data, xKey, series, height = 260, layout = 'horizontal',
  xTickFormatter, yTickFormatter, colorByCategory = false, className,
}: ComparisonBarProps) {
  const t = useChartTheme()
  const hasData = Array.isArray(data) && data.length > 0

  if (!hasData) {
    return (
      <div className={className} style={{ height }}>
        <div className="h-full w-full flex items-center justify-center text-sm text-slate-500">
          No data for this range
        </div>
      </div>
    )
  }

  const tooltipStyle = {
    background: t.tooltipBg,
    border: `1px solid ${t.tooltipBorder}`,
    borderRadius: 12,
    color: t.tooltipText,
    fontSize: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  }
  const axisProps = {
    stroke: t.axis,
    tick: { fill: t.axis, fontSize: 11 },
    tickLine: false,
    axisLine: false,
  }
  const vertical = layout === 'vertical'

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={vertical} horizontal={!vertical} />
          {vertical ? (
            <>
              <XAxis type="number" {...axisProps} tickFormatter={yTickFormatter} />
              <YAxis type="category" dataKey={xKey} {...axisProps} width={120} tickFormatter={xTickFormatter} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axisProps} tickFormatter={xTickFormatter} minTickGap={8} />
              <YAxis {...axisProps} width={48} tickFormatter={yTickFormatter} />
            </>
          )}
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: t.tooltipText }} cursor={{ fill: t.grid }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: t.axis }} iconType="circle" />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color || colorAt(i)} radius={vertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={54}>
              {colorByCategory && series.length === 1 && data.map((_, idx) => (
                <Cell key={idx} fill={colorAt(idx)} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
