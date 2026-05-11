import type { AnimeInfo, FontRef } from '../types'
import { downloadUrl } from './github'

export function generateYearReadme(year: string, animeList: Array<{ titleEn: string; titleCn: string }>): string {
  let md = `# ${year}\n\n`
  md += `| 英文/罗马音标题 | 中文名 |\n`
  md += `| --- | --- |\n`
  for (const anime of animeList) {
    md += `| [${anime.titleEn}](./${anime.titleEn}/) | ${anime.titleCn} |\n`
  }
  return md
}

export function generateAnimeReadme(anime: AnimeInfo): string {
  let md = ''

  if (anime.coverUrl) {
    md += `![${anime.titleEn}](${anime.coverUrl})\n\n`
  }

  md += `# ${anime.titleEn}\n\n`
  md += `**中文名:** ${anime.titleCn}\n\n`

  if (anime.languages.length > 0) {
    md += `## 字幕语言\n\n`
    for (const lang of anime.languages) {
      const langLabel = lang === 'zh-hans' ? '简体中文' : lang === 'zh-hant' ? '繁体中文' : lang
      md += `- ${langLabel}\n`
    }
    md += `\n`
  }

  if (anime.subtitles.length > 0) {
    md += `## 字幕列表\n\n`
    md += `| 集数 | 语言 | 文件 | 下载 |\n`
    md += `| --- | --- | --- | --- |\n`

    const sorted = [...anime.subtitles].sort((a, b) => {
      if (a.episode !== b.episode) return a.episode - b.episode
      return a.lang.localeCompare(b.lang)
    })

    for (const sub of sorted) {
      const langLabel = sub.lang === 'zh-hans' ? '简中' : sub.lang === 'zh-hant' ? '繁中' : sub.lang
      const dl = sub.downloadUrl || downloadUrl(sub.path)
      md += `| E${String(sub.episode).padStart(2, '0')} | ${langLabel} | ${sub.name} | [下载](${dl}) |\n`
    }
    md += `\n`
  }

  if (anime.fonts.length > 0) {
    md += `## 使用字体\n\n`
    md += `| 字体名 | 下载 |\n`
    md += `| --- | --- |\n`
    for (const font of anime.fonts) {
      const dl = font.downloadUrl || downloadUrl(font.path)
      md += `| ${font.name} | [下载](${dl}) |\n`
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
} {
  const result = {
    coverUrl: '',
    titleCn: '',
    languages: [] as string[],
    fonts: [] as FontRef[],
  }

  const coverMatch = content.match(/!\[.*?\]\((.*?)\)/)
  if (coverMatch) {
    result.coverUrl = coverMatch[1]
  }

  const cnMatch = content.match(/\*\*中文名:\*\*\s*(.+)/)
  if (cnMatch) {
    result.titleCn = cnMatch[1].trim()
  }

  const langSection = content.match(/## 字幕语言\n\n([\s\S]*?)(?=\n##|$)/)
  if (langSection) {
    const langLines = langSection[1].match(/^- (.+)$/gm)
    if (langLines) {
      result.languages = langLines.map(l => {
        const text = l.replace(/^- /, '').trim()
        if (text === '简体中文') return 'zh-hans'
        if (text === '繁体中文') return 'zh-hant'
        return text
      })
    }
  }

  const fontSection = content.match(/## 使用字体\n\n[\s\S]*?\n((?:\|[^|]+\|[^|]+\|\n)+)/)
  if (fontSection) {
    const rows = fontSection[1].trim().split('\n')
    for (const row of rows) {
      const cols = row.split('|').filter(c => c.trim())
      if (cols.length >= 2) {
        const name = cols[0].trim()
        const linkMatch = cols[1].match(/\[下载\]\((.+?)\)/)
        if (linkMatch) {
          result.fonts.push({
            name,
            path: `Fonts/${name}`,
            downloadUrl: linkMatch[1],
          })
        }
      }
    }
  }

  return result
}
