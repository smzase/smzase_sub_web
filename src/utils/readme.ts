import type { AnimeInfo, SubtitleFile, FontRef } from '../types'
import { downloadUrl } from './github'

export function generateRootReadme(yearGroups: Array<{ year: string; animeList: Array<{ titleEn: string; titleCn: string }> }>): string {
  let md = `# Anime subtitles\n\n`
  for (const group of yearGroups) {
    md += `## ${group.year}\n\n`
    md += `| 标题 | 中文名 |\n`
    md += `| --- | --- |\n`
    for (const anime of group.animeList) {
      const encodedTitle = anime.titleEn.split('/').map(s => encodeURIComponent(s)).join('/')
      md += `| [${anime.titleEn}](./${encodeURIComponent(group.year)}/${encodedTitle}/) | ${anime.titleCn || ''} |\n`
    }
    md += `\n`
  }
  return md
}

export function generateYearReadme(year: string, animeList: Array<{ titleEn: string; titleCn: string }>): string {
  let md = `# ${year}\n\n`
  md += `| 标题 | 中文名 |\n`
  md += `| --- | --- |\n`
  for (const anime of animeList) {
    const encodedPath = anime.titleEn.split('/').map(s => encodeURIComponent(s)).join('/')
    md += `| [${anime.titleEn}](./${encodedPath}/) | ${anime.titleCn || ''} |\n`
  }
  return md
}

export function parseYearReadme(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const rows = content.split('\n').filter(line => line.trim().startsWith('|'))
  for (const row of rows) {
    if (row.includes('---') || row.includes('标题')) continue
    const cols = row.split('|').map(c => c.trim()).filter(c => c)
    if (cols.length < 2) continue
    const titleMatch = cols[0].match(/\[(.+?)\]\(.+?\)/)
    const titleEn = titleMatch ? titleMatch[1] : cols[0]
    const titleCn = cols[1]
    if (titleEn && titleCn) result[titleEn] = titleCn
  }
  return result
}

function getFontSortInfo(font: FontRef): { group: number; value: string } {
  const value = (font.displayName || font.name).trim()
  const first = value.charAt(0)
  if (/^[0-9]/.test(first)) return { group: 0, value }
  if (/^[A-Za-z]/.test(first)) return { group: 1, value }
  return { group: 2, value }
}

export function generateAnimeReadme(anime: AnimeInfo): string {
  let md = ''

  if (anime.coverUrl) {
    md += `![${anime.titleEn}](${anime.coverUrl})\n\n`
  }

  if (anime.titleCn) {
    md += `## ${anime.titleCn}\n\n`
  }

  if (anime.languages.length > 0) {
    md += `## 字幕语言\n\n`
    const langOrder: Record<string, number> = { 'zh-hans': 0, 'zh-hant': 1 }
    const sortedLangs = [...anime.languages].sort((a, b) => (langOrder[a] ?? 9) - (langOrder[b] ?? 9))
    for (const lang of sortedLangs) {
      if (lang === 'zh-hans') {
        md += `- \`Zh-hans\` 为 ${anime.subtitleType === 'bilingual' ? '简日双语' : '简体中文'}\n`
      } else if (lang === 'zh-hant') {
        md += `- \`Zh-hant\` 为 ${anime.subtitleType === 'bilingual' ? '繁日雙語' : '繁體中文'}\n`
      } else {
        md += `- \`${lang}\`\n`
      }
    }
    md += `\n`
  }

  if (anime.subtitles.length > 0) {
    md += `## 字幕列表\n\n`
    md += `| 集数 | 标题 | 简体下载 | 繁體下載 |\n`
    md += `| --- | --- | --- | --- |\n`

    const episodeMap = new Map<number, { zhHans?: SubtitleFile; zhHant?: SubtitleFile }>()
    for (const sub of anime.subtitles) {
      if (!episodeMap.has(sub.episode)) {
        episodeMap.set(sub.episode, {})
      }
      const ep = episodeMap.get(sub.episode)!
      if (sub.lang === 'zh-hans') ep.zhHans = sub
      else if (sub.lang === 'zh-hant') ep.zhHant = sub
    }

    const sortedEpisodes = Array.from(episodeMap.keys()).sort((a, b) => a - b)
    const titles = anime.episodeTitles || {}

    for (const epNum of sortedEpisodes) {
      const ep = episodeMap.get(epNum)!
      const epLabel = `EP${String(epNum).padStart(2, '0')}`
      const titleCell = titles[epNum] || ''
      const hansCell = ep.zhHans
        ? `[下载](${ep.zhHans.downloadUrl || downloadUrl(ep.zhHans.path)})`
        : '-'
      const hantCell = ep.zhHant
        ? `[下载](${ep.zhHant.downloadUrl || downloadUrl(ep.zhHant.path)})`
        : '-'
      md += `| ${epLabel} | ${titleCell} | ${hansCell} | ${hantCell} |\n`
    }
    md += `\n`
  }

  if (anime.fonts.length > 0) {
    md += `## 使用字体\n\n`
    md += `| 字体名 | 字体下载 |\n`
    md += `| --- | --- |\n`
    const sortedFonts = [...anime.fonts].sort((a, b) => {
      const sa = getFontSortInfo(a)
      const sb = getFontSortInfo(b)
      if (sa.group !== sb.group) return sa.group - sb.group
      return sa.value.localeCompare(sb.value, 'en', { numeric: true, sensitivity: 'base' })
    })
    for (const font of sortedFonts) {
      const displayName = font.displayName || font.name
      const dl = font.downloadUrl || (font.path.startsWith('fonts/') ? '' : downloadUrl(font.path))
      const fileName = font.name
      md += `| ${displayName} | ${dl ? `[${fileName}](${dl})` : fileName} |\n`
    }
    md += `\n`
  }

  return md
}

