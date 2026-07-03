export type UserRole = 'super_admin' | 'admin' | 'manager' | 'team_member' | 'billing_admin' | 'client'

export type ProjectStatus = 'active' | 'on_hold' | 'cancelled' | 'completed' | 'prospect' | 'in_onboarding'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url?: string
  primary_color?: string
  plan: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  organization_id: string
  email: string
  full_name?: string
  avatar_url?: string
  role: UserRole
  is_active: boolean
  last_seen_at?: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  organization_id: string
  company_name: string
  website: string
  about_company?: string
  industry?: string
  email?: string
  phone?: string
  street_address?: string
  city?: string
  state?: string
  country: string
  logo_urls: string[]
  hashtags: string[]
  categories: string[]
  num_employees?: number
  flowcode_qr_urls: string[]
  google_maps_place_id?: string
  project_status: ProjectStatus
  services: string[]
  advertising_types: string[]
  goals: string[]
  stakeholder_expectations: string[]
  target_audience?: string
  website_last_updated?: string
  ndisk_link?: string
  google_drive_folder_url?: string
  google_drive_folder_id?: string
  sales_manager_id?: string
  dm_manager_id?: string
  created_at: string
  updated_at: string
  // Relations
  sales_manager?: User
  dm_manager?: User
}

export interface Project {
  id: string
  client_id: string
  organization_id: string
  domain: string
  status: ProjectStatus
  industry?: string
  services: string[]
  advertising_types: string[]
  goals: string[]
  sales_manager_id?: string
  dm_manager_id?: string
  google_drive_folder_id?: string
  created_at: string
  updated_at: string
  client?: Client
}

export interface SocialMediaPosting {
  id: string
  project_id: string
  organization_id: string
  platform: string
  type: 'image' | 'video' | 'carousel' | 'gif'
  status: 'live' | 'under_review' | 'deleted'
  live_link?: string
  submission_date: string
  username?: string
  password_encrypted?: string
  comment?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface OffpageSubmission {
  id: string
  project_id: string
  organization_id: string
  submission_date: string
  website_url: string
  type: string
  status: 'live' | 'under_review' | 'deleted'
  live_url?: string
  email?: string
  username?: string
  password_encrypted?: string
  comment?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface BlogSubmission {
  id: string
  project_id: string
  organization_id: string
  submission_date: string
  live_url: string
  meta_title: string
  meta_description: string
  h1: string
  username?: string
  password_encrypted?: string
  comment?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface OnpageDetail {
  id: string
  project_id: string
  organization_id: string
  url: string
  h1: string
  meta_title: string
  meta_description: string
  primary_keywords: string[]
  secondary_keywords: string[]
  rankings?: string
  submission_date: string
  comment?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface GroupPosting {
  id: string
  project_id: string
  organization_id: string
  platform: string
  group_name: string
  group_url?: string
  post_type: string
  post_content: string
  live_link?: string
  status: 'live' | 'under_review' | 'deleted' | 'pending_approval'
  submission_date: string
  username?: string
  password_encrypted?: string
  member_count?: number
  comment?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ActivityTarget {
  id: string
  project_id: string
  organization_id: string
  year: number
  month: number
  social_media_target: number
  offpage_target: number
  blog_target: number
  onpage_target: number
  group_posting_target: number
  created_at: string
  updated_at: string
}

export interface TargetExplanation {
  id: string
  project_id: string
  user_id: string
  organization_id: string
  year: number
  month: number
  week: number
  activity_type: string
  target_count: number
  completed_count: number
  reason: string
  notes?: string
  status: 'pending' | 'acknowledged' | 'flagged'
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

export interface Message {
  id: string
  client_id: string
  organization_id: string
  sender_id?: string
  content: string
  attachments: string[]
  is_read_by_client: boolean
  is_read_by_staff: boolean
  created_at: string
  sender?: User
}

export interface UpsellCard {
  type: string
  headline: string
  description: string
  cta: string
}
