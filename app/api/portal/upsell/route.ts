import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUpsellRecommendations } from '@/lib/upsell-engine'
import { sendEmail } from '@/lib/email/index'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json([])

  const { data: projects } = await supabase
    .from('projects')
    .select('services')
    .eq('client_id', portalAccess.client_id)

  const allServices = (projects || []).flatMap(p => p.services || [])
  const unique = Array.from(new Set(allServices))
  const recommendations = getUpsellRecommendations(unique)
  return NextResponse.json(recommendations)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccess } = await supabase
    .from('client_portal_access')
    .select('client_id, clients(name, organization_id)')
    .eq('user_id', user.id)
    .single()

  if (!portalAccess) return NextResponse.json({ error: 'No access' }, { status: 403 })

  const body = await request.json()
  const service: string = body.service || body.interested_in

  const clientName = (portalAccess.clients as any)?.name || 'A client'
  const organizationId = (portalAccess.clients as any)?.organization_id

  // Log upsell interest — gracefully handle missing table (42P01)
  const { error: insertError } = await supabase.from('upsell_analytics').insert({
    client_id: portalAccess.client_id,
    organization_id: organizationId,
    services_requested: service,
    status: 'pending',
  })

  if (insertError) {
    if (insertError.code === '42P01') {
      console.log('[upsell] upsell_analytics table not found — skipping DB log', { client_id: portalAccess.client_id, service })
    } else {
      console.error('[upsell] Failed to insert upsell_analytics:', insertError)
    }
  }

  // Notify the account manager (org admin) by email
  try {
    if (organizationId) {
      const { data: adminUser } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('organization_id', organizationId)
        .eq('role', 'admin')
        .limit(1)
        .single()

      if (adminUser?.email) {
        await sendEmail({
          to: adminUser.email,
          subject: `Client interest: ${clientName} wants to know about ${service}`,
          html: `
            <p>Hi ${adminUser.full_name || 'there'},</p>
            <p><strong>${clientName}</strong> has expressed interest in <strong>${service}</strong> via the client portal.</p>
            <p>They are expecting to hear back within 24 hours. Please reach out to discuss next steps.</p>
            <p style="margin-top:24px;color:#888;font-size:12px;">— Stratiq Portal Notifications</p>
          `,
        })
      }
    }
  } catch (emailErr) {
    console.error('[upsell] Failed to send account manager notification:', emailErr)
  }

  return NextResponse.json({ ok: true })
}
