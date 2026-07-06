import { NextResponse } from 'next/server'
import { Client } from 'pg'
import { createClient } from '@/lib/supabase/server'
import { requireRole, ADMIN_ROLES } from '@/lib/authz'
import { PENDING_MIGRATIONS_SQL, MIGRATIONS_VERSION } from '@/lib/migrations-sql'

export const runtime = 'nodejs'

function resolveConnectionString(): string | undefined {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    undefined
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  return NextResponse.json({ configured: !!resolveConnectionString(), version: MIGRATIONS_VERSION })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authz = await requireRole(supabase, user.id, ADMIN_ROLES)
  if (!authz.ok) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const connectionString = resolveConnectionString()
  if (!connectionString) {
    return NextResponse.json(
      {
        error: 'no_connection_string',
        message:
          'Add POSTGRES_URL_NON_POOLING (or DATABASE_URL) in Vercel env — the Supabase integration usually sets it.',
      },
      { status: 400 }
    )
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    await client.query(PENDING_MIGRATIONS_SQL)
    return NextResponse.json({ ok: true, version: MIGRATIONS_VERSION })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to apply migrations'
    return NextResponse.json({ error: 'migration_failed', message }, { status: 500 })
  } finally {
    try {
      await client.end()
    } catch {
      // ignore
    }
  }
}
