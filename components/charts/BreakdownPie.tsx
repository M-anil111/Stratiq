'use client'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { useChartTheme, colorAt } from './chart-theme'

export interface PieDatum {
  name: string
  value: number
  color?: string
}

interface BreakdownPieProps {
  data: PieDatum[]
  height?: number
  /** Donut hole; set 0 for a full pie. Defaults to donut. */
  innerRadius?: number
  valueFormatter?: (v: number) => string
  className?: string
}

/**
 * Donut / pie breakdown. Theme-aware with a legible legend and tooltip.
 */
export default function BreakdownPie({
  data, height = 260, innerRadius = 56, valueFormatter, className,
}: BreakdownPieProps) {
  const t = useChartTheme()
  const rows = (data || []).filter(d => d && Number(d.value) > 0)

  if (rows.length === 0) {
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

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={Math.max(innerRadius + 28, 88)}
            paddingAngle={2}
            stroke="transparent"
          >
            {rows.map((d, i) => (
              <Cell key={i} fill={d.color || colorAt(i)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: t.tooltipText }}
            formatter={(v: any) => (valueFormatter ? valueFormatter(Number(v)) : Number(v).toLocaleString())}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: t.axis }} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
