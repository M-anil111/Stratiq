import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
  if (!userData?.organization_id) return NextResponse.json({ error: 'No org' }, { status: 403 })

  const orgId = userData.organization_id
  const clientId = params.id
  const items: any[] = []

  // Messages
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, content, created_at')
      .eq('client_id', clientId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error && data) {
      for (const row of data) {
        items.push({
          type: 'message',
          title: 'Message sent',
          description: row.content ? row.content.slice(0, 80) : '',
          created_at: row.created_at,
          icon: 'message',
        })
      }
    }
  } catch {}

  // Invoices
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, status, created_at, updated_at')
      .eq('client_id', clientId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error && data) {
      for (const row of data) {
        items.push({
          type: 'invoice',
          title: row.status === 'paid' ? `Invoice ${row.invoice_number} marked paid` : `Invoice ${row.invoice_number} created`,
          description: `Status: ${row.status}`,
          created_at: row.status === 'paid' ? (row.updated_at || row.created_at) : row.created_at,
          icon: 'invoice',
        })
      }
    }
  } catch {}

  // Marketing reports
  try {
    const { data, error } = await supabase
      .from('marketing_reports')
      .select('id, month, channel, created_at, updated_at')
      .eq('client_id', clientId)
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(50)
    if (!error && data) {
      // Deduplicate by month
      const seen = new Set<string>()
      for (const row of data) {
        if (!seen.has(row.month)) {
          seen.add(row.month)
          const monthLabel = row.month
            ? (() => {
                const [y, m] = row.month.split('-')
                return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              })()
            : row.month
          items.push({
            type: 'report',
            title: `Report for ${monthLabel} updated`,
            description: '',
            created_at: row.updated_at || row.created_at,
            icon: 'report',
          })
        }
      }
    }
  } catch {}

  // Projects
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, domain, status, created_at')
      .eq('client_id', clientId)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error && data) {
      for (const row of data) {
        items.push({
          type: 'project',
          title: `Project '${row.domain}' created`,
          description: `Status: ${row.status?.replace(/_/g, ' ') || 'unknown'}`,
          created_at: row.created_at,
          icon: 'project',
        })
      }
    }
  } catch {}

  // Sort by created_at desc and limit
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(items.slice(0, 50))
}
