const { google } = require('googleapis')
const axios = require('axios')

async function main() {
  const apiUrl = 'https://data.services.jetbrains.com/products/releases?code=PCP&latest=true&type=release'
  const platforms = {
    windows: { key: 'windows', ext: '.exe', mime: 'application/vnd.microsoft.portable-executable' },
    mac: { key: 'mac', ext: '.dmg', mime: 'application/x-apple-diskimage' },
    linux: { key: 'linux', ext: '.tar.gz', mime: 'application/gzip' }
  }

  const versionInfo = await axios.get(apiUrl)
  const latest = versionInfo.data['PCP'][0]
  const version = latest.version

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GDRIVE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() })

  for (const [platform, { key, ext, mime }] of Object.entries(platforms)) {
    const info = latest.downloads[key]
    if (!info || !info.link) continue

    const url = info.link
    const filename = `pycharm-professional-${version}-${platform}${ext}`
    const response = await axios({ method: 'GET', url, responseType: 'stream' })

    await drive.files.create({
      requestBody: { name: filename },
      media: { mimeType: mime, body: response.data },
    })

    console.log(`✅ Загружено: ${filename}`)
  }
}

main().catch(err => {
  console.error(`❌ Ошибка: ${err.message}`)
  process.exit(1)
})