export function parseAnimeReadme(content: string): {
  coverUrl: string
  titleCn: string
  languages: string[]
  fonts: FontRef[]
  subtitles: SubtitleFile[]
  subtitleType: string
  episodeTitles: Record<number, string>
} {
  const result = {
    coverUrl: '',
    titleCn: '',
    languages: [] as string[],
    fonts: [] as FontRef[],
    subtitles: [] as SubtitleFile[],
    subtitleType: 'bilingual',
    episodeTitles: {} as Record<number, string>,
  }

  const coverMatch = content.match(/!\[.*?\]\((.*?)\)/)
  if (coverMatch) {
    result.coverUrl = coverMatch[1]
  }

  const sectionHeadings = ['字幕语言', '字幕列表', '使用字体']
  const cnMatches = content.match(/^## (.+)$/gm)
  if (cnMatches) {
    for (const m of cnMatches) {
      const title = m.replace(/^## /, '').trim()
      if (!sectionHeadings.includes(title)) {
        result.titleCn = title
        break
      }
    }
  }

  const langSection = content.match(/## 字幕语言\n\n([\s\S]*?)(?=\n##|$)/)
  if (langSection) {
    const langLines = langSection[1].match(/^- .+$/gm)
    if (langLines) {
      for (const line of langLines) {
        const text = line.replace(/^- /, '').trim()
        if (text.includes('Zh-hans') || text.includes('zh-hans')) {
          result.languages.push('zh-hans')
          if (text.includes('双语') || text.includes('雙語')) result.subtitleType = 'bilingual'
        } else if (text.includes('Zh-hant') || text.includes('zh-hant')) {
          result.languages.push('zh-hant')
        } else if (text === '简体中文' || text === '简中') {
          result.languages.push('zh-hans')
          result.subtitleType = 'monolingual'
        } else if (text === '繁體中文' || text === '繁体中文' || text === '繁中') {
          result.languages.push('zh-hant')
          result.subtitleType = 'monolingual'
        }
      }
    }
  }

  const subSection = content.match(/## 字幕列表\n\n[\s\S]*?\n((?:\|[^|]+\|\n)+)/)
  if (subSection) {
    const rows = subSection[1].trim().split('\n')
    for (const row of rows) {
      if (row.includes('---')) continue
      const cols = row.split('|').map(c => c.trim()).filter(c => c)
      if (cols.length < 2) continue
      const epLabel = cols[0]
      const epMatch = epLabel.match(/EP(\d+)/i) || epLabel.match(/E(\d+)/i)
      if (!epMatch) continue
      const epNum = parseInt(epMatch[1], 10)
      if (cols.length >= 4) {
        const title = cols[1]
        if (title) result.episodeTitles[epNum] = title
      }
    }
  }

  const fontSection = content.match(/## 使用字体\n\n[\s\S]*?\n((?:\|[^|]+\|[^|]+\|\n)+)/)
  if (fontSection) {
    const rows = fontSection[1].trim().split('\n')
    for (const row of rows) {
      if (row.includes('---')) continue
      const cols = row.split('|').filter(c => c.trim())
      if (cols.length >= 2) {
        const displayName = cols[0].trim()
        const linkMatch = cols[1].match(/\[(.+?)\]\((.+?)\)/)
        if (linkMatch) {
          const fileName = linkMatch[1]
          const dlUrl = linkMatch[2]
          result.fonts.push({
            name: fileName,
            path: dlUrl.includes('/fonts/') ? `fonts/${fileName}` : `Fonts/${fileName}`,
            downloadUrl: dlUrl,
            displayName,
          })
        } else {
          const fileName = cols[1].trim()
          result.fonts.push({
            name: fileName,
            path: `Fonts/${fileName}`,
            downloadUrl: '',
            displayName,
          })
        }
      }
    }
  }

  return result
}

export function mergeSubtitles(
  existing: SubtitleFile[],
  newSubs: SubtitleFile[]
): SubtitleFile[] {
  const map = new Map<string, SubtitleFile>()
  for (const s of existing) {
    map.set(`${s.episode}-${s.lang}`, s)
  }
  for (const s of newSubs) {
    map.set(`${s.episode}-${s.lang}`, s)
  }
  return Array.from(map.values())
}
