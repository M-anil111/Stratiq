'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MAX_CHARS = 2000
const WARN_CHARS = 1800
const POLL_INTERVAL = 30_000
const FALLBACK_POLL_INTERVAL = 60_000

interface Message {
  id: string
  content: string
  sender_type: 'client' | 'staff'
  sender_name: string | null
  created_at: string
  client_id?: string
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return time
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

function initials(name: string | null, fallback: string): string {
  if (!name) return fallback.slice(0, 2).toUpperCase()
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function SkeletonBubble({ align }: { align: 'left' | 'right' }) {
  return (
    <div className={`flex items-end gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className="w-8 h-8 rounded-full shrink-0 animate-pulse bg-slate-900/[0.08] dark:bg-white/[0.08]" />
      <div
        className={`animate-pulse rounded-2xl ${align === 'right' ? 'rounded-br-sm bg-sky-500/30' : 'rounded-bl-sm bg-slate-900/[0.08] dark:bg-white/[0.08]'}`}
        style={{ height: 56, width: align === 'right' ? 220 : 260 }}
      />
    </div>
  )
}

export default function PortalMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/messages')
      if (res.ok) {
        const data: Message[] = (await res.json()) || []
        setMessages(data)
        const withClientId = data.find((m) => m.client_id)
        if (withClientId?.client_id) {
          setClientId((prev) => prev ?? withClientId.client_id!)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const startPolling = useCallback(
    (interval: number) => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(fetchMessages, interval)
    },
    [fetchMessages]
  )

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Initial load + default polling (until realtime takes over)
  useEffect(() => {
    fetchMessages()
    startPolling(POLL_INTERVAL)
    return () => stopPolling()
  }, [fetchMessages, startPolling, stopPolling])

  // Supabase Realtime subscription — degrades silently to polling on failure
  useEffect(() => {
    if (!clientId) return
    let supabase: ReturnType<typeof createClient>
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      supabase = createClient()
      channel = supabase
        .channel(`messages-${clientId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `client_id=eq.${clientId}`,
          },
          (payload) => {
            const msg = payload.new as Message
            if (!msg?.id) return
            setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Realtime is live — no need to poll
            stopPolling()
          } else {
            // Channel failed / closed — fall back to slow polling
            startPolling(FALLBACK_POLL_INTERVAL)
          }
        })
    } catch {
      startPolling(FALLBACK_POLL_INTERVAL)
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch {
        // ignore
      }
    }
  }, [clientId, startPolling, stopPolling])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || sending || trimmed.length > MAX_CHARS) return
    setSending(true)
    try {
      const res = await fetch('/api/portal/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (res.ok) {
        const msg: Message = await res.json()
        setMessages((prev) => [...prev, msg])
        setInput('')
        textareaRef.current?.focus()
      }
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const charsLeft = MAX_CHARS - input.length
  const showCount = input.length >= WARN_CHARS

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)]">
      {/* Header */}
      <div
        className="p-4 lg:px-8 lg:pt-8 lg:pb-5 border-b border-slate-900/10 dark:border-white/[0.08] shrink-0"
        style={{ background: 'rgba(6,10,18,0.6)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none">Messages</h1>
            <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">Chat with your account team</p>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 lg:px-8 space-y-4">
        {loading ? (
          <>
            <SkeletonBubble align="left" />
            <SkeletonBubble align="right" />
            <SkeletonBubble align="left" />
          </>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900/[0.04] dark:bg-white/[0.04] flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-slate-600 dark:text-slate-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No messages yet.</p>
            <p className="text-slate-600 text-xs">Start the conversation below.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isClient = msg.sender_type === 'client'
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isClient ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isClient
                      ? 'bg-sky-500/30 text-sky-300'
                      : 'bg-slate-900/[0.08] dark:bg-white/[0.08] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {initials(msg.sender_name, isClient ? 'ME' : 'ST')}
                </div>

                {/* Bubble */}
                <div className={`max-w-[75%] ${isClient ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isClient && (
                    <p className="text-[11px] font-medium mb-1 text-slate-600 dark:text-slate-400 px-1">
                      {msg.sender_name || 'Staff'}
                    </p>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isClient
                        ? 'bg-sky-500 text-white rounded-br-sm'
                        : 'glass text-slate-200 rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p
                      className={`text-[10px] mt-1.5 ${
                        isClient ? 'text-sky-200/70 text-right' : 'text-slate-600 dark:text-slate-500'
                      }`}
                    >
                      {formatTimestamp(msg.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div
        className="p-4 lg:px-8 lg:pb-6 border-t border-slate-900/10 dark:border-white/[0.08] shrink-0"
        style={{ background: 'rgba(6,10,18,0.6)' }}
      >
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              rows={1}
              className="input-glass w-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none min-h-[44px] max-h-32 overflow-y-auto leading-relaxed"
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            {showCount && (
              <span
                className={`absolute bottom-2 right-3 text-[10px] pointer-events-none ${
                  charsLeft < 0 ? 'text-red-400' : 'text-slate-600 dark:text-slate-500'
                }`}
              >
                {charsLeft}
              </span>
            )}
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending || input.length > MAX_CHARS}
            className="btn-brand p-2.5 rounded-xl transition-all disabled:opacity-40 shrink-0 self-end mb-0.5"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        {showCount && (
          <p className={`text-[10px] mt-1 ${charsLeft < 0 ? 'text-red-400' : 'text-slate-600 dark:text-slate-500'}`}>
            {charsLeft < 0
              ? `${Math.abs(charsLeft)} characters over limit`
              : `${charsLeft} characters remaining`}
          </p>
        )}
      </div>
    </div>
  )
}
