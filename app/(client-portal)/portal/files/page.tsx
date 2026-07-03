'use client'
import { useEffect, useState } from 'react'
import { FileText, ExternalLink, Folder } from 'lucide-react'

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <span className="text-red-500"><FileText className="h-8 w-8" /></span>
  if (['doc', 'docx'].includes(ext || '')) return <span className="text-blue-500"><FileText className="h-8 w-8" /></span>
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return <span className="text-green-500"><FileText className="h-8 w-8" /></span>
  return <span className="text-gray-400"><FileText className="h-8 w-8" /></span>
}

export default function PortalFilesPage() {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal/files').then(r => r.json()).then(d => { setFiles(d || []); setLoading(false) })
  }, [])

  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Files</h1>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          <Folder className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No files shared yet</p>
          <p className="text-sm mt-1">Your account manager will share files here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map(file => (
            <div key={file.id} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col items-center gap-2 hover:shadow-md transition-shadow">
              {fileIcon(file.name)}
              <p className="text-xs font-medium text-gray-700 text-center line-clamp-2">{file.name}</p>
              <p className="text-xs text-gray-400">{new Date(file.createdTime).toLocaleDateString()}</p>
              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium">
                <ExternalLink className="h-3 w-3" /> Open
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
