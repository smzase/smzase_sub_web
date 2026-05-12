export interface AnimeInfo {
  year: string
  folder: string
  titleEn: string
  titleCn: string
  coverUrl: string
  languages: string[]
  subtitles: SubtitleFile[]
  fonts: FontRef[]
  fontPackages?: FontPackageRef[]
  subtitleType: string
  episodeTitles?: Record<number, string>
}

export interface SubtitleFile {
  name: string
  path: string
  episode: number
  season: number
  lang: string
  downloadUrl: string
}

export interface FontFile {
  name: string
  path: string
  size: number
  downloadUrl: string
  usedBy: string[]
}

export interface FontRef {
  name: string
  path: string
  downloadUrl: string
  displayName: string
}

export interface FontPackageRef {
  name: string
  path: string
  downloadUrl: string
}

export interface UploadTemplate {
  name: string
  groupTag: string
  titleEn: string
  titleCn: string
  season: number
  year: string
  coverUrl: string
  languages: string[]
  subtitleType: string
}

export interface RepoTreeItem {
  path: string
  mode: string
  type: string
  sha: string
  size?: number
  url: string
}

export interface GitHubContent {
  name: string
  path: string
  sha: string
  size: number
  type: 'file' | 'dir'
  download_url: string | null
}
