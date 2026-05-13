interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  subKV: KVNamespace
  R2: R2Bucket
}

const ENCRYPTION_KEY = 'smzase_sub_enc_key_2026'

function parseFontName(buffer: ArrayBuffer): string {
  const view = new DataView(buffer)
  if (buffer.byteLength < 12) return ''
  const sfVersion = view.getUint32(0)
  const isTtf = sfVersion === 0x00010000 || sfVersion === 0x74727565
  const isOtf = sfVersion === 0x4F54544F
  if (!isTtf && !isOtf) return ''
  const numTables = view.getUint16(4)
  for (let i = 0; i < numTables; i++) {
    const offset = 12 + i * 16
    if (offset + 16 > buffer.byteLength) break
    const tag = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    )
    if (tag === 'name') {
      const tableOffset = view.getUint32(offset + 8)
      if (tableOffset + 6 > buffer.byteLength) break
      const count = view.getUint16(tableOffset + 2)
      const stringOffset = view.getUint16(tableOffset + 4)
      const readStr = (recOff: number): string => {
        const pID = view.getUint16(recOff)
        const eID = view.getUint16(recOff + 2)
        const nID = view.getUint16(recOff + 6)
        const len = view.getUint16(recOff + 8)
        const nOff = view.getUint16(recOff + 10)
        const start = tableOffset + stringOffset + nOff
        if (start + len > buffer.byteLength) return ''
        const bytes = new Uint8Array(buffer, start, len)
        let s = ''
        if (pID === 3 && eID === 1) {
          for (let k = 0; k < bytes.length; k += 2) s += String.fromCharCode((bytes[k] << 8) | bytes[k + 1])
        } else if (pID === 1 && eID === 0) {
          s = String.fromCharCode(...bytes)
        } else if (pID === 0) {
          for (let k = 0; k < bytes.length; k += 2) s += String.fromCharCode((bytes[k] << 8) | bytes[k + 1])
        }
        return s
      }
      const name4: string[] = []
      const name1: string[] = []
      const name16: string[] = []
      for (let j = 0; j < count; j++) {
        const recOffset = tableOffset + 6 + j * 12
        if (recOffset + 12 > buffer.byteLength) break
        const nID = view.getUint16(recOffset + 6)
        const s = readStr(recOffset)
        if (!s) continue
        if (nID === 4) name4.push(s)
        else if (nID === 1) name1.push(s)
        else if (nID === 16) name16.push(s)
      }
      const hasHan = (s: string) => /[\u4e00-\u9fff]/.test(s)
      const hasKana = (s: string) => /[\u3040-\u309f\u30a0-\u30ff]/.test(s)
      const hasHangul = (s: string) => /[\uac00-\ud7af]/.test(s)
      const chineseName = [...name4, ...name16, ...name1].find(s => hasHan(s) && !hasKana(s))
      if (chineseName) return chineseName
      const hanName = [...name4, ...name16, ...name1].find(hasHan)
      if (hanName) return hanName
      const japaneseName = [...name4, ...name16, ...name1].find(hasKana)
      if (japaneseName) return japaneseName
      const koreanName = [...name4, ...name16, ...name1].find(hasHangul)
      if (koreanName) return koreanName
      const readable4 = name4.find(s => s.includes(' '))
      if (readable4) return readable4
      if (name16.length > 0) return name16[0]
      if (name1.length > 0) return name1[0]
      return name4[0] || ''
    }
  }
  return ''
}

