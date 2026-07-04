'use client'

import { useState } from 'react'
import CredentialsTab from './CredentialsTab'

const TABS = ['Project Info', 'Submission Details', 'Reporting', 'Files', 'Credentials']

export default function ProjectTabs({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="glass-card">
      <div className="flex border-b border-white/[0.08] overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              i === activeTab
                ? 'bg-white/[0.08] text-white border-sky-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 4 ? (
        <CredentialsTab projectId={projectId} />
      ) : (
        <div className="p-6 text-center text-slate-400">
          <p className="font-medium">Connect your Supabase database to view project details.</p>
          <p className="text-sm mt-1">Configure your environment variables to enable data loading.</p>
        </div>
      )}
    </div>
  )
}
