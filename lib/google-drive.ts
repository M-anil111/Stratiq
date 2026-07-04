export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  webViewLink: string
  createdTime: string
  thumbnailLink?: string
}

// ---------------------------------------------------------------------------
// OAuth-based helpers (uses access_token from organization_settings)
// ---------------------------------------------------------------------------

export async function getAccessToken(supabase: any): Promise<string> {
  const { data: rows } = await supabase
    .from('organization_settings')
    .select('key, value')
    .in('key', ['google_access_token', 'google_refresh_token', 'google_token_expiry'])

  if (!rows?.length) throw new Error('Google not connected')

  const byKey: Record<string, string> = {}
  for (const r of rows) byKey[r.key] = r.value

  const expiry = byKey.google_token_expiry ? new Date(byKey.google_token_expiry) : new Date(0)
  const isExpired = expiry.getTime() - Date.now() < 60_000 // refresh if <1 min left

  if (!isExpired && byKey.google_access_token) return byKey.google_access_token

  // Refresh the token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: byKey.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(`Token refresh failed: ${data.error}`)

  const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()

  await supabase.from('organization_settings').upsert([
    { key: 'google_access_token', value: data.access_token, updated_at: new Date().toISOString() },
    { key: 'google_token_expiry', value: newExpiry, updated_at: new Date().toISOString() },
  ], { onConflict: 'organization_id,key' })

  return data.access_token
}

async function driveRequest(token: string, path: string, options: RequestInit = {}) {
  const base = 'https://www.googleapis.com/drive/v3'
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Drive API error ${res.status}: ${err}`)
  }
  return res
}

async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const escaped = name.replace(/'/g, "\\'")
  const q = `name='${escaped}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await driveRequest(token, `/files?q=${encodeURIComponent(q)}&fields=files(id)`)
  const data = await res.json()
  if (data.files?.length) return data.files[0].id

  const createRes = await driveRequest(token, '/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  const created = await createRes.json()
  return created.id
}

export async function createClientFolder(supabase: any, clientName: string): Promise<string> {
  const token = await getAccessToken(supabase)
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!
  const stratiqFolderId = await findOrCreateFolder(token, 'Stratiq', rootId)
  return findOrCreateFolder(token, clientName, stratiqFolderId)
}

export async function createOrgProposalsFolder(supabase: any): Promise<string> {
  const token = await getAccessToken(supabase)
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!
  const stratiqFolderId = await findOrCreateFolder(token, 'Stratiq', rootId)
  return findOrCreateFolder(token, 'Proposals', stratiqFolderId)
}

export async function createProjectFolder(supabase: any, clientFolderId: string, projectName: string): Promise<string> {
  const token = await getAccessToken(supabase)
  return findOrCreateFolder(token, projectName, clientFolderId)
}

export async function listFiles(supabase: any, folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken(supabase)
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const fields = 'files(id,name,mimeType,size,webViewLink,createdTime,thumbnailLink)'
  const res = await driveRequest(token, `/files?q=${q}&fields=${fields}&orderBy=createdTime+desc`)
  const data = await res.json()
  return data.files || []
}

export async function listSubfolders(supabase: any, folderId: string): Promise<DriveFile[]> {
  const token = await getAccessToken(supabase)
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const fields = 'files(id,name,mimeType,createdTime,webViewLink)'
  const res = await driveRequest(token, `/files?q=${q}&fields=${fields}&orderBy=name`)
  const data = await res.json()
  return data.files || []
}

export async function uploadFile(
  supabase: any,
  folderId: string,
  file: Buffer,
  filename: string,
  mimeType: string,
): Promise<DriveFile> {
  const token = await getAccessToken(supabase)

  const metadata = JSON.stringify({ name: filename, parents: [folderId] })
  const boundary = '-------stratiq_boundary'

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(metadata),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    file,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': String(body.length),
      },
      body,
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Drive upload error ${res.status}: ${err}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Legacy service-account helpers kept for backward compatibility
// ---------------------------------------------------------------------------
import { google } from 'googleapis'
import { Readable } from 'stream'

function getAuth() {
  const keyJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!, 'base64').toString('utf8')
  const key = JSON.parse(keyJson)
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

export async function uploadFileToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderName: string,
): Promise<{ id: string; webViewLink: string }> {
  const auth = getAuth()
  const drive = google.drive({ version: 'v3', auth })

  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!
  const escapedFolderName = folderName.replace(/'/g, "\\'")
  const folderRes = await drive.files.list({
    q: `name='${escapedFolderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  })

  let folderId: string
  if (folderRes.data.files?.length) {
    folderId = folderRes.data.files[0].id!
  } else {
    const created = await drive.files.create({
      requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    })
    folderId = created.data.id!
  }

  const stream = Readable.from(fileBuffer)
  const uploaded = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: 'id,webViewLink',
  })

  await drive.permissions.create({
    fileId: uploaded.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  return { id: uploaded.data.id!, webViewLink: uploaded.data.webViewLink! }
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const auth = getAuth()
  const drive = google.drive({ version: 'v3', auth })
  await drive.files.delete({ fileId })
}

export async function listFilesInFolder(
  folderName: string,
): Promise<Array<{ id: string; name: string; webViewLink: string; createdTime: string }>> {
  const auth = getAuth()
  const drive = google.drive({ version: 'v3', auth })
  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!
  const escapedFolderName = folderName.replace(/'/g, "\\'")

  const folderRes = await drive.files.list({
    q: `name='${escapedFolderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  })

  if (!folderRes.data.files?.length) return []
  const folderId = folderRes.data.files[0].id!

  const filesRes = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,webViewLink,createdTime)',
    orderBy: 'createdTime desc',
  })

  return (filesRes.data.files || []) as any[]
}
