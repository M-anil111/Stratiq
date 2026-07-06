'use client'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useChartTheme, colorAt } from './chart-theme'

export interface TrendSeries {
  key: string
  label: string
  color?: string
  /** Format a value for the tooltip / axis (defaults to locale number). */
  format?: (v: number) => string
}

interface TrendChartProps {
  data: Array<Record<string, any>>
  xKey: string
  series: TrendSeries[]
  height?: number
  /** 'area' (filled) or 'line'. Defaults to area. */
  variant?: 'area' | 'line'
  /** Format the X axis tick label. */
  xTickFormatter?: (v: any) => string
  yTickFormatter?: (v: number) => string
  className?: string
}

const defaultFmt = (v: number) => (typeof v === 'number' ? v.toLocaleString() : String(v ?? ''))

/**
 * Trend visualization for metrics over time. Faint grid, legible axes, and a
 * soft gradient area fill. Theme-aware.
 */
export default function TrendChart({
  data, xKey, series, height = 260, variant = 'area',
  xTickFormatter, yTickFormatter, className,
}: TrendChartProps) {
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

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        {variant === 'line' ? (
          <LineChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
            <XAxis dataKey={xKey} {...axisProps} tickFormatter={xTickFormatter} minTickGap={16} />
            <YAxis {...axisProps} width={48} tickFormatter={yTickFormatter} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: t.tooltipText }} cursor={{ stroke: t.grid }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: t.axis }} iconType="circle" />}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color || colorAt(i)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <defs>
              {series.map((s, i) => {
                const c = s.color || colorAt(i)
                return (
                  <linearGradient key={s.key} id={`trend-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                  </linearGradient>
                )
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
            <XAxis dataKey={xKey} {...axisProps} tickFormatter={xTickFormatter} minTickGap={16} />
            <YAxis {...axisProps} width={48} tickFormatter={yTickFormatter} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: t.tooltipText }} cursor={{ stroke: t.grid }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: t.axis }} iconType="circle" />}
            {series.map((s, i) => {
              const c = s.color || colorAt(i)
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={c}
                  strokeWidth={2}
                  fill={`url(#trend-fill-${s.key})`}
                />
              )
            })}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
