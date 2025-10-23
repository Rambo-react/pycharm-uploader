import { google } from 'googleapis'
import axios from 'axios'

async function main() {
  const apiUrl = 'https://data.services.jetbrains.com/products/releases?code=PCP&latest=true&type=release'
  const platforms = {
    windows: { key: 'windows', ext: '.exe', mime: 'application/vnd.microsoft.portable-executable' },
    mac: { key: 'mac', ext: '.dmg', mime: 'application/x-apple-diskimage' },
    linux: { key: 'linux', ext: '.tar.gz', mime: 'application/gzip' }
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  )

  oauth2Client.setCredentials({
    access_token: process.env.GDRIVE_ACCESS_TOKEN,
    refresh_token: process.env.GDRIVE_REFRESH_TOKEN,
  })

  const drive = google.drive({ version: 'v3', auth: oauth2Client })
  const folderId = process.env.GDRIVE_FOLDER_ID

  const versionInfo = await axios.get(apiUrl)
  const latest = versionInfo.data['PCP'][0]
  const version = latest.version

  const uploadedFiles = []

  for (const [platform, { key, ext, mime }] of Object.entries(platforms)) {
    const info = latest.downloads[key]
    if (!info || !info.link) continue

    const url = info.link
    const filename = `pycharm-professional-${version}-${platform}${ext}`
    const response = await axios({ method: 'GET', url, responseType: 'stream' })

    const file = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: mime,
        body: response.data,
      },
    })

    uploadedFiles.push(file.data.id)
    console.log(`✅ Загружено: ${filename}`)
  }

  // 🔄 Удаление старых версий
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and name contains 'pycharm-professional-' and trashed = false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime asc',
    pageSize: 100,
  })

  const allFiles = data.files || []
  const excess = allFiles.length - 6

  if (excess > 0) {
    const toDelete = allFiles.slice(0, excess)
    for (const file of toDelete) {
      await drive.files.delete({ fileId: file.id })
      console.log(`🗑️ Удалено: ${file.name}`)
    }
  }
}

main().catch(err => {
  console.error(`❌ Ошибка: ${err.message}`)
  process.exit(1)
})
