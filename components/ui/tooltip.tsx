'use client'
import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function Tooltip({ content, children, side = 'top', delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<NodeJS.Timeout>()

  const show = () => { timerRef.current = setTimeout(() => setVisible(true), delay) }
  const hide = () => { clearTimeout(timerRef.current); setVisible(false) }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const positions: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrows: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-700 border-x-transparent border-b-transparent border-4',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-700 border-x-transparent border-t-transparent border-4',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-700 border-y-transparent border-r-transparent border-4',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-700 border-y-transparent border-l-transparent border-4',
  }

  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <span role="tooltip"
          className={`absolute z-50 ${positions[side]} pointer-events-none`}>
          <span className="relative block max-w-[220px] px-3 py-1.5 text-xs text-slate-200 bg-slate-800 border border-slate-700/60 rounded-lg shadow-xl whitespace-normal leading-snug">
            {content}
            <span className={`absolute border ${arrows[side]}`} />
          </span>
        </span>
      )}
    </span>
  )
}

// Convenience: wrap an info icon with a tooltip
import { Info } from 'lucide-react'
export function InfoTooltip({ content, side }: { content: string; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip content={content} side={side}>
      <Info className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300 cursor-help transition-colors" />
    </Tooltip>
  )
}
