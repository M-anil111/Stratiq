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
  folderName: string
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

export async function listFilesInFolder(folderName: string): Promise<Array<{ id: string; name: string; webViewLink: string; createdTime: string }>> {
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
