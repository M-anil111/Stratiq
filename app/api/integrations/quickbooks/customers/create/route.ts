import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQBToken } from '@/lib/quickbooks'
import { requireRole, MANAGER_ROLES } from '@/lib/authz'

// POST /api/integrations/quickbooks/customers/create
// Creates a QB customer from a Stratiq client and saves the mapping.
// Body: { clientId: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const authz = await requireRole(supabase, user.id, MANAGER_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const { clientId } = await req.json()
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  // Fetch the client
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('organization_id', userData.organization_id)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // If the client is already linked to a QB customer, don't create a duplicate.
  if (client.qb_customer_id) {
    return NextResponse.json({ qb_customer_id: String(client.qb_customer_id), display_name: client.company_name, already_linked: true })
  }

  try {
    const { token, realmId } = await getQBToken(supabase)
    const isSandbox = process.env.QUICKBOOKS_SANDBOX === 'true'
    const base = isSandbox
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com'

    const displayName = client.company_name || 'Unknown'

    const qbCustomer: Record<string, any> = {
      DisplayName: displayName,
      CompanyName: client.company_name || undefined,
      PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
      PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
      BillAddr: client.street_address ? {
        Line1: client.street_address,
        City: client.city || undefined,
        CountrySubDivisionCode: client.state || undefined,
        PostalCode: undefined,
        Country: client.country || 'US',
      } : undefined,
      WebAddr: client.website ? { URI: `https://${client.website}` } : undefined,
    }

    // Remove undefined values
    Object.keys(qbCustomer).forEach(k => qbCustomer[k] === undefined && delete qbCustomer[k])

    const res = await fetch(`${base}/v3/company/${realmId}/customer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(qbCustomer),
    })

    if (!res.ok) {
      const err = await res.json()
      const msg = err?.Fault?.Error?.[0]?.Message || `QB error ${res.status}`
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const created = await res.json()
    const qbId = created.Customer?.Id
    const qbName = created.Customer?.DisplayName || displayName

    // Store the QB customer id directly on the client for reliable matching
    // (tolerant — ignore if the column doesn't exist yet).
    await supabase
      .from('clients')
      .update({ qb_customer_id: qbId })
      .eq('id', clientId)
      .eq('organization_id', userData.organization_id)

    // Save integration mapping
    await supabase.from('client_integrations').upsert({
      organization_id: userData.organization_id,
      client_id: clientId,
      platform: 'quickbooks',
      external_id: qbId,
      config: { name: qbName },
    }, { onConflict: 'client_id,platform' })

    return NextResponse.json({ qb_customer_id: qbId, display_name: qbName })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'QB not connected' }, { status: 400 })
  }
}
