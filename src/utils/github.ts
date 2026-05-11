const REPO_OWNER = 'smzase'
const REPO_NAME = 'smzase_sub'
const API_BASE = 'https://api.github.com'

let _token = ''

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
  return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${branch}/${encodeURIComponent(path).replace(/%2F/g, '/')}`
}

export function downloadUrl(path: string, branch = 'main'): string {
  return rawUrl(path, branch)
}

export async function getContents(path: string): Promise<any> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`GitHub API error: ${res.status}`)
  }
  return res.json()
}

export async function getTree(treeSha: string, recursive = true): Promise<any> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${treeSha}${recursive ? '?recursive=1' : ''}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  return res.json()
}

export async function getRef(branch = 'main'): Promise<string> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${branch}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return data.object.sha
}

export async function getCommit(sha: string): Promise<any> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits/${sha}`
  const res = await fetch(url, { headers: headers() })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  return res.json()
}

export async function createBlob(content: string, encoding: 'utf-8' | 'base64' = 'base64'): Promise<string> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ content, encoding }),
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return data.sha
}

export async function createTree(baseTree: string, tree: Array<{ path: string; mode: string; type: string; sha: string }>): Promise<string> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ base_tree: baseTree, tree }),
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return data.sha
}

export async function createCommit(message: string, treeSha: string, parentSha: string): Promise<string> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return data.sha
}

export async function updateRef(sha: string, branch = 'main'): Promise<void> {
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${branch}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ sha }),
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
}

export async function uploadFiles(
  files: Array<{ path: string; content: string; encoding: 'utf-8' | 'base64' }>,
  message: string,
  branch = 'main'
): Promise<void> {
  const refSha = await getRef(branch)
  const commit = await getCommit(refSha)
  const baseTreeSha = commit.tree.sha

  const treeItems = []
  for (const file of files) {
    const blobSha = await createBlob(file.content, file.encoding)
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
}

export async function uploadLargeFile(
  path: string,
  fileContent: ArrayBuffer,
  message: string,
  branch = 'main'
): Promise<void> {
  const CHUNK_SIZE = 20 * 1024 * 1024
  const totalSize = fileContent.byteLength

  if (totalSize <= CHUNK_SIZE) {
    const base64 = arrayBufferToBase64(fileContent)
    await uploadFiles([{ path, content: base64, encoding: 'base64' }], message, branch)
    return
  }

  const ext = path.substring(path.lastIndexOf('.'))
  const basePath = path.substring(0, path.lastIndexOf('.'))
  const chunks: Array<{ path: string; content: string; encoding: 'utf-8' | 'base64' }> = []
  let offset = 0
  let partIndex = 1

  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize)
    const chunk = fileContent.slice(offset, end)
    const base64 = arrayBufferToBase64(chunk)
    chunks.push({
      path: `${basePath}.part${partIndex}${ext}`,
      content: base64,
      encoding: 'base64',
    })
    offset = end
    partIndex++
  }

  const manifest = {
    originalName: path.split('/').pop(),
    totalSize,
    parts: chunks.map((c, i) => ({
      file: c.path.split('/').pop(),
      size: i < chunks.length - 1 ? CHUNK_SIZE : totalSize % CHUNK_SIZE || CHUNK_SIZE,
    })),
  }

  chunks.push({
    path: `${basePath}.manifest.json`,
    content: JSON.stringify(manifest, null, 2),
    encoding: 'utf-8',
  })

  await uploadFiles(chunks, message, branch)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export async function deleteFile(path: string, message: string, branch = 'main'): Promise<void> {
  const content = await getContents(path)
  if (!content) return
  const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ message, sha: content.sha, branch }),
  })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
}
