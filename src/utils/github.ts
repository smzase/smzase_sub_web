const REPO_OWNER = 'smzase'
const REPO_NAME = 'smzase_sub'
const API_BASE = 'https://api.github.com'
const LOCAL_API_BASE = '/api'

let _token = ''
const fileTextCache = new Map<string, string>()

export function setToken(token: string) {
  _token = token
  localStorage.setItem('gh_token', token)
}

export function getToken(): string {
  if (!_token) {
    _token = localStorage.getItem('gh_token') || ''
  }
  return _token
}

function headers(): Record<string, string> {
  return {
    Authorization: `token ${getToken()}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

export function rawUrl(path: string, branch = 'main'): string {
  const segments = path.split('/')
  const encoded = segments.map(s => encodeURIComponent(s)).join('/')
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${branch}/${encoded}`
}

export function downloadUrl(path: string, branch = 'main'): string {
  return rawUrl(path, branch)
}

export async function getFileText(path: string): Promise<string> {
  if (fileTextCache.has(path)) return fileTextCache.get(path) || ''
  if (path.endsWith('README.md')) {
    try {
      const res = await fetch(`${LOCAL_API_BASE}/readme-cache?path=${encodeURIComponent(path)}`, {
        headers: sessionAuthHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.content) {
          fileTextCache.set(path, data.content)
          return data.content
        }
      }
    } catch {
      // noop
    }
  }
  const content = await getContents(path)
  if (!content || Array.isArray(content) || !content.content) return ''
  const normalized = content.content.replace(/\n/g, '')
  const text = decodeURIComponent(escape(atob(normalized)))
  fileTextCache.set(path, text)
  return text
}

export function setFileTextCache(path: string, content: string) {
  fileTextCache.set(path, content)
}

function sessionAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('smzase_session') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function saveReadmeCache(path: string, content: string) {
  if (!path.endsWith('README.md')) return
  try {
    await fetch(`${LOCAL_API_BASE}/readme-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sessionAuthHeaders() },
      body: JSON.stringify({ path, content }),
    })
  } catch {
    // noop
  }
}

export function readmeUrl(path: string, branch = 'main'): string {
  return rawUrl(path, branch) + `?_t=${Date.now()}`
}

async function githubFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...options, headers: { ...headers(), ...(options?.headers || {}) } })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body.message || JSON.stringify(body)
    } catch {
      // noop
    }
    throw new Error(`GitHub API ${res.status}: ${detail || res.statusText}`)
  }
  return res
}

export async function getContents(path: string): Promise<any> {
  const segments = path.split('/')
  const encoded = segments.map(s => encodeURIComponent(s)).join('/')
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encoded}`
  try {
    const res = await githubFetch(url)
    return await res.json()
  } catch (err: any) {
    if (err.message.includes('404')) return null
    throw err
  }
}

export async function getTree(treeSha: string, recursive = true): Promise<any> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${treeSha}${recursive ? '?recursive=1' : ''}`
  const res = await githubFetch(url)
  return await res.json()
}

export async function getRef(branch = 'main'): Promise<string> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${branch}`
  const res = await githubFetch(url)
  const data = await res.json()
  return data.object.sha
}

export async function getCommit(sha: string): Promise<any> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${sha}`
  const res = await githubFetch(url)
  return await res.json()
}

export async function createBlob(content: string, encoding: 'utf-8' | 'base64' = 'base64'): Promise<string> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`
  const res = await githubFetch(url, {
    method: 'POST',
    body: JSON.stringify({ content, encoding }),
  })
  const data = await res.json()
  return data.sha
}

export async function createTree(baseTree: string, tree: Array<{ path: string; mode: string; type: string; sha: string | null }>): Promise<string> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`
  const res = await githubFetch(url, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree }),
  })
  const data = await res.json()
  return data.sha
}

export async function createCommit(message: string, treeSha: string, parentSha: string): Promise<string> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`
  const res = await githubFetch(url, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  })
  const data = await res.json()
  return data.sha
}

export async function updateRef(sha: string, branch = 'main'): Promise<void> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${branch}`
  await githubFetch(url, {
    method: 'PATCH',
    body: JSON.stringify({ sha, force: true }),
  })
}

export interface UploadProgressInfo {
  path: string
  percent: number
}

export async function uploadFiles(
  files: Array<{ path: string; content: string; encoding: 'utf-8' | 'base64' }>,
  message: string,
  branch = 'main',
  onProgress?: (info: UploadProgressInfo) => void
): Promise<void> {
  const refSha = await getRef(branch)
  const commit = await getCommit(refSha)
  const baseTreeSha = commit.tree.sha

  const treeItems = []
  for (const file of files) {
    onProgress?.({ path: file.path, percent: 10 })
    const blobSha = await createBlob(file.content, file.encoding)
    onProgress?.({ path: file.path, percent: 80 })
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobSha,
    })
  }

  const newTreeSha = await createTree(baseTreeSha, treeItems)
  const newCommitSha = await createCommit(message, newTreeSha, refSha)
  await updateRef(newCommitSha, branch)
  for (const file of files) {
    if (file.encoding === 'utf-8') {
      setFileTextCache(file.path, file.content)
      await saveReadmeCache(file.path, file.content)
    } else {
      try {
        const text = decodeURIComponent(escape(atob(file.content)))
        setFileTextCache(file.path, text)
        await saveReadmeCache(file.path, text)
      } catch {
        // noop
      }
    }
  }
  for (const file of files) {
    onProgress?.({ path: file.path, percent: 100 })
  }
}

export async function deleteFile(path: string, message: string, branch = 'main'): Promise<void> {
  const content = await getContents(path)
  if (!content) return
  const segments = path.split('/')
  const encoded = segments.map(s => encodeURIComponent(s)).join('/')
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encoded}`
  await githubFetch(url, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha: content.sha, branch }),
  })
}

export async function deleteFolder(folderPath: string, message: string, branch = 'main'): Promise<void> {
  const refSha = await getRef(branch)
  const commit = await getCommit(refSha)
  const baseTreeSha = commit.tree.sha

  const tree = await getTree(baseTreeSha)
  const allFiles = tree.tree || []

  const filesInFolder = allFiles.filter(
    (item: any) => item.path.startsWith(folderPath + '/') && item.type === 'blob'
  )

  if (filesInFolder.length === 0) return

  const treeItems = filesInFolder.map((item: any) => ({
    path: item.path,
    mode: '100644',
    type: 'blob',
    sha: null as any,
  }))

  const newTreeSha = await createTree(baseTreeSha, treeItems)
  const newCommitSha = await createCommit(message, newTreeSha, refSha)
  await updateRef(newCommitSha, branch)
}
