const API_BASE = '/api'

let _sessionToken = ''

export function getSessionToken(): string {
  if (!_sessionToken) {
    _sessionToken = localStorage.getItem('smzase_session') || ''
  }
  return _sessionToken
}

export function setSessionToken(token: string) {
  _sessionToken = token
  localStorage.setItem('smzase_session', token)
}

export function clearSession() {
  _sessionToken = ''
  localStorage.removeItem('smzase_session')
}

function authHeaders(): Record<string, string> {
  const token = getSessionToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options?.headers || {}) },
  })
  const data = await res.json()
  if (res.status === 401) {
    clearSession()
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`)
  return data
}

export async function getAuthStatus(): Promise<{ configured: boolean }> {
  return apiFetch('auth/status')
}

export async function setupAccount(username: string, password: string): Promise<any> {
  return apiFetch('auth/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function login(username: string, password: string): Promise<{ token: string }> {
  return apiFetch('auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function logout(): Promise<any> {
  return apiFetch('auth/logout', { method: 'POST' })
}

export async function getGHToken(): Promise<{ token: string }> {
  return apiFetch('auth/token')
}

export async function setGHToken(token: string): Promise<any> {
  return apiFetch('auth/token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function getR2Domain(): Promise<{ domain: string }> {
  return apiFetch('auth/r2-domain')
}

export async function setR2Domain(domain: string): Promise<any> {
  return apiFetch('auth/r2-domain', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  })
}

export async function getTemplates(): Promise<{ templates: any[] }> {
  return apiFetch('templates')
}

export async function saveTemplates(templates: any[]): Promise<any> {
  return apiFetch('templates', {
    method: 'POST',
    body: JSON.stringify({ templates }),
  })
}

export async function uploadFontToR2(file: File): Promise<{ success: boolean; key: string; downloadUrl: string }> {
  const token = getSessionToken()
  const res = await fetch(`${API_BASE}/fonts/upload`, {
    method: 'POST',
    headers: {
      'X-File-Name': encodeURIComponent(file.name),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export async function deleteFontFromR2(key: string): Promise<any> {
  return apiFetch('fonts/delete', {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
}

export async function listR2Fonts(): Promise<{ files: Array<{ name: string; key: string; size: number; downloadUrl: string; fontName: string }> }> {
  return apiFetch('fonts/list')
}

export async function getAnimeNames(): Promise<{ names: Record<string, string> }> {
  return apiFetch('anime/names')
}

export async function saveAnimeName(year: string, titleEn: string, titleCn: string): Promise<any> {
  return apiFetch('anime/names', {
    method: 'POST',
    body: JSON.stringify({ year, titleEn, titleCn }),
  })
}
