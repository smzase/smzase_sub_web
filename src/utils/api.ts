import type { StaffInfo, StaffPosition } from '../types'

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

export async function getAuthStatus(): Promise<{ configured: boolean; secondPasswordEnabled: boolean }> {
  return apiFetch('auth/status')
}

export async function setupAccount(username: string, password: string): Promise<any> {
  return apiFetch('auth/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function login(username: string, password: string, secondPassword?: string): Promise<{ token: string }> {
  return apiFetch('auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, secondPassword }),
  })
}

export async function getAccount(): Promise<{ username: string }> {
  return apiFetch('auth/account')
}

export async function updateAccount(payload: { username?: string; oldPassword?: string; newPassword?: string }): Promise<any> {
  return apiFetch('auth/account', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getSecondPasswordSettings(): Promise<{ enabled: boolean; configured: boolean }> {
  return apiFetch('auth/second-password')
}

export async function saveSecondPasswordSettings(settings: { enabled: boolean; password?: string }): Promise<any> {
  return apiFetch('auth/second-password', {
    method: 'POST',
    body: JSON.stringify(settings),
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

export async function getUploadSettings(): Promise<{ allowLargeSubtitleUpload: boolean }> {
  return apiFetch('upload-settings')
}

export async function saveUploadSettings(settings: { allowLargeSubtitleUpload: boolean }): Promise<any> {
  return apiFetch('upload-settings', {
    method: 'POST',
    body: JSON.stringify(settings),
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

export async function getAnimeTemplateLinks(): Promise<{ links: Record<string, string> }> {
  return apiFetch('anime-template-links')
}

export async function saveAnimeTemplateLinks(links: Record<string, string>): Promise<any> {
  return apiFetch('anime-template-links', {
    method: 'POST',
    body: JSON.stringify({ links }),
  })
}

export async function getSubtitleLanguageConfig(): Promise<{ config: { hans: string; hant: string } | null }> {
  return apiFetch('subtitle-language-config')
}

export async function saveSubtitleLanguageConfig(config: { hans: string; hant: string }): Promise<any> {
  return apiFetch('subtitle-language-config', {
    method: 'POST',
    body: JSON.stringify({ config }),
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

export async function getAnimeDescriptions(): Promise<{ descriptions: Record<string, string> }> {
  return apiFetch('anime-descriptions')
}

export async function saveAnimeDescriptions(descriptions: Record<string, string>): Promise<any> {
  return apiFetch('anime-descriptions', {
    method: 'POST',
    body: JSON.stringify({ descriptions }),
  })
}

export async function getStaffSettings(): Promise<{ settings: { position: StaffPosition; roles: string[] } }> {
  return apiFetch('staff-settings')
}

export async function saveStaffSettings(settings: { position: StaffPosition; roles: string[] }): Promise<any> {
  return apiFetch('staff-settings', {
    method: 'POST',
    body: JSON.stringify({ settings }),
  })
}

export async function getAnimeStaff(): Promise<{ staff: Record<string, StaffInfo> }> {
  return apiFetch('anime-staff')
}

export async function saveAnimeStaff(staff: Record<string, StaffInfo>): Promise<any> {
  return apiFetch('anime-staff', {
    method: 'POST',
    body: JSON.stringify({ staff }),
  })
}

export async function getReadmeCache(path: string): Promise<{ content: string; key?: string }> {
  return apiFetch(`readme-cache?path=${encodeURIComponent(path)}`)
}

export async function saveReadmeCache(path: string, content: string): Promise<any> {
  return apiFetch('readme-cache', {
    method: 'POST',
    body: JSON.stringify({ path, content }),
  })
}

interface UploadProgressOptions {
  onProgress?: (percent: number) => void
}

interface MultipartPartRef {
  partNumber: number
  etag: string
}

interface MultipartUploadResult {
  success: boolean
  key: string
  downloadUrl: string
}

function contentTypeForFile(name: string): string {
  if (/\.zip$/i.test(name)) return 'application/zip'
  if (/\.7z$/i.test(name)) return 'application/x-7z-compressed'
  if (/\.rar$/i.test(name)) return 'application/vnd.rar'
  return 'application/octet-stream'
}

function uploadFileWithProgress<T>(path: string, file: File, fallbackError: string, options?: UploadProgressOptions): Promise<T> {
  const token = getSessionToken()
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/${path}`)
    xhr.setRequestHeader('Content-Type', contentTypeForFile(file.name))
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

async function uploadMultipartPart(fileName: string, uploadId: string, partNumber: number, chunk: Blob): Promise<MultipartPartRef> {
  const token = getSessionToken()
  const res = await fetch(`${API_BASE}/font-packages/multipart/part`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(fileName),
      'X-Upload-Id': uploadId,
      'X-Part-Number': String(partNumber),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: chunk,
  })
  const data = await res.json()
  if (res.status === 401) {
    clearSession()
    throw new Error('Unauthorized')
  }
  if (!res.ok) throw new Error(data.error || `分片上传失败 ${partNumber}`)
  return data
}

export async function uploadFontPackageMultipartToR2(file: File, options?: UploadProgressOptions): Promise<MultipartUploadResult> {
  const partSize = 8 * 1024 * 1024
  const init = await apiFetch('font-packages/multipart/init', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, contentType: contentTypeForFile(file.name) }),
  }) as { key: string; uploadId: string }
  const parts: MultipartPartRef[] = []
  try {
    const totalParts = Math.ceil(file.size / partSize)
    for (let index = 0; index < totalParts; index++) {
      const start = index * partSize
      const end = Math.min(start + partSize, file.size)
      const part = await uploadMultipartPart(file.name, init.uploadId, index + 1, file.slice(start, end))
      parts.push(part)
      options?.onProgress?.(Math.min(99, Math.round((end / file.size) * 100)))
    }
    const result = await apiFetch('font-packages/multipart/complete', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, uploadId: init.uploadId, parts }),
    }) as MultipartUploadResult
    options?.onProgress?.(100)
    return result
  } catch (err) {
    await apiFetch('font-packages/multipart/abort', {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, uploadId: init.uploadId }),
    }).catch(() => undefined)
    throw err
  }
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

export async function listR2FontPackages(): Promise<{ files: Array<{ name: string; key: string; size: number; downloadUrl: string; fontName: string }> }> {
  return apiFetch('font-packages/list')
}
