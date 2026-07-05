export const APP_VERSION = '1.4.0'

export type ChangelogTag = 'feature' | 'fix' | 'security'

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  tag: ChangelogTag
  changes: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '2026-06-28',
    title: 'HubSpot-style CRM & analytics',
    tag: 'feature',
    changes: [
      'Redesigned user management with role-based dashboards and per-user activity',
      'Client merge tool to combine duplicate records without losing history',
      'Ads analysis workspace unifying Google Ads and Meta Ads performance',
      'Custom report builder with drag-and-drop widgets and saved templates',
      'Shareable report links with white-labeled client portal branding',
      'In-app changelog, version info, and audit log covering all changes',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-05',
    title: 'Billing, tasks & pipeline',
    tag: 'feature',
    changes: [
      'Invoice actions: mark paid, void, and send, with Stripe pay links',
      'Downloadable PDF invoices with company branding',
      'My Tasks view aggregating assignments across every project',
      'Lead pipeline with drag-and-drop stages and conversion tracking',
      'Proposal approval flow with client sign-off and status tracking',
      'Realtime messaging between staff and client portal users',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-12',
    title: 'Integrations & reporting',
    tag: 'feature',
    changes: [
      'QuickBooks integration for invoice and customer sync',
      'Meta Ads and Google Ads integrations with account linking',
      'Reports module with scheduled and on-demand report generation',
      'Global search across clients, projects, invoices, and tasks',
      'Notifications center with per-recipient delivery preferences',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-04-18',
    title: 'Onboarding & reliability',
    tag: 'feature',
    changes: [
      'Guided client onboarding wizard for faster account setup',
      'Application-wide error boundaries with graceful recovery',
      'Portal white-labeling for logos, colors, and custom domains',
      'End-to-end test suite covering critical staff and portal flows',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-04-02',
    title: 'Security hardening',
    tag: 'security',
    changes: [
      'Role-based permission hardening across all API routes',
      'Patched vulnerable transitive dependencies flagged by audit',
      'Encrypted credential storage with audited reveal endpoint',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-20',
    title: 'Stratiq launch',
    tag: 'feature',
    changes: [
      'Multi-tenant workspace with organization-scoped data',
      'Client, project, and invoice management foundations',
      'Team management with invitations and role assignment',
    ],
  },
]
