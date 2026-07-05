import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientFolder } from '@/lib/google-drive'
import { sendEmail } from '@/lib/email/index'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '25')
  const offset = (page - 1) * limit

  let query = supabase
    .from('clients')
    .select('*, sales_manager:users!sales_manager_id(full_name, email), dm_manager:users!dm_manager_id(full_name, email), marketing_manager:users!marketing_manager_id(full_name, email), projects(id, status)', { count: 'exact' })
    .eq('organization_id', userData.organization_id)
    .order('company_name')
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`company_name.ilike.%${search}%,website.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`)
  }
  if (status) {
    query = query.eq('project_status', status)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clients = (data || []).map((client: any) => ({
    ...client,
    active_project_count: (client.projects || []).filter((p: any) => p.status === 'active').length,
  }))

  return NextResponse.json({ clients, total: count, page, limit })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id, role').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 403 })
  if (!['super_admin', 'admin', 'manager', 'team_member'].includes(userData.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await request.json()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      organization_id: userData.organization_id,
      sales_manager_id: body.sales_manager_id || null,
      dm_manager_id: body.dm_manager_id || null,
      marketing_manager_id: body.marketing_manager_id || null,
      company_name: body.company_name,
      website: body.website,
      about_company: body.about_company,
      industry: body.industry,
      email: body.email,
      phone: body.phone,
      street_address: body.street_address,
      city: body.city,
      state: body.state,
      country: body.country || 'US',
      hashtags: body.hashtags || [],
      categories: body.categories || [],
      num_employees: body.num_employees ? parseInt(body.num_employees) : null,
      project_status: body.project_status || 'active',
      services: body.services || [],
      service_packages: body.service_packages || [],
      advertising_types: body.advertising_types || [],
      goals: body.goals || [],
      stakeholder_expectations: body.stakeholder_expectations || [],
      target_audience: body.target_audience,
      website_last_updated: body.website_last_updated || null,
      ndisk_link: body.ndisk_link,
      google_drive_folder_url: body.google_drive_folder_url,
      proposal_url: body.proposal_url || null,
      google_place_id: body.google_place_id || null,
      proposal_status: 'approved',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create Google Drive folder for new client (non-fatal)
  try {
    const folderId = await createClientFolder(supabase, body.company_name)
    await supabase.from('clients').update({ google_drive_folder_id: folderId }).eq('id', data.id)
    data.google_drive_folder_id = folderId
  } catch { /* Drive not connected or env var missing — skip */ }

  // Send notification email to all configured recipients (non-fatal)
  try {
    const pkgs: any[] = body.service_packages || []
    const totalMonthly = pkgs.reduce((s: number, p: any) => s + (parseFloat(p.price) || 0), 0)
    const totalSetup = pkgs.reduce((s: number, p: any) => s + (parseFloat(p.setup_fee) || 0), 0)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    // Pull notification recipients from org settings; fall back to env var
    const { data: notifRow } = await supabase
      .from('organization_settings')
      .select('value')
      .eq('organization_id', userData.organization_id)
      .eq('key', 'notification_emails')
      .single()
    const recipientList = notifRow?.value
      ? notifRow.value.split(',').map((e: string) => e.trim()).filter(Boolean)
      : (process.env.APPROVAL_EMAIL || 'jay@jaymehta.co').split(',').map((e: string) => e.trim())

    const servicesHtml = pkgs.map((p: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:14px">${p.service}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px">${p.billing_term} · ${p.contract_term}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#38bdf8;font-size:14px;font-weight:600;text-align:right">$${(parseFloat(p.price) || 0).toLocaleString()}/mo</td>
      </tr>
      ${(parseFloat(p.setup_fee) || 0) > 0 ? `<tr><td colspan="2" style="padding:4px 12px;color:#64748b;font-size:12px">  └ Setup fee</td><td style="padding:4px 12px;color:#94a3b8;font-size:12px;text-align:right">$${(parseFloat(p.setup_fee) || 0).toLocaleString()}</td></tr>` : ''}
    `).join('')

    for (const recipient of recipientList) {
    await sendEmail({
      to: recipient,
      subject: `New Client Added: ${body.company_name} — $${totalMonthly.toLocaleString()}/mo`,
      html: `
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#0a1628;color:#e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:24px 32px">
            <h1 style="margin:0;font-size:22px;color:#fff">New Client Added</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px">A new client has been onboarded in Stratiq</p>
          </div>
          <div style="padding:32px">
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:140px">Company</td><td style="color:#f1f5f9;font-weight:600">${body.company_name}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Website</td><td style="color:#f1f5f9">${body.website}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Industry</td><td style="color:#f1f5f9">${body.industry || '—'}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Contact</td><td style="color:#f1f5f9">${body.email} · ${body.phone}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Location</td><td style="color:#f1f5f9">${[body.city, body.state, body.country].filter(Boolean).join(', ') || '—'}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Status</td><td style="color:#f1f5f9">${body.project_status}</td></tr>
              ${body.proposal_url ? `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">Proposal</td><td><a href="${body.proposal_url}" style="color:#38bdf8">View Proposal</a></td></tr>` : ''}
            </table>

            <h3 style="color:#38bdf8;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 12px">Services & Pricing</h3>
            <table style="width:100%;border-collapse:collapse;background:#0f1e35;border-radius:8px;overflow:hidden;margin-bottom:24px">
              <thead>
                <tr style="background:#162030">
                  <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:500">Service</th>
                  <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:500">Terms</th>
                  <th style="padding:10px 12px;text-align:right;color:#64748b;font-size:12px;font-weight:500">Price</th>
                </tr>
              </thead>
              <tbody>${servicesHtml}</tbody>
              <tfoot>
                <tr style="background:#162030">
                  <td colspan="2" style="padding:12px;color:#f1f5f9;font-weight:700;font-size:14px">Monthly Total</td>
                  <td style="padding:12px;color:#38bdf8;font-weight:700;font-size:18px;text-align:right">$${totalMonthly.toLocaleString()}/mo</td>
                </tr>
                ${totalSetup > 0 ? `<tr><td colspan="2" style="padding:4px 12px 12px;color:#64748b;font-size:12px">One-time Setup</td><td style="padding:4px 12px 12px;color:#94a3b8;font-size:13px;text-align:right">$${totalSetup.toLocaleString()}</td></tr>` : ''}
              </tfoot>
            </table>

            <div style="display:flex;gap:12px;margin-bottom:32px">
              <a href="${appUrl}/clients/${data.id}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Client in Stratiq →</a>
            </div>

            ${body.goals?.length ? `<p style="color:#64748b;font-size:13px"><strong style="color:#94a3b8">Goals:</strong> ${body.goals.join(', ')}</p>` : ''}
            ${body.stakeholder_expectations?.length ? `<p style="color:#64748b;font-size:13px"><strong style="color:#94a3b8">Expectations:</strong> ${body.stakeholder_expectations.join(', ')}</p>` : ''}
            ${body.target_audience ? `<p style="color:#64748b;font-size:13px"><strong style="color:#94a3b8">Target Audience:</strong> ${body.target_audience}</p>` : ''}
          </div>
        </div>
      `,
    })
    } // end for recipient loop
  } catch { /* Email may fail if Resend not configured — don't block */ }

  return NextResponse.json(data, { status: 201 })
}
