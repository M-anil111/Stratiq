'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Globe, Mail, Phone, MapPin, ExternalLink, Send, FileText, Plus, Folder } from 'lucide-react'

const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  hold: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-700',
  onboarding: 'bg-violet-100 text-violet-800',
  prospect: 'bg-blue-100 text-blue-800',
}

const TABS = ['Overview', 'Projects', 'Reports', 'Messages', 'Files']

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [projects, setProjects] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/clients/${params.id}`)
      .then(r => r.json())
      .then(d => { setClient(d); setLoading(false) })
  }, [params.id])

  useEffect(() => {
    if (activeTab === 1) {
      fetch(`/api/clients/${params.id}/projects`).then(r => r.json()).then(setProjects)
    }
    if (activeTab === 3) {
      fetch(`/api/messages?clientId=${params.id}`).then(r => r.json()).then(d => setMessages(d || []))
    }
    if (activeTab === 4) {
      fetch(`/api/clients/${params.id}/files`).then(r => r.json()).then(d => setFiles(d || []))
    }
  }, [activeTab, params.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!msgInput.trim() || sending) return
    setSending(true)
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: params.id, content: msgInput }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages(m => [...m, msg])
      setMsgInput('')
    }
    setSending(false)
  }

  if (loading) return (
    <div className="p-4 lg:p-8 space-y-4">
      <div className="h-10 w-48 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  )

  if (!client || client.error) return (
    <div className="p-8 text-center text-gray-400">
      <p className="font-medium">Client not found</p>
      <button onClick={() => router.push('/clients')} className="mt-4 text-sky-600 text-sm">← Back to clients</button>
    </div>
  )

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => router.push('/clients')} className="mt-1 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{client.company_name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[client.project_status] || 'bg-gray-100 text-gray-700'}`}>
              {client.project_status}
            </span>
          </div>
          {client.website && (
            <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 mt-1">
              <Globe className="h-3.5 w-3.5" />
              {client.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
        <a href={`/clients/${params.id}/edit`} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
          <Edit2 className="h-4 w-4" /> Edit
        </a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === i ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Contact & Location</h2>
            {[
              { icon: Mail, label: 'Email', value: client.email },
              { icon: Phone, label: 'Phone', value: client.phone },
              { icon: MapPin, label: 'Address', value: [client.street_address, client.city, client.state, client.country].filter(Boolean).join(', ') },
            ].map(row => row.value ? (
              <div key={row.label} className="flex items-start gap-3">
                <row.icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">{row.label}</p>
                  <p className="text-sm text-gray-900">{row.value}</p>
                </div>
              </div>
            ) : null)}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Business Info</h2>
            {[
              { label: 'Industry', value: client.industry },
              { label: 'Company Size', value: client.num_employees ? `${client.num_employees} employees` : null },
              { label: 'Services', value: client.services?.join(', ') },
              { label: 'Advertising Types', value: client.advertising_types?.join(', ') },
              { label: 'Target Audience', value: client.target_audience },
            ].map(row => row.value ? (
              <div key={row.label}>
                <p className="text-xs text-gray-500">{row.label}</p>
                <p className="text-sm text-gray-900">{row.value}</p>
              </div>
            ) : null)}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Team</h2>
            {client.sales_manager && (
              <div>
                <p className="text-xs text-gray-500">Sales Manager</p>
                <p className="text-sm font-medium text-gray-900">{client.sales_manager.full_name}</p>
              </div>
            )}
            {client.dm_manager && (
              <div>
                <p className="text-xs text-gray-500">DM Manager</p>
                <p className="text-sm font-medium text-gray-900">{client.dm_manager.full_name}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Links</h2>
            {client.google_drive_folder_url && (
              <a href={client.google_drive_folder_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700">
                <ExternalLink className="h-3.5 w-3.5" /> Google Drive Folder
              </a>
            )}
            {client.ndisk_link && (
              <a href={client.ndisk_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-700">
                <ExternalLink className="h-3.5 w-3.5" /> nDisk
              </a>
            )}
          </div>
        </div>
      )}

      {/* Projects */}
      {activeTab === 1 && (
        <div>
          <div className="flex justify-end mb-4">
            <a href={`/clients/${params.id}/projects/new`} className="flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg">
              <Plus className="h-4 w-4" /> Add Project
            </a>
          </div>
          {projects.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No projects yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(p => (
                <a key={p.id} href={`/clients/${params.id}/projects/${p.id}`} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{p.domain}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || ''}`}>{p.status}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reports */}
      {activeTab === 2 && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
          <p className="font-medium">Client reports coming soon</p>
          <a href="/reports/marketing" className="mt-3 inline-block text-sm text-sky-600 hover:text-sky-700">Go to Marketing Reports →</a>
        </div>
      )}

      {/* Messages */}
      {activeTab === 3 && (
        <div className="flex flex-col h-[500px] bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No messages yet</div>
            ) : messages.map(msg => {
              const isStaff = msg.sender_type === 'staff'
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isStaff ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isStaff ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'}`}>
                    {(msg.sender_name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </div>
                  <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${isStaff ? 'bg-sky-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                    {!isStaff && <p className="text-xs font-medium mb-0.5 text-gray-500">{msg.sender_name}</p>}
                    <p>{msg.content}</p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Message client..." />
            <button onClick={sendMessage} disabled={!msgInput.trim() || sending}
              className="p-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Files */}
      {activeTab === 4 && (
        <div>
          {files.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
              <Folder className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No files yet</p>
              <p className="text-sm mt-1">Files uploaded to Google Drive for this client will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map(file => (
                <div key={file.id} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-gray-400" />
                  <p className="text-xs font-medium text-gray-700 text-center line-clamp-2">{file.name}</p>
                  <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:text-sky-700">Open</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
