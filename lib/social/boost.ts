// Boost / promote an existing published post as a paid ad via Meta's Marketing
// API (Facebook Page posts and Instagram posts). Builds the standard object
// chain Campaign (objective) → Ad Set (budget, schedule, targeting) → Ad
// (creative = the existing post, referenced by object_story_id) so the organic
// engagement/social-proof carries over.
//
// Requires a Meta ad account id + a token with ads_management scope. All values
// come from env / the connected account — nothing is hardcoded. Returns a typed
// result; callers surface a clear reason when credentials/permissions are absent.

export type BoostParams = {
  adAccountId: string        // act_XXXXXXXX
  pagePostId: string         // {page_id}_{post_id} for the existing organic post
  accessToken: string        // ads_management token
  objective?: string         // OUTCOME_ENGAGEMENT | OUTCOME_TRAFFIC | ...
  dailyBudgetCents?: number   // Meta minimum ~ $1.00/day = 100
  durationDays?: number
  targeting?: Record<string, any>
}

export type BoostResult = {
  ok: boolean
  campaignId?: string
  adSetId?: string
  adId?: string
  error?: string
}

const GRAPH = 'https://graph.facebook.com/v19.0'

async function post(path: string, token: string, body: Record<string, any>) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

export async function boostPost(p: BoostParams): Promise<BoostResult> {
  const {
    adAccountId, pagePostId, accessToken,
    objective = 'OUTCOME_ENGAGEMENT',
    dailyBudgetCents = 500,
    durationDays = 7,
    targeting = { geo_locations: { countries: ['US'] } },
  } = p

  if (!adAccountId || !pagePostId || !accessToken) {
    return { ok: false, error: 'Boost requires a Meta ad account, the post id, and an ads_management token.' }
  }
  if (dailyBudgetCents < 100) {
    return { ok: false, error: 'Meta minimum budget is $1.00/day.' }
  }

  const acct = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`

  // 1) Campaign (paused so nothing spends until the ad is reviewed/enabled).
  const camp = await post(`${acct}/campaigns`, accessToken, {
    name: `Boost ${pagePostId} ${new Date().toISOString().slice(0, 10)}`,
    objective,
    status: 'PAUSED',
    special_ad_categories: [],
  })
  if (!camp.ok || !camp.data?.id) return { ok: false, error: camp.data?.error?.message || 'Campaign creation failed' }

  const start = Math.floor(Date.now() / 1000) + 300
  const end = start + durationDays * 24 * 60 * 60

  // 2) Ad Set (budget + schedule + targeting).
  const adset = await post(`${acct}/adsets`, accessToken, {
    name: `Boost adset ${pagePostId}`,
    campaign_id: camp.data.id,
    daily_budget: dailyBudgetCents,
    billing_event: 'IMPRESSIONS',
    optimization_goal: objective === 'OUTCOME_TRAFFIC' ? 'LINK_CLICKS' : 'POST_ENGAGEMENT',
    start_time: start,
    end_time: end,
    targeting,
    status: 'PAUSED',
  })
  if (!adset.ok || !adset.data?.id) return { ok: false, error: adset.data?.error?.message || 'Ad set creation failed', campaignId: camp.data.id }

  // 3) Ad Creative referencing the existing post, then the Ad.
  const creative = await post(`${acct}/adcreatives`, accessToken, {
    name: `Boost creative ${pagePostId}`,
    object_story_id: pagePostId,
  })
  if (!creative.ok || !creative.data?.id) return { ok: false, error: creative.data?.error?.message || 'Creative creation failed', campaignId: camp.data.id, adSetId: adset.data.id }

  const ad = await post(`${acct}/ads`, accessToken, {
    name: `Boost ad ${pagePostId}`,
    adset_id: adset.data.id,
    creative: { creative_id: creative.data.id },
    status: 'PAUSED',
  })
  if (!ad.ok || !ad.data?.id) return { ok: false, error: ad.data?.error?.message || 'Ad creation failed', campaignId: camp.data.id, adSetId: adset.data.id }

  return { ok: true, campaignId: camp.data.id, adSetId: adset.data.id, adId: ad.data.id }
}
