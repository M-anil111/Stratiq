import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const orgId = searchParams.get('state')

  // Must match the redirect_uri used at authorize time (connect route).
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '')

  if (!code || !realmId || !orgId) {
    return NextResponse.redirect(`${base}/settings/integrations?error=qb_auth_failed`)
  }

  const credentials = Buffer.from(
    `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${base}/api/auth/quickbooks/callback`,
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokens.access_token) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=qb_token_failed`)
  }

  const supabase = await createClient()
  await supabase.from('organization_settings').upsert([
    { organization_id: orgId, key: 'qb_access_token', value: tokens.access_token },
    { organization_id: orgId, key: 'qb_refresh_token', value: tokens.refresh_token },
    { organization_id: orgId, key: 'qb_realm_id', value: realmId },
    { organization_id: orgId, key: 'qb_token_expiry', value: String(Date.now() + tokens.expires_in * 1000) },
    { organization_id: orgId, key: 'qb_connected', value: 'true' },
  ])

  await logAudit(supabase, {
    organizationId: orgId,
    action: 'integration_connected',
    entityType: 'integration',
    entityId: 'quickbooks',
    detail: { provider: 'quickbooks' },
  })

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?connected=quickbooks`)
}
