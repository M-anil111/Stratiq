// ============================================================
// lib/permissions.ts
// HubSpot-style granular per-user permissions — the ENFORCED CORE.
//
// A permission is a (resource, action) pair, e.g. ("clients","delete").
// Each user's effective permissions = role defaults, with any per-user
// stored overrides merged on top (stored wins where present). `null`
// stored permissions means "use role defaults".
//
// NOTE: this is the enforced core. Broader per-tool enforcement across
// every route, plus compare-access and reusable permission-sets, are
// future work.
// ============================================================

export type Action = 'view' | 'create' | 'edit' | 'delete'

export interface Resource {
  key: string
  label: string
  actions: Action[]
}

const ALL: Action[] = ['view', 'create', 'edit', 'delete']

// The full catalogue of resources users can be granted access to.
export const RESOURCES: Resource[] = [
  { key: 'clients', label: 'Clients', actions: ALL },
  { key: 'projects', label: 'Projects', actions: ALL },
  { key: 'invoices', label: 'Invoices', actions: ALL },
  { key: 'reports', label: 'Reports', actions: ALL },
  { key: 'leads', label: 'Leads', actions: ALL },
  { key: 'team', label: 'Team', actions: ALL },
  { key: 'settings', label: 'Settings', actions: ALL },
  { key: 'billing', label: 'Billing', actions: ALL },
]

// A permission map: resource key -> action -> allowed.
export type PermissionMap = Record<string, Partial<Record<Action, boolean>>>

const ADMIN_LIKE = ['admin', 'super_admin']

function full(): PermissionMap {
  const m: PermissionMap = {}
  for (const r of RESOURCES) {
    m[r.key] = {}
    for (const a of r.actions) m[r.key][a] = true
  }
  return m
}

function grant(spec: Record<string, Action[]>): PermissionMap {
  const m: PermissionMap = {}
  for (const r of RESOURCES) {
    m[r.key] = {}
    for (const a of r.actions) m[r.key][a] = false
  }
  for (const [key, actions] of Object.entries(spec)) {
    if (!m[key]) m[key] = {}
    for (const a of actions) m[key][a] = true
  }
  return m
}

// Baseline permissions granted to every role. Per-user overrides are
// merged over these (see effectivePermissions).
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, PermissionMap> = {
  super_admin: full(),
  admin: full(),
  // Managers: broad view/create/edit, delete only on their operational
  // resources (clients/projects/leads); no billing writes.
  manager: grant({
    clients: ['view', 'create', 'edit', 'delete'],
    projects: ['view', 'create', 'edit', 'delete'],
    invoices: ['view', 'create', 'edit'],
    reports: ['view', 'create', 'edit'],
    leads: ['view', 'create', 'edit', 'delete'],
    team: ['view'],
    settings: ['view'],
    billing: ['view'],
  }),
  // Team members: hands-on work, no team/settings/billing access.
  team_member: grant({
    clients: ['view', 'create', 'edit'],
    projects: ['view', 'create', 'edit'],
    reports: ['view', 'create', 'edit'],
    leads: ['view'],
    invoices: ['view'],
  }),
  // Billing admins: own invoices + billing fully, read elsewhere.
  billing_admin: grant({
    clients: ['view'],
    projects: ['view'],
    invoices: ['view', 'create', 'edit', 'delete'],
    reports: ['view'],
    leads: ['view'],
    billing: ['view', 'create', 'edit', 'delete'],
  }),
  // Portal clients: none of the staff resources.
  client: grant({}),
}

// Deep-clone a permission map so callers can't mutate the shared defaults.
function clone(m: PermissionMap): PermissionMap {
  const out: PermissionMap = {}
  for (const [k, v] of Object.entries(m)) out[k] = { ...v }
  return out
}

/**
 * Merge stored per-user overrides over the role defaults.
 * Stored values win wherever present. `storedJson` may be null/undefined
 * (use pure role defaults) or a partial map.
 */
export function effectivePermissions(
  role: string,
  storedJson?: PermissionMap | null
): PermissionMap {
  const base = DEFAULT_PERMISSIONS_BY_ROLE[role] || grant({})
  const merged = clone(base)
  if (storedJson && typeof storedJson === 'object') {
    for (const [resKey, actions] of Object.entries(storedJson)) {
      if (!actions || typeof actions !== 'object') continue
      merged[resKey] = { ...(merged[resKey] || {}) }
      for (const [action, allowed] of Object.entries(actions)) {
        merged[resKey][action as Action] = !!allowed
      }
    }
  }
  return merged
}

export interface PermissionUser {
  role?: string | null
  permissions?: PermissionMap | null
}

/**
 * The single enforcement primitive. Returns whether `userRow` may perform
 * `action` on `resource`. super_admin is always allowed.
 *
 * Fail-safe: on any unexpected error, fall back to a plain role check so a
 * bug in permission data can never wrongly lock out an admin/super_admin.
 */
export function can(
  userRow: PermissionUser | null | undefined,
  resource: string,
  action: Action
): boolean {
  try {
    const role = userRow?.role || ''
    if (role === 'super_admin') return true
    const eff = effectivePermissions(role, userRow?.permissions ?? null)
    return !!eff[resource]?.[action]
  } catch {
    // Fail-safe: never lock out admins because of malformed data.
    return ADMIN_LIKE.includes(userRow?.role || '')
  }
}
