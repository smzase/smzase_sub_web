import type { AnimeInfo, SubtitleFile, FontRef } from '../types'
import { downloadUrl } from './github'

export function generateYearReadme(year: string, animeList: Array<{ titleEn: string; titleCn: string }>): string {
  let md = `# ${year}\n\n`
  md += `| 标题 | 中文名 |\n`
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

  if (anime.languages.length > 0) {
    md += `## 字幕语言\n\n`
    for (const lang of anime.languages) {
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
    md += `| 集数 | 简体下载 | 繁體下載 |\n`
    md += `| --- | --- | --- |\n`

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

    for (const epNum of sortedEpisodes) {
      const ep = episodeMap.get(epNum)!
      const epLabel = `E${String(epNum).padStart(2, '0')}`
      const hansCell = ep.zhHans
        ? `[下载](${ep.zhHans.downloadUrl || downloadUrl(ep.zhHans.path)})`
        : '-'
      const hantCell = ep.zhHant
        ? `[下载](${ep.zhHant.downloadUrl || downloadUrl(ep.zhHant.path)})`
        : '-'
      md += `| ${epLabel} | ${hansCell} | ${hantCell} |\n`
    }
    md += `\n`
  }

  if (anime.fonts.length > 0) {
    md += `## 使用字体\n\n`
    md += `| 字体名 | 下载 |\n`
    md += `| --- | --- |\n`
    for (const font of anime.fonts) {
      const dl = font.downloadUrl || (font.path.startsWith('fonts/') ? '' : downloadUrl(font.path))
      md += `| ${font.name} | ${dl ? `[下载](${dl})` : '-'} |\n`
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
} {
  const result = {
    coverUrl: '',
    titleCn: '',
    languages: [] as string[],
    fonts: [] as FontRef[],
    subtitles: [] as SubtitleFile[],
    subtitleType: 'bilingual',
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
      const cols = row.split('|').map(c => c.trim()).filter(c => c)
      if (cols.length >= 2) continue
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
