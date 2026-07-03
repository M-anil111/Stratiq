'use client'
import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'

export default function PortalMessagesPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/portal/messages').then(r => r.json()).then(d => setMessages(d || []))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const res = await fetch('/api/portal/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(m => [...m, msg])
      setInput('')
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)]">
      <div className="p-4 lg:px-8 lg:pt-8 border-b border-gray-100 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Messages</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:px-8 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">No messages yet. Send your first message below.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_type === 'client'
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'}`}>
                  {(msg.sender_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-sky-500 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {!isMe && <p className="text-xs font-medium mb-1 text-gray-500">{msg.sender_name}</p>}
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-sky-200' : 'text-gray-400'}`}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 lg:px-8 bg-white border-t border-gray-100">
        <div className="flex items-center gap-3">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Type a message..." />
          <button onClick={sendMessage} disabled={!input.trim() || sending}
            className="p-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl transition-colors">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
