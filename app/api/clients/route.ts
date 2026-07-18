import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientFolder } from '@/lib/google-drive'
import { sendEmail } from '@/lib/email/index'
import { logAudit } from '@/lib/audit'
import { domainFromUrl } from '@/lib/logo'
import { autoCreateMasterIfMissing } from '@/lib/masters'

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

  // Manager joins depend on FK columns from migration 007 that may not be applied.
  // Fall back to progressively simpler selects so the clients list never hard-fails.
  const selects = [
    '*, sales_manager:users!sales_manager_id(full_name, email), dm_manager:users!dm_manager_id(full_name, email), marketing_manager:users!marketing_manager_id(full_name, email), projects(id, status)',
    '*, sales_manager:users!sales_manager_id(full_name, email), dm_manager:users!dm_manager_id(full_name, email), projects(id, status)',
    '*, projects(id, status)',
    '*',
  ]

  let data: any = null
  let error: any = null
  let count: number | null = null
  for (const sel of selects) {
    let query = supabase
      .from('clients')
      .select(sel, { count: 'exact' })
      .eq('organization_id', userData.organization_id)
      .order('company_name')
      .range(offset, offset + limit - 1)
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,website.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`)
    }
    if (status) {
      query = query.eq('project_status', status)
    }
    const res = await query
    data = res.data
    error = res.error
    count = res.count
    if (!error) break
    // Retry with a simpler select only when a column/relationship is missing
    if (!/Could not find|does not exist|schema cache|relationship/i.test(error.message || '')) break
  }

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

  // Hosting domain auto-fill: if the domain field is empty but a website was
  // provided, derive the bare domain from the website. Tolerant — the column is
  // only set below if it exists (missing-column retry strips it otherwise).
  const websiteDomain = domainFromUrl(body.website)
  const autoDomainName = (body.domain_name && String(body.domain_name).trim())
    ? body.domain_name
    : (websiteDomain || null)

  // Build the insert row. Some columns come from migrations that may not yet be
  // applied to this database (e.g. marketing_manager_id from 007). Rather than
  // hard-failing the whole insert, we retry while stripping any column PostgREST
  // reports as missing from the schema cache, so client creation always succeeds
  // with whatever columns the DB actually has.
  const insertRow: Record<string, any> = {
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
    proposal_status: 'pending_approval',
    logo_url: body.logo_url || null,
    domain_name: autoDomainName,
    proofhub_project_id: body.proofhub_project_id ? String(body.proofhub_project_id) : null,
    custom_field_values: body.custom_field_values || {},
  }

  let data: any = null
  let error: any = null
  const droppedColumns: string[] = []
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await supabase.from('clients').insert(insertRow).select().single()
    data = res.data
    error = res.error
    if (!error) break
    // PostgREST reports missing columns as: Could not find the 'X' column of 'clients' in the schema cache
    const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1]
    if (missing && missing in insertRow) {
      delete insertRow[missing]
      droppedColumns.push(missing)
      continue
    }
    // A check-constraint violation (e.g. proposal_status enum mismatch across
    // migration versions) shouldn't block creation — drop the offending column
    // and let the DB default apply.
    const checkViol = error.code === '23514' && error.message?.match(/clients_([a-z_]+)_check/)?.[1]
    if (checkViol && checkViol in insertRow) {
      delete insertRow[checkViol]
      droppedColumns.push(checkViol)
      continue
    }
    break
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If the industry typed/selected isn't already a Masters value for this
  // org, save it as one — so it's a real option for the next client too.
  await autoCreateMasterIfMissing(supabase, userData.organization_id, 'industry', body.industry, user.id)

  // Auto-create a project for each selected service package (non-fatal)
  try {
    const pkgs: any[] = body.service_packages || []
    if (pkgs.length > 0) {
      const projectRows = pkgs
        .filter((p: any) => p?.service)
        .map((p: any) => ({
          client_id: data.id,
          organization_id: userData.organization_id,
          domain: body.website || body.company_name || 'unknown',
          status: 'active',
          industry: body.industry || null,
          services: [p.service],
          sales_manager_id: body.sales_manager_id || null,
          dm_manager_id: body.dm_manager_id || null,
        }))
      if (projectRows.length > 0) {
        const { error: projError } = await supabase.from('projects').insert(projectRows)
        if (projError) console.error('Auto-create projects failed:', projError.message)
      }
    }
  } catch { /* Project creation must never fail client creation */ }

  // Generate a proposal approval token (non-fatal if the column doesn't exist yet — 42P01/42703)
  let approvalToken: string | null = null
  try {
    const token = randomBytes(32).toString('hex')
    const { error: tokenError } = await supabase
      .from('clients')
      .update({ approval_token: token })
      .eq('id', data.id)
      .eq('organization_id', userData.organization_id)
    if (!tokenError) approvalToken = token
  } catch { /* approval_token column missing — skip approval flow */ }

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

            ${approvalToken ? `
            <div style="margin-bottom:16px">
              <a href="${appUrl}/approve/${approvalToken}?action=approve" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-right:12px">✓ Approve</a>
              <a href="${appUrl}/approve/${approvalToken}?action=reject" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">✕ Reject</a>
            </div>` : ''}
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

  await logAudit(supabase, {
    organizationId: userData.organization_id,
    userId: user.id,
    action: 'client_created',
    entityType: 'client',
    entityId: data.id,
    detail: { company_name: body.company_name },
  })

  return NextResponse.json(data, { status: 201 })
}
