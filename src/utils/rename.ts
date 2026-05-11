import type { UploadTemplate } from '../types'

export function parseOriginalName(filename: string): { episode: number; lang: string } | null {
  const match = filename.match(/^(\d+)\.(zh-hans|zh-hant)\.ass$/i)
  if (!match) return null
  return {
    episode: parseInt(match[1], 10),
    lang: match[2].toLowerCase(),
  }
}

export function buildSubtitleName(template: UploadTemplate, episode: number, lang: string): string {
  const epStr = String(episode).padStart(2, '0')
  const seasonStr = String(template.season).padStart(2, '0')
  return `[${template.groupTag}] ${template.titleEn} - S${seasonStr}E${epStr}.${lang}.ass`
}

export function buildSubtitlePath(template: UploadTemplate, filename: string): string {
  return `Anime subtitles/${template.year}/${template.titleEn}/${filename}`
}

export function buildFontPath(filename: string): string {
  return `Fonts/${filename}`
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i]
}
