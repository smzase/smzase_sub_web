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

async function getR2FontName(env: Env, key: string, fallbackName: string): Promise<string> {
  const object = await env.R2.get(key)
  if (!object) return fallbackName.replace(/\.(ttf|otf|ttc|woff2?)$/i, '')
  const encodedName = object.customMetadata?.fontNameBase64
  const metadataName = encodedName ? decodeBase64Utf8(encodedName) : object.customMetadata?.fontName
  if (metadataName) return metadataName
  const buffer = await object.arrayBuffer()
  const parsedName = parseFontName(buffer) || fallbackName.replace(/\.(ttf|otf|ttc|woff2?)$/i, '')
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

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

      if (url.pathname.startsWith('/fonts/')) {
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
    const hashed = await hashPassword(body.password)
    const encrypted = await encrypt(JSON.stringify({ username: body.username, password: hashed }))
    await env.subKV.put('auth:credentials', encrypted)
    return jsonResponse({ success: true })
  }

  if (path === 'auth/login' && request.method === 'POST') {
    const body = await request.json() as { username: string; password: string }
    const encrypted = await env.subKV.get('auth:credentials')
    if (!encrypted) return jsonResponse({ error: 'No account configured' }, 400)
    try {
      const decrypted = await decrypt(encrypted)
      const creds = JSON.parse(decrypted)
      const hashed = await hashPassword(body.password)
      if (creds.username === body.username && creds.password === hashed) {
        const sessionId = crypto.randomUUID()
        await env.subKV.put('session:active', JSON.stringify({ username: body.username, token: sessionId }), { expirationTtl: 86400 * 7 })
        return jsonResponse({ token: sessionId })
      }
    } catch {
      // noop
    }
    return jsonResponse({ error: 'Invalid credentials' }, 401)
  }

  if (path === 'auth/status' && request.method === 'GET') {
    const existing = await env.subKV.get('auth:credentials')
    return jsonResponse({ configured: !!existing })
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

  if (path === 'templates' && request.method === 'GET') {
    const raw = await env.subKV.get('templates:list')
    return jsonResponse({ templates: raw ? JSON.parse(raw) : [] })
  }

  if (path === 'templates' && request.method === 'POST') {
    const body = await request.json() as { templates: any[] }
    await env.subKV.put('templates:list', JSON.stringify(body.templates))
    return jsonResponse({ success: true })
  }

  if (path === 'anime/names' && request.method === 'GET') {
    const raw = await env.subKV.get('anime:names')
    return jsonResponse({ names: raw ? JSON.parse(raw) : {} })
  }

  if (path === 'anime/names' && request.method === 'POST') {
    const body = await request.json() as { year: string; titleEn: string; titleCn: string }
    if (!body.year || !body.titleEn) return jsonResponse({ error: 'Missing fields' }, 400)
    const raw = await env.subKV.get('anime:names')
    const names = raw ? JSON.parse(raw) : {}
    const key = `${body.year}/${body.titleEn}`
    if (body.titleCn) {
      names[key] = body.titleCn
    } else {
      delete names[key]
    }
    await env.subKV.put('anime:names', JSON.stringify(names))
    return jsonResponse({ success: true })
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
    const domain = (await env.subKV.get('config:r2_domain')) || ''
    const downloadUrl = domain ? `${domain.replace(/\/$/, '')}/fonts/${encodeURIComponent(fileName)}` : ''
    return jsonResponse({ success: true, key, downloadUrl, fontName })
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
    return jsonResponse({ success: true })
  }

  if (path === 'fonts/list' && request.method === 'GET') {
    const listed = await env.R2.list({ prefix: 'fonts/' })
    const domain = (await env.subKV.get('config:r2_domain')) || ''
    const files = await Promise.all(listed.objects.map(async obj => {
      const rawName = obj.key.replace('fonts/', '')
      const name = decodeURIComponent(rawName)
      const fontName = await getR2FontName(env, obj.key, name)
      return {
        name,
        key: obj.key,
        size: obj.size,
        downloadUrl: domain ? `${domain.replace(/\/$/, '')}/fonts/${encodeURIComponent(name)}` : '',
        fontName,
      }
    }))
    return jsonResponse({ files })
  }

  return jsonResponse({ error: 'Not Found' }, 404)
}
