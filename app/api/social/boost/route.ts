import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { boostPost } from '@/lib/social/boost'
import { getSocialToken } from '@/lib/social/token'

const MANAGER_ROLES = ['super_admin', 'admin', 'manager']

// Boost/promote an existing Facebook/Instagram post as a paid ad.
// body: { page_post_id, ad_account_id?, objective?, daily_budget_cents?, duration_days?, targeting? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!MANAGER_ROLES.includes(userData.role || '')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const pagePostId = String(body.page_post_id || '').trim()
  if (!pagePostId) return NextResponse.json({ error: 'page_post_id is required' }, { status: 400 })

  const adAccountId = String(body.ad_account_id || process.env.META_AD_ACCOUNT_ID || '').trim()
  if (!adAccountId) {
    return NextResponse.json({ error: 'No Meta ad account configured. Set META_AD_ACCOUNT_ID or pass ad_account_id.' }, { status: 400 })
  }

  // Resolve an ads-capable token from a connected Facebook account.
  const { data: acct } = await supabase
    .from('social_accounts')
    .select('id, organization_id, platform, account_name, access_token, refresh_token, token_expires_at, status, needs_reconnect, external_id')
    .eq('organization_id', userData.organization_id)
    .eq('platform', 'facebook')
    .neq('status', 'manual')
    .limit(1)
    .maybeSingle()

  if (!acct) return NextResponse.json({ error: 'Connect a Facebook account with ads permissions to boost posts.' }, { status: 400 })
  const tok = await getSocialToken(supabase, acct as any)
  if (!tok.ok) return NextResponse.json({ error: tok.reason }, { status: 400 })

  const result = await boostPost({
    adAccountId,
    pagePostId,
    accessToken: tok.token,
    objective: body.objective,
    dailyBudgetCents: body.daily_budget_cents,
    durationDays: body.duration_days,
    targeting: body.targeting,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'social_post_boosted',
    entityType: 'social_post',
    entityId: pagePostId,
    detail: { campaignId: result.campaignId, adId: result.adId },
  })

  return NextResponse.json({
    ...result,
    note: 'Campaign, ad set and ad were created PAUSED. Review targeting/budget in Meta Ads Manager, then set them ACTIVE to start spending.',
  })
}
