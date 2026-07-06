'use client'
import { useState, useRef, useEffect, useId } from 'react'
import { Info } from 'lucide-react'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface InfoHintProps {
  /** Plain-language explanation shown in the tooltip. */
  content: React.ReactNode
  /** Preferred side to render the tooltip. Defaults to 'top'. */
  side?: Side
  /** Accessible label for the trigger. Defaults to 'More information'. */
  label?: string
  className?: string
  /** Icon size in pixels. Defaults to 14. */
  size?: number
}

const positions: Record<Side, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/**
 * A small "i" icon that reveals a plain-language explanation on hover or
 * keyboard focus. Theme-aware (light/dark), keyboard-accessible, and
 * positioned so the bubble does not clip inside cards.
 */
export function InfoHint({
  content,
  side = 'top',
  label = 'More information',
  className = '',
  size = 14,
}: InfoHintProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const id = useId()

  const show = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(true), 120)
  }
  const hide = () => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return (
    <span
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={visible ? id : undefined}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault()
          setVisible((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide()
        }}
        className="inline-flex items-center justify-center rounded-full text-slate-400 hover:text-sky-500 dark:text-slate-500 dark:hover:text-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 transition-colors cursor-help"
      >
        <Info style={{ width: size, height: size }} />
      </button>
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={`absolute z-50 ${positions[side]} pointer-events-none`}
        >
          <span className="relative block w-max max-w-[240px] px-3 py-2 text-xs leading-snug whitespace-normal rounded-lg shadow-xl border bg-white text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/70">
            {content}
          </span>
        </span>
      )}
    </span>
  )
}

export default InfoHint
