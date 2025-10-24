import { google } from 'googleapis'
import axios from 'axios'

async function main() {
  const apiUrl =
    'https://data.services.jetbrains.com/products/releases?code=PCP&latest=true&type=release'
  const platforms = {
    windows: {
      key: 'windows',
      ext: '.exe',
      mime: 'application/vnd.microsoft.portable-executable',
    },
    mac: { key: 'mac', ext: '.dmg', mime: 'application/x-apple-diskimage' },
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  )

  oauth2Client.setCredentials({
    // access_token: process.env.GDRIVE_ACCESS_TOKEN,
    refresh_token: process.env.GDRIVE_REFRESH_TOKEN,
    // scope: 'https://www.googleapis.com/auth/drive.file',
    // token_type: 'Bearer',
    // expiry_date: Date.now() + 3600 * 1000
  })

  const drive = google.drive({ version: 'v3', auth: oauth2Client })

  const versionInfo = await axios.get(apiUrl)
  const latest = versionInfo.data['PCP'][0]
  const version = latest.version

  for (const [platform, { key, ext, mime }] of Object.entries(platforms)) {
    const info = latest.downloads[key]
    if (!info || !info.link) continue

    const url = info.link
    
    const now = new Date()
    const date = now.toISOString().split('T')[0] // YYYY-MM-DD
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-') // HH-MM-SS
    const filename = `pycharm-professional-${version}-${platform}-${date}_${time}${ext}`
    
    const response = await axios({ method: 'GET', url, responseType: 'stream' })

    try {
      const uploaded = await drive.files.create({
        requestBody: { name: filename },
        media: { mimeType: mime, body: response.data },
      })

      console.log(`✅ Загружено: ${filename}`)

      // Удаление старых версий для этой платформы
      const { data } = await drive.files.list({
        q: `name contains 'pycharm-professional-' and name contains '${platform}' and name != '${filename}' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 10,
      })

      const oldFiles = data.files || []
      for (const file of oldFiles) {
        await drive.files.delete({ fileId: file.id })
        console.log(`🗑️ Удалено: ${file.name}`)
      }
    } catch (err) {
      console.error(`❌ Ошибка загрузки ${filename}: ${err.message}`)
    }
  }
}

main().catch((err) => {
  console.error(`❌ Ошибка: ${err.message}`)
  process.exit(1)
})
