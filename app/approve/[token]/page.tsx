'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type Status = 'loading' | 'approved' | 'rejected' | 'error'

export default function ApprovePage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const action = searchParams.get('action')

  const [status, setStatus] = useState<Status>('loading')
  const [company, setCompany] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => {
    if (!params?.token || (action !== 'approve' && action !== 'reject')) {
      setStatus('error')
      setErrorMsg('This approval link is invalid.')
      return
    }
    fetch(`/api/approve/${params.token}?action=${action}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Something went wrong')
        setCompany(data.company_name || '')
        setStatus(data.action === 'approve' ? 'approved' : 'rejected')
      })
      .catch((err: Error) => {
        setStatus('error')
        setErrorMsg(err.message || 'This approval link is invalid or has already been used.')
      })
  }, [params?.token, action])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-10 text-center">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 mx-auto mb-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            <h1 className="text-xl font-semibold text-slate-100">Processing your response…</h1>
            <p className="text-sm text-slate-400 mt-2">Please wait a moment.</p>
          </>
        )}

        {status === 'approved' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <span className="text-3xl text-emerald-400">✓</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-100">Proposal approved ✓</h1>
            <p className="text-sm text-slate-400 mt-3">
              {company ? `The proposal for ${company} has been approved.` : 'The proposal has been approved.'} The team has been notified.
            </p>
          </>
        )}

        {status === 'rejected' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/15 flex items-center justify-center">
              <span className="text-3xl text-red-400">✕</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-100">Proposal rejected</h1>
            <p className="text-sm text-slate-400 mt-3">
              {company ? `The proposal for ${company} has been rejected.` : 'The proposal has been rejected.'} The team has been notified.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/15 flex items-center justify-center">
              <span className="text-3xl text-amber-400">!</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-100">Link invalid or expired</h1>
            <p className="text-sm text-slate-400 mt-3">{errorMsg}</p>
            <p className="text-xs text-slate-500 mt-4">
              If you believe this is a mistake, contact your account manager.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
