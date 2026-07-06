import { NextResponse } from 'next/server'
import { listPeople, personName } from '@/lib/proofhub'
import { requireStratiqUser, ensureConfigured, notConfigured, phErrorResponse } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { res } = await requireStratiqUser()
  if (res) return res
  if (!ensureConfigured()) return notConfigured()
  try {
    const people = await listPeople()
    return NextResponse.json({
      configured: true,
      people: people.map((p) => ({
        id: p.id,
        name: personName(p),
        email: p.email || null,
        avatar: p.avatar || p.image_url || null,
      })),
    })
  } catch (e) {
    return phErrorResponse(e)
  }
}
