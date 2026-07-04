'use client'
import { useEffect, useState } from 'react'
import { FileText, ExternalLink, Folder } from 'lucide-react'

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <span className="text-red-400"><FileText className="h-8 w-8" /></span>
  if (['doc', 'docx'].includes(ext || '')) return <span className="text-blue-400"><FileText className="h-8 w-8" /></span>
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <span className="text-green-400"><FileText className="h-8 w-8" /></span>
  return <span className="text-slate-400"><FileText className="h-8 w-8" /></span>
}

export default function PortalFilesPage() {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/files').then(r => r.json()).then(d => { setFiles(d || []); setLoading(false) })
  }, [])

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Files</h1>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/[0.04] rounded-xl animate-pulse" />)}
        </div>
      ) : files.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400">
          <Folder className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No files shared yet</p>
          <p className="text-sm mt-1">Your account manager will share files here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map(file => (
            <div key={file.id} className="glass-card p-4 flex flex-col items-center gap-2 hover:bg-white/[0.03] transition-all">
              {fileIcon(file.name)}
              <p className="text-xs font-medium text-slate-300 text-center line-clamp-2">{file.name}</p>
              <p className="text-xs text-slate-400">{new Date(file.createdTime).toLocaleDateString()}</p>
              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors">
                <ExternalLink className="h-3 w-3" /> Open
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
