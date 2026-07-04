import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/index'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const body = await request.json()
  const { month } = body // YYYY-MM

  if (!month) return NextResponse.json({ error: 'month required' }, { status: 400 })
  const [yearStr, monthStr] = month.split('-')
  const year = parseInt(yearStr)
  const monthNum = parseInt(monthStr)

  const { data: client } = await supabase
    .from('clients')
    .select('id, company_name, email')
    .eq('id', params.id)
    .eq('organization_id', userData.organization_id)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  if (!client.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 400 })

  const { data: report } = await supabase
    .from('marketing_reports')
    .select('*')
    .eq('client_id', params.id)
    .eq('organization_id', userData.organization_id)
    .eq('year', year)
    .eq('month', monthNum)
    .single()

  if (!report) return NextResponse.json({ error: 'No report found for this period. Save the report first.' }, { status: 404 })

  const { data: orgRow } = await supabase
    .from('organization_settings')
    .select('value')
    .eq('organization_id', userData.organization_id)
    .eq('key', 'company_name')
    .single()
  const agencyName = orgRow?.value || 'Your Agency'

  const monthLabel = new Date(year, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const g = report.google_ads_data || {}
  const m = report.meta_ads_data || {}

  const fmt = (v: any, prefix = '') => v != null ? `${prefix}${Number(v).toLocaleString()}` : '—'

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:680px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:28px 32px">
        <h1 style="margin:0 0 6px;font-size:24px;color:#fff">${client.company_name} — Monthly Report</h1>
        <p style="margin:0;color:rgba(255,255,255,0.8);font-size:15px">${monthLabel} · Prepared by ${agencyName}</p>
      </div>
      <div style="padding:32px">
        ${g.impressions != null ? `
        <h2 style="color:#38bdf8;font-size:13px;letter-spacing:.05em;text-transform:uppercase;margin:0 0 16px">Google Ads</h2>
        <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden;margin-bottom:28px">
          <tbody>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Impressions</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.impressions)}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Clicks</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.clicks)}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Spend</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.spend, '$')}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">ROAS</td><td style="padding:12px 16px;color:#38bdf8;font-weight:700;text-align:right">${g.roas != null ? Number(g.roas).toFixed(2) + 'x' : '—'}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">CTR</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${g.ctr != null ? Number(g.ctr).toFixed(2) + '%' : '—'}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Conversions</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(g.conversions)}</td></tr>
          </tbody>
        </table>` : ''}
        ${m.impressions != null ? `
        <h2 style="color:#a78bfa;font-size:13px;letter-spacing:.05em;text-transform:uppercase;margin:0 0 16px">Meta Ads</h2>
        <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden;margin-bottom:28px">
          <tbody>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Reach</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.reach)}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Impressions</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.impressions)}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">Clicks</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.clicks)}</td></tr>
            <tr style="background:#0a1628"><td style="padding:12px 16px;color:#64748b;font-size:13px">Spend</td><td style="padding:12px 16px;color:#f1f5f9;font-weight:600;text-align:right">${fmt(m.spend, '$')}</td></tr>
            <tr><td style="padding:12px 16px;color:#64748b;font-size:13px">ROAS</td><td style="padding:12px 16px;color:#a78bfa;font-weight:700;text-align:right">${m.roas != null ? Number(m.roas).toFixed(2) + 'x' : '—'}</td></tr>
          </tbody>
        </table>` : ''}
        ${report.notes ? `<p style="color:#94a3b8;font-size:14px;border-left:3px solid #334155;padding-left:12px;margin:0 0 28px">${report.notes}</p>` : ''}
        <p style="color:#64748b;font-size:13px;margin:28px 0 0">This report was generated by ${agencyName}. For questions, reply to this email.</p>
      </div>
    </div>
  `

  try {
    await sendEmail({
      to: client.email,
      subject: `${client.company_name} — ${monthLabel} Marketing Report`,
      html,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Email failed' }, { status: 500 })
  }

  await supabase.from('marketing_reports')
    .update({ is_sent_to_client: true, sent_at: new Date().toISOString() })
    .eq('client_id', params.id)
    .eq('year', year)
    .eq('month', monthNum)

  return NextResponse.json({ success: true })
}
