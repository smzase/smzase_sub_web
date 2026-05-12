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

export async function getEpisodeTitles(): Promise<{ episodeTitles: Record<string, Record<string, string>> }> {
  return apiFetch('episode-titles')
}

export async function saveEpisodeTitles(episodeTitles: Record<string, Record<string, string>>): Promise<any> {
  return apiFetch('episode-titles', {
    method: 'POST',
    body: JSON.stringify({ episodeTitles }),
  })
}

interface UploadProgressOptions {
  onProgress?: (percent: number) => void
}

function uploadFileWithProgress<T>(path: string, file: File, fallbackError: string, options?: UploadProgressOptions): Promise<T> {
  const token = getSessionToken()
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/${path}`)
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options?.onProgress?.(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))))
      }
    }
    xhr.onload = () => {
      let data: any = {}
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {}
      } catch {
        reject(new Error(fallbackError))
        return
      }
      if (xhr.status === 401) {
        clearSession()
        reject(new Error('Unauthorized'))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data.error || fallbackError))
        return
      }
      options?.onProgress?.(100)
      resolve(data)
    }
    xhr.onerror = () => reject(new Error('网络请求失败，请检查 Worker 部署、CORS 或网络连接'))
    xhr.ontimeout = () => reject(new Error('上传超时，请稍后重试'))
    xhr.send(file)
  })
}

export async function uploadFontToR2(file: File, options?: UploadProgressOptions): Promise<{ success: boolean; key: string; downloadUrl: string; fontName: string }> {
  return uploadFileWithProgress('fonts/upload', file, 'Upload failed', options)
}

export async function uploadFontPackageToR2(file: File, options?: UploadProgressOptions): Promise<{ success: boolean; key: string; downloadUrl: string }> {
  return uploadFileWithProgress('font-packages/upload', file, 'Upload failed', options)
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
