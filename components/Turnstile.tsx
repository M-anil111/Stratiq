'use client'
import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, any>) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit'

// Renders the Cloudflare Turnstile widget and reports the verification token
// via onVerify. Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set,
// so forms work unchanged before the widget is configured in Cloudflare.
export default function Turnstile({ onVerify }: { onVerify: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    if (!siteKey) return

    if (window.turnstile) {
      setScriptReady(true)
      return
    }

    const existing = document.querySelector(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`)
    if (existing) {
      window.onloadTurnstileCallback = () => setScriptReady(true)
      return
    }

    window.onloadTurnstileCallback = () => setScriptReady(true)
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [siteKey])

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile) return
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      'expired-callback': () => onVerify(''),
      'error-callback': () => onVerify(''),
    })
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, scriptReady])

  if (!siteKey) return null

  return <div ref={containerRef} className="flex justify-center" />
}
