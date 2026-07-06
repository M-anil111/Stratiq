import { NextResponse } from 'next/server'
import { proofhubConfigured, proofhubAccount } from '@/lib/proofhub'
import { requireStratiqUser } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { res } = await requireStratiqUser()
  if (res) return res
  const configured = proofhubConfigured()
  return NextResponse.json({
    configured,
    account: configured ? proofhubAccount() : null,
  })
}