function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64Utf8(text: string): string {
  try {
    const binary = atob(text)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

const FONT_METADATA_INDEX_KEY = 'fonts/_metadata.json'

type FontMetadataIndex = Record<string, { fontName: string; originalName?: string }>

function readFontNameFromMetadata(metadata?: Record<string, string>): string {
  if (!metadata) return ''
  const encodedName = metadata.fontNameBase64
  return encodedName ? decodeBase64Utf8(encodedName) : metadata.fontName || ''
}

async function readFontMetadataIndex(env: Env): Promise<FontMetadataIndex> {
  const object = await env.R2.get(FONT_METADATA_INDEX_KEY)
  if (!object) return {}
  try {
    return JSON.parse(await object.text())
  } catch {
    return {}
  }
}

async function writeFontMetadataIndex(env: Env, index: FontMetadataIndex): Promise<void> {
  await env.R2.put(FONT_METADATA_INDEX_KEY, JSON.stringify(index), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  })
}

async function getR2FontName(env: Env, key: string, fallbackName: string, index?: FontMetadataIndex): Promise<string> {
  const fallback = fallbackName.replace(/\.(ttf|otf|ttc|woff2?)$/i, '')
  const indexedName = index?.[key]?.fontName
  if (indexedName) return indexedName
  const head = await env.R2.head(key)
  if (!head) return fallback
  const metadataName = readFontNameFromMetadata(head.customMetadata)
  if (metadataName) return metadataName
  const object = await env.R2.get(key)
  if (!object) return fallback
  const buffer = await object.arrayBuffer()
  const parsedName = parseFontName(buffer) || fallback
  await env.R2.put(key, buffer, {
    httpMetadata: object.httpMetadata || undefined,
    customMetadata: {
      ...(object.customMetadata || {}),
      originalName: object.customMetadata?.originalName || fallbackName,
      fontNameBase64: encodeBase64Utf8(parsedName),
    },
  })
  return parsedName
}

async function encrypt(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const keyData = encoder.encode(ENCRYPTION_KEY)
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, data)
  const combined = new Uint8Array(data.length + signature.byteLength + 2)
  combined[0] = (data.length >> 8) & 0xff
  combined[1] = data.length & 0xff
  combined.set(data, 2)
  combined.set(new Uint8Array(signature), 2 + data.length)
  return btoa(String.fromCharCode(...combined))
}

async function decrypt(encrypted: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  const dataLen = (combined[0] << 8) | combined[1]
  const data = combined.slice(2, 2 + dataLen)
  const signature = combined.slice(2 + dataLen)
  const encoder = new TextEncoder()
  const keyData = encoder.encode(ENCRYPTION_KEY)
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const valid = await crypto.subtle.verify('HMAC', key, signature, data)
  if (!valid) throw new Error('Decryption failed: invalid signature')
  return new TextDecoder().decode(data)
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + ENCRYPTION_KEY)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getCredentials(env: Env): Promise<{ username: string; password: string } | null> {
  const encrypted = await env.subKV.get('auth:credentials')
  if (!encrypted) return null
  try {
    return JSON.parse(await decrypt(encrypted))
  } catch {
    return null
  }
}

async function saveCredentials(env: Env, credentials: { username: string; password: string }): Promise<void> {
  await env.subKV.put('auth:credentials', await encrypt(JSON.stringify(credentials)))
}

async function getSecondPasswordSettings(env: Env): Promise<{ enabled: boolean; password: string }> {
  const encrypted = await env.subKV.get('auth:second_password')
  if (!encrypted) return { enabled: false, password: '' }
  try {
    const settings = JSON.parse(await decrypt(encrypted))
    return { enabled: !!settings.enabled, password: settings.password || '' }
  } catch {
    return { enabled: false, password: '' }
  }
}

async function saveSecondPasswordSettings(env: Env, settings: { enabled: boolean; password: string }): Promise<void> {
  await env.subKV.put('auth:second_password', await encrypt(JSON.stringify(settings)))
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name, X-Upload-Id, X-Part-Number',
  }
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

async function verifyAuth(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false
  const token = authHeader.slice(7)
  try {
    const raw = await env.subKV.get('session:active')
    if (!raw) return false
    const session = JSON.parse(raw)
    return session.token === token
  } catch {
    return false
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url)

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() })
      }

      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, url, env)
      }

      if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/font-packages/')) {
        const key = decodeURIComponent(url.pathname.slice(1))
        const object = await env.R2.get(key)
        if (!object) {
          return new Response('Not Found', { status: 404 })
        }
        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${object.customMetadata?.originalName || key.split('/').pop()}"`,
            'Cache-Control': 'public, max-age=31536000',
          },
        })
      }

      const response = await env.ASSETS.fetch(request)
      if (response.status === 404 && !url.pathname.startsWith('/assets/')) {
        const indexUrl = new URL('/', request.url)
        const indexResponse = await env.ASSETS.fetch(new Request(indexUrl.toString()))
        return new Response(indexResponse.body, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      }
      return response
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Internal Server Error' }, 500)
    }
  },
} as ExportedHandler<Env>

async function handleApi(request: Request, url: URL, env: Env): Promise<Response> {
  const path = url.pathname.replace(/^\/api\//, '')

  if (path === 'health') {
    return jsonResponse({ status: 'ok' })
  }

  if (path === 'auth/setup' && request.method === 'POST') {
    const existing = await env.subKV.get('auth:credentials')
    if (existing) return jsonResponse({ error: 'Account already exists' }, 400)
    const body = await request.json() as { username: string; password: string }
    if (!body.username || !body.password) return jsonResponse({ error: 'Missing fields' }, 400)
    await saveCredentials(env, { username: body.username, password: await hashPassword(body.password) })
    return jsonResponse({ success: true })
  }

  if (path === 'auth/login' && request.method === 'POST') {
    const body = await request.json() as { username: string; password: string; secondPassword?: string }
    const creds = await getCredentials(env)
    if (!creds) return jsonResponse({ error: 'No account configured' }, 400)
    const secondPasswordSettings = await getSecondPasswordSettings(env)
    const hashed = await hashPassword(body.password)
    const secondPasswordValid = !secondPasswordSettings.enabled || (
      !!body.secondPassword &&
      !!secondPasswordSettings.password &&
      secondPasswordSettings.password === await hashPassword(body.secondPassword)
    )
    if (creds.username === body.username && creds.password === hashed && secondPasswordValid) {
      const sessionId = crypto.randomUUID()
      await env.subKV.put('session:active', JSON.stringify({ username: body.username, token: sessionId }), { expirationTtl: 86400 * 7 })
      return jsonResponse({ token: sessionId })
    }
    return jsonResponse({ error: 'Invalid credentials' }, 401)
  }

  if (path === 'auth/status' && request.method === 'GET') {
    const existing = await env.subKV.get('auth:credentials')
    const secondPasswordSettings = await getSecondPasswordSettings(env)
    return jsonResponse({ configured: !!existing, secondPasswordEnabled: secondPasswordSettings.enabled })
  }

  if (path === 'auth/logout' && request.method === 'POST') {
    await env.subKV.delete('session:active')
    return jsonResponse({ success: true })
  }

  if (!(await verifyAuth(request, env))) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  if (path === 'auth/token' && request.method === 'GET') {
    const encrypted = await env.subKV.get('auth:gh_token')
    if (!encrypted) return jsonResponse({ token: '' })
    try {
      const token = await decrypt(encrypted)
      return jsonResponse({ token })
    } catch {
      return jsonResponse({ token: '' })
    }
  }

  if (path === 'auth/token' && request.method === 'POST') {
    const body = await request.json() as { token: string }
    const encrypted = await encrypt(body.token)
    await env.subKV.put('auth:gh_token', encrypted)
    return jsonResponse({ success: true })
  }

  if (path === 'auth/r2-domain' && request.method === 'GET') {
    const domain = await env.subKV.get('config:r2_domain')
    return jsonResponse({ domain: domain || '' })
  }

  if (path === 'auth/r2-domain' && request.method === 'POST') {
    const body = await request.json() as { domain: string }
    await env.subKV.put('config:r2_domain', body.domain)
    return jsonResponse({ success: true })
  }

  if (path === 'auth/account' && request.method === 'GET') {
    const creds = await getCredentials(env)
    return jsonResponse({ username: creds?.username || '' })
  }

  if (path === 'auth/account' && request.method === 'POST') {
    const body = await request.json() as { username?: string; oldPassword?: string; newPassword?: string }
    const creds = await getCredentials(env)
    if (!creds) return jsonResponse({ error: 'No account configured' }, 400)
    const username = body.username?.trim() || creds.username
    const nextCredentials = { username, password: creds.password }
    if (body.newPassword) {
      if (!body.oldPassword) return jsonResponse({ error: 'Missing old password' }, 400)
      if (creds.password !== await hashPassword(body.oldPassword)) return jsonResponse({ error: 'Invalid old password' }, 400)
      nextCredentials.password = await hashPassword(body.newPassword)
    }
    await saveCredentials(env, nextCredentials)
    await env.subKV.delete('session:active')
    return jsonResponse({ success: true })
  }

  if (path === 'auth/second-password' && request.method === 'GET') {
    const settings = await getSecondPasswordSettings(env)
    return jsonResponse({ enabled: settings.enabled, configured: !!settings.password })
  }

  if (path === 'auth/second-password' && request.method === 'POST') {
    const body = await request.json() as { enabled?: boolean; password?: string }
    const current = await getSecondPasswordSettings(env)
    const enabled = !!body.enabled
    let password = current.password
    if (body.password) password = await hashPassword(body.password)
    if (enabled && !password) return jsonResponse({ error: 'Missing second password' }, 400)
    await saveSecondPasswordSettings(env, { enabled, password })
    return jsonResponse({ success: true, enabled, configured: !!password })
  }

  if (path === 'upload-settings' && request.method === 'GET') {
    const raw = await env.subKV.get('config:upload_settings')
    const settings = raw ? JSON.parse(raw) : {}
    return jsonResponse({ allowLargeSubtitleUpload: !!settings.allowLargeSubtitleUpload })
  }

  if (path === 'upload-settings' && request.method === 'POST') {
    const body = await request.json() as { allowLargeSubtitleUpload?: boolean }
    await env.subKV.put('config:upload_settings', JSON.stringify({
      allowLargeSubtitleUpload: !!body.allowLargeSubtitleUpload,
    }))
    return jsonResponse({ success: true })
  }

  if (path === 'templates' && request.method === 'GET') {
    const raw = await env.subKV.get('templates:list')
    return jsonResponse({ templates: raw ? JSON.parse(raw) : [] })
  }

  if (path === 'templates' && request.method === 'POST') {
    const body = await request.json() as { templates: any[] }
    await env.subKV.put('templates:list', JSON.stringify(body.templates))
    return jsonResponse({ success: true })
  }

  if (path === 'anime-template-links' && request.method === 'GET') {
    const raw = await env.subKV.get('templates:anime_links')
    return jsonResponse({ links: raw ? JSON.parse(raw) : {} })
  }

  if (path === 'anime-template-links' && request.method === 'POST') {
    const body = await request.json() as { links: Record<string, string> }
    await env.subKV.put('templates:anime_links', JSON.stringify(body.links || {}))
    return jsonResponse({ success: true })
  }

  if (path === 'subtitle-language-config' && request.method === 'GET') {
    const raw = await env.subKV.get('subtitleLanguage:config')
    return jsonResponse({ config: raw ? JSON.parse(raw) : null })
  }

  if (path === 'subtitle-language-config' && request.method === 'POST') {
    const body = await request.json() as { config: { hans: string; hant: string } | null }
    const hans = body.config?.hans?.trim() || 'zh-hans'
    const hant = body.config?.hant?.trim() || 'zh-hant'
    if (hans === 'zh-hans' && hant === 'zh-hant') {
      await env.subKV.delete('subtitleLanguage:config')
    } else {
      await env.subKV.put('subtitleLanguage:config', JSON.stringify({ hans, hant }))
    }
    return jsonResponse({ success: true })
  }

  if (path === 'episode-titles' && request.method === 'GET') {
    const raw = await env.subKV.get('episodeTitles:list')
    return jsonResponse({ episodeTitles: raw ? JSON.parse(raw) : {} })
  }

  if (path === 'episode-titles' && request.method === 'POST') {
    const body = await request.json() as { episodeTitles: Record<string, Record<string, string>> }
    await env.subKV.put('episodeTitles:list', JSON.stringify(body.episodeTitles))
    return jsonResponse({ success: true })
  }

  if (path === 'anime-descriptions' && request.method === 'GET') {
    const raw = await env.subKV.get('animeDescriptions:list')
    return jsonResponse({ descriptions: raw ? JSON.parse(raw) : {} })
  }

  if (path === 'anime-descriptions' && request.method === 'POST') {
    const body = await request.json() as { descriptions: Record<string, string> }
    await env.subKV.put('animeDescriptions:list', JSON.stringify(body.descriptions || {}))
    return jsonResponse({ success: true })
  }

  if (path === 'readme-cache' && request.method === 'GET') {
    const targetPath = new URL(request.url).searchParams.get('path') || ''
    if (!targetPath.endsWith('README.md')) return jsonResponse({ error: 'Invalid README path' }, 400)
    const key = `readme-cache/${targetPath}`
    const object = await env.R2.get(key)
    if (!object) return jsonResponse({ content: '' })
    return jsonResponse({ content: await object.text(), key })
  }

  if (path === 'readme-cache' && request.method === 'POST') {
    const body = await request.json() as { path: string; content: string }
    if (!body.path?.endsWith('README.md')) return jsonResponse({ error: 'Invalid README path' }, 400)
    const key = `readme-cache/${body.path}`
    await env.R2.put(key, body.content || '', {
      httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      customMetadata: { originalPath: body.path },
    })
    return jsonResponse({ success: true, key })
  }

  if (path === 'fonts/upload' && request.method === 'POST') {
    const contentType = request.headers.get('Content-Type') || ''
    const fileName = decodeURIComponent(request.headers.get('X-File-Name') || 'unknown')
    const key = `fonts/${fileName}`
    const bodyBuffer = await request.arrayBuffer()
    const fontName = parseFontName(bodyBuffer) || fileName.replace(/\.(ttf|otf|ttc|woff2?)$/i, '')
    await env.R2.put(key, bodyBuffer, {
      httpMetadata: { contentType },
      customMetadata: { originalName: fileName, fontNameBase64: encodeBase64Utf8(fontName) },
    })
    const index = await readFontMetadataIndex(env)
    index[key] = { fontName, originalName: fileName }
    await writeFontMetadataIndex(env, index)
    const domain = (await env.subKV.get('config:r2_domain')) || ''
    const downloadUrl = domain ? `${domain.replace(/\/$/, '')}/fonts/${encodeURIComponent(fileName)}` : ''
    return jsonResponse({ success: true, key, downloadUrl, fontName })
  }

  if (path === 'font-packages/upload' && request.method === 'POST') {
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream'
    const fileName = decodeURIComponent(request.headers.get('X-File-Name') || 'unknown.zip')
    const key = `font-packages/${fileName}`
    await env.R2.put(key, request.body, {
      httpMetadata: { contentType },
      customMetadata: { originalName: fileName },
    })
    const domain = (await env.subKV.get('config:r2_domain')) || ''
    const downloadUrl = domain ? `${domain.replace(/\/$/, '')}/font-packages/${encodeURIComponent(fileName)}` : ''
    return jsonResponse({ success: true, key, downloadUrl })
  }

  if (path === 'font-packages/multipart/init' && request.method === 'POST') {
    const body = await request.json() as { fileName: string; contentType?: string }
    if (!body.fileName) return jsonResponse({ error: 'Missing fileName' }, 400)
    const fileName = body.fileName
    const key = `font-packages/${fileName}`
    const upload = await env.R2.createMultipartUpload(key, {
      httpMetadata: { contentType: body.contentType || 'application/octet-stream' },
      customMetadata: { originalName: fileName },
    })
    return jsonResponse({ key, uploadId: upload.uploadId })
  }

  if (path === 'font-packages/multipart/part' && request.method === 'POST') {
    const fileName = decodeURIComponent(request.headers.get('X-File-Name') || '')
    const uploadId = request.headers.get('X-Upload-Id') || ''
    const partNumber = Number(request.headers.get('X-Part-Number') || '0')
    if (!fileName || !uploadId || !partNumber) return jsonResponse({ error: 'Missing multipart fields' }, 400)
    const key = `font-packages/${fileName}`
    const upload = env.R2.resumeMultipartUpload(key, uploadId)
    const part = await upload.uploadPart(partNumber, request.body)
    return jsonResponse({ partNumber, etag: part.etag })
  }

  if (path === 'font-packages/multipart/complete' && request.method === 'POST') {
    const body = await request.json() as { fileName: string; uploadId: string; parts: Array<{ partNumber: number; etag: string }> }
    if (!body.fileName || !body.uploadId || !Array.isArray(body.parts)) return jsonResponse({ error: 'Missing multipart fields' }, 400)
    const key = `font-packages/${body.fileName}`
    const upload = env.R2.resumeMultipartUpload(key, body.uploadId)
    await upload.complete(body.parts)
    const domain = (await env.subKV.get('config:r2_domain')) || ''
    const downloadUrl = domain ? `${domain.replace(/\/$/, '')}/font-packages/${encodeURIComponent(body.fileName)}` : ''
    return jsonResponse({ success: true, key, downloadUrl })
  }

  if (path === 'font-packages/multipart/abort' && request.method === 'POST') {
    const body = await request.json() as { fileName: string; uploadId: string }
    if (!body.fileName || !body.uploadId) return jsonResponse({ error: 'Missing multipart fields' }, 400)
    const key = `font-packages/${body.fileName}`
    const upload = env.R2.resumeMultipartUpload(key, body.uploadId)
    await upload.abort()
    return jsonResponse({ success: true })
  }

  if (path.startsWith('fonts/download/') && request.method === 'GET') {
    const fileName = decodeURIComponent(path.replace('fonts/download/', ''))
    const key = `fonts/${fileName}`
    const object = await env.R2.get(key)
    if (!object) return jsonResponse({ error: 'Not found' }, 404)
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${object.customMetadata?.originalName || fileName}"`,
      },
    })
  }

  if (path === 'fonts/delete' && request.method === 'POST') {
    const body = await request.json() as { key: string }
    if (!body.key) return jsonResponse({ error: 'Missing key' }, 400)
    await env.R2.delete(body.key)
    const index = await readFontMetadataIndex(env)
    delete index[body.key]
    await writeFontMetadataIndex(env, index)
    return jsonResponse({ success: true })
  }

  if (path === 'fonts/list' && request.method === 'GET') {
    const listed = await env.R2.list({ prefix: 'fonts/' })
    const domain = (await env.subKV.get('config:r2_domain')) || ''
    const index = await readFontMetadataIndex(env)
    let indexChanged = false
    const files = await Promise.all(listed.objects.filter(obj => obj.key !== FONT_METADATA_INDEX_KEY).map(async obj => {
      const rawName = obj.key.replace('fonts/', '')
      const name = decodeURIComponent(rawName)
      const fontName = await getR2FontName(env, obj.key, name, index)
      if (fontName && index[obj.key]?.fontName !== fontName) {
        index[obj.key] = { fontName, originalName: name }
        indexChanged = true
      }
      return {
        name,
        key: obj.key,
        size: obj.size,
        downloadUrl: domain ? `${domain.replace(/\/$/, '')}/fonts/${encodeURIComponent(name)}` : '',
        fontName,
      }
    }))
    if (indexChanged) await writeFontMetadataIndex(env, index)
    return jsonResponse({ files })
  }

  if (path === 'font-packages/list' && request.method === 'GET') {
    const listed = await env.R2.list({ prefix: 'font-packages/' })
    const domain = (await env.subKV.get('config:r2_domain')) || ''
    const files = listed.objects.map(obj => {
      const rawName = obj.key.replace('font-packages/', '')
      const name = decodeURIComponent(rawName)
      return {
        name,
        key: obj.key,
        size: obj.size,
        downloadUrl: domain ? `${domain.replace(/\/$/, '')}/font-packages/${encodeURIComponent(name)}` : '',
        fontName: name.replace(/\.(zip|7z|rar)$/i, ''),
      }
    })
    return jsonResponse({ files })
  }

  return jsonResponse({ error: 'Not Found' }, 404)
}
