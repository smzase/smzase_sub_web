import type { AnimeInfo, SubtitleFile, SubtitlePackageRef, FontRef, FontPackageRef, StaffInfo, StaffItem } from '../types'
import { downloadUrl } from './github'

export function generateRootReadme(yearGroups: Array<{ year: string; animeList: Array<{ titleEn: string; titleCn: string }> }>): string {
  let md = ''
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
    if (row.includes('---')) continue
    const cols = splitMarkdownRow(row)
    if (cols.length < 2) continue
    if (cols[0] === '标题') continue
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

function generateStaffTable(staff?: StaffInfo, withHeading = false): string {
  const items = (staff?.items || []).filter(item => item.role.trim() || item.people.trim())
  if (items.length === 0) return ''
  let md = withHeading ? `## Staff\n\n` : ''
  md += `| 职位 | 人员 |\n`
  md += `| --- | --- |\n`
  for (const item of items) {
    md += `| ${item.role.trim()} | ${item.people.trim()} |\n`
  }
  md += `\n`
  return md
}

function generateLanguageLines(anime: AnimeInfo): string {
  if (anime.languages.length === 0) return ''
  let md = ''
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
  return md ? `${md}\n` : ''
}

function splitMarkdownRow(row: string): string[] {
  const cells = row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.map(cell => cell.trim())
}

function parseStaffTable(section: string): StaffItem[] {
  const rows = section.trim().split('\n').filter(row => row.trim().startsWith('|'))
  const items: StaffItem[] = []
  for (const row of rows) {
    if (row.includes('---')) continue
    const cols = splitMarkdownRow(row)
    if (cols.length < 2) continue
    if (cols[0] === '职位') continue
    if (cols[0] || cols[1]) items.push({ role: cols[0], people: cols[1] })
  }
  return items
}

function applyLanguageLine(result: { languages: string[]; subtitleType: string }, text: string) {
  const normalizedText = text.toLowerCase()
  if (normalizedText.includes('zh-hans')) {
    if (!result.languages.includes('zh-hans')) result.languages.push('zh-hans')
    if (text.includes('双语') || text.includes('雙語')) result.subtitleType = 'bilingual'
  } else if (normalizedText.includes('zh-hant')) {
    if (!result.languages.includes('zh-hant')) result.languages.push('zh-hant')
    if (text.includes('双语') || text.includes('雙語')) result.subtitleType = 'bilingual'
  } else if (text === '简体中文' || text === '简中') {
    if (!result.languages.includes('zh-hans')) result.languages.push('zh-hans')
    result.subtitleType = 'monolingual'
  } else if (text === '繁體中文' || text === '繁体中文' || text === '繁中') {
    if (!result.languages.includes('zh-hant')) result.languages.push('zh-hant')
    result.subtitleType = 'monolingual'
  }
}

function parsePackageLink(cell: string): { name: string; url: string } | null {
  const linkMatch = cell.match(/\[(.+?)\]\((.+?)\)/)
  const url = linkMatch ? linkMatch[2] : cell.trim()
  if (!/^https?:\/\//.test(url)) return null
  const name = linkMatch ? linkMatch[1] : decodeURIComponent(url.split('/').pop() || '')
  return { name, url }
}

function applyFontPackageRow(result: { fontPackages: FontPackageRef[] }, cell: string) {
  const parsed = parsePackageLink(cell)
  if (parsed) {
    result.fontPackages.push({
      name: parsed.name,
      path: parsed.url.includes('/font-packages/') ? `font-packages/${parsed.name}` : `FontPackages/${parsed.name}`,
      downloadUrl: parsed.url,
    })
  } else if (cell.trim()) {
    result.fontPackages.push({
      name: cell,
      path: `FontPackages/${cell}`,
      downloadUrl: '',
    })
  }
}

function extractDescriptionAndStaff(section: string): { description: string; staffItems: StaffItem[] } {
  let description = section.trim()
  let staffItems: StaffItem[] = []
  const staffStart = description.search(/^\s*\|\s*职位\s*\|\s*人员\s*\|\s*$/m)
  if (staffStart >= 0) {
    const staffSection = description.slice(staffStart)
    staffItems = parseStaffTable(staffSection)
    description = description.slice(0, staffStart).trim()
  }
  description = description.replace(/^- `.+$/gm, '').trim()
  return { description, staffItems }
}

function applyFontRow(result: { fonts: FontRef[] }, displayName: string, cell: string) {
  const linkMatch = cell.match(/\[(.+?)\]\((.+?)\)/)
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
    result.fonts.push({
      name: cell,
      path: `Fonts/${cell}`,
      downloadUrl: '',
      displayName,
    })
  }
}

function getSubtitlePackageCell(pkg?: SubtitlePackageRef): string {
  if (!pkg) return '-'
  const dl = pkg.downloadUrl || downloadUrl(pkg.path)
  return `[${pkg.lang === 'zh-hant' ? '合集下載' : '合集下载'}](${dl})`
}

function applySubtitlePackageCell(result: { subtitlePackages: SubtitlePackageRef[] }, lang: string, cell: string) {
  if (!cell || cell === '-') return
  const linkMatch = cell.match(/\[(.+?)\]\((.+?)\)/)
  const dlUrl = linkMatch ? linkMatch[2] : cell
  if (!/^https?:\/\//.test(dlUrl)) return
  const decoded = decodeURIComponent(dlUrl.split('/').pop() || `${lang}.zip`)
  result.subtitlePackages.push({
    name: decoded,
    path: dlUrl.includes('/Anime%20subtitles/') || dlUrl.includes('/Anime subtitles/') ? '' : decoded,
    lang,
    downloadUrl: dlUrl,
  })
}

export function generateAnimeReadme(anime: AnimeInfo): string {
  let md = ''

  if (anime.coverUrl) {
    md += `![${anime.titleEn}](${anime.coverUrl})\n\n`
  }

  if (anime.titleCn) {
    md += `## ${anime.titleCn}\n\n`
  }

  if (anime.description?.trim()) {
    md += `${anime.description.trim()}\n\n`
  }

  if (anime.staff?.position === 'after-description') {
    md += generateStaffTable(anime.staff)
  }

  if (anime.subtitles.length > 0 || (anime.subtitlePackages && anime.subtitlePackages.length > 0)) {
    md += `## 字幕列表\n\n`
    md += generateLanguageLines(anime)
    md += `| 集数 | 标题 | 简体下载 | 繁體下載 |\n`
    md += `| --- | --- | --- | --- |\n`

    const subtitlePackages = anime.subtitlePackages || []
    if (subtitlePackages.length > 0) {
      const hansPackage = subtitlePackages.find(pkg => pkg.lang === 'zh-hans')
      const hantPackage = subtitlePackages.find(pkg => pkg.lang === 'zh-hant')
      md += `| 合集 |  | ${getSubtitlePackageCell(hansPackage)} | ${getSubtitlePackageCell(hantPackage)} |\n`
    }

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

  if ((anime.fontPackages && anime.fontPackages.length > 0) || anime.fonts.length > 0) {
    md += `## 使用字体\n\n`

    if (anime.fontPackages && anime.fontPackages.length > 0) {
      md += `| 字体整合包 |\n`
      md += `| --- |\n`
      for (const pkg of anime.fontPackages) {
        const dl = pkg.downloadUrl || (pkg.path.startsWith('font-packages/') ? '' : downloadUrl(pkg.path))
        md += `| ${dl ? `[${pkg.name}](${dl})` : pkg.name} |\n`
      }
      md += `\n`
    }

    if (anime.fonts.length > 0) {
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
  }

  if (anime.staff?.position === 'after-fonts') {
    md += generateStaffTable(anime.staff, true)
  }

  return md
}

export function parseAnimeReadme(content: string): {
  coverUrl: string
  titleCn: string
  languages: string[]
  fonts: FontRef[]
  fontPackages: FontPackageRef[]
  subtitlePackages: SubtitlePackageRef[]
  subtitles: SubtitleFile[]
  subtitleType: string
  episodeTitles: Record<number, string>
  description: string
  staff: StaffInfo
} {
  content = content.replace(/\r\n?/g, '\n')
  const result = {
    coverUrl: '',
    titleCn: '',
    languages: [] as string[],
    fonts: [] as FontRef[],
    fontPackages: [] as FontPackageRef[],
    subtitlePackages: [] as SubtitlePackageRef[],
    subtitles: [] as SubtitleFile[],
    subtitleType: 'bilingual',
    episodeTitles: {} as Record<number, string>,
    description: '',
    staff: { position: 'after-description', items: [] } as StaffInfo,
  }

  const coverMatch = content.match(/!\[.*?\]\((.*?)\)/)
  if (coverMatch) {
    result.coverUrl = coverMatch[1]
  }

  const sectionHeadings = ['字幕语言', '字幕列表', '字体整合包', '使用字体', 'Staff']
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

  if (result.titleCn) {
    const escapedTitle = result.titleCn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const descriptionMatch = content.match(new RegExp(`(?:^|\\n)## ${escapedTitle}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, ''))
    if (descriptionMatch) {
      const extracted = extractDescriptionAndStaff(descriptionMatch[1])
      result.description = extracted.description
      if (extracted.staffItems.length > 0) {
        result.staff = { position: 'after-description', items: extracted.staffItems }
      }
    }
  }

  const langSection = content.match(/## 字幕语言\s*\n([\s\S]*?)(?=\n## 字幕列表|\n## 使用字体|\n## 字体整合包|\n## 字体压缩包|\n## Staff|$)/)
  if (langSection) {
    const langText = langSection[1]
    const legacyDescriptionText = langText.replace(/^- .+$/gm, '').trim()
    if (!result.description && legacyDescriptionText) {
      const extracted = extractDescriptionAndStaff(legacyDescriptionText)
      result.description = extracted.description
      if (extracted.staffItems.length > 0) {
        result.staff = { position: 'after-description', items: extracted.staffItems }
      }
    }
    const langLines = langText.match(/^- .+$/gm)
    if (langLines) {
      for (const line of langLines) {
        const text = line.replace(/^- /, '').trim()
        applyLanguageLine(result, text)
      }
    }
  }

  const subSection = content.match(/## 字幕列表\s*\n([\s\S]*?)(?=\n##|$)/)
  if (subSection) {
    const langLines = subSection[1].match(/^- .+$/gm)
    if (langLines) {
      for (const line of langLines) {
        applyLanguageLine(result, line.replace(/^- /, '').trim())
      }
    }
    const rows = subSection[1].trim().split('\n').filter(row => row.trim().startsWith('|'))
    for (const row of rows) {
      if (row.includes('---')) continue
      const cols = splitMarkdownRow(row)
      if (cols.length < 2) continue
      if (cols[0] === '集数') continue
      const epLabel = cols[0]
      if (epLabel === '合集') {
        if (cols.length >= 4) {
          applySubtitlePackageCell(result, 'zh-hans', cols[2])
          applySubtitlePackageCell(result, 'zh-hant', cols[3])
        }
        continue
      }
      const epMatch = epLabel.match(/EP(\d+)/i) || epLabel.match(/E(\d+)/i)
      if (!epMatch) continue
      const epNum = parseInt(epMatch[1], 10)
      if (cols.length >= 4) {
        const title = cols[1]
        if (title) result.episodeTitles[epNum] = title
      }
    }
  }

  const fontPackageSection = content.match(/## (?:字体整合包|字体压缩包)\s*\n([\s\S]*?)(?=\n##|$)/)
  if (fontPackageSection) {
    const rows = fontPackageSection[1].trim().split('\n').filter(row => row.trim().startsWith('|'))
    for (const row of rows) {
      if (row.includes('---')) continue
      const cols = splitMarkdownRow(row)
      if (cols.length < 1) continue
      const firstCell = cols[0].trim()
      if (firstCell === '压缩包名' || firstCell === '字体压缩包' || firstCell === '字体整合包') continue
      applyFontPackageRow(result, cols[0])
    }
  }

  const staffSection = content.match(/## Staff\s*\n([\s\S]*?)(?=\n##|$)/)
  if (staffSection) {
    result.staff = { position: 'after-fonts', items: parseStaffTable(staffSection[1]) }
  }

  const fontSection = content.match(/## 使用字体\s*\n([\s\S]*?)(?=\n##|$)/)
  if (fontSection) {
    const rows = fontSection[1].trim().split('\n').filter(row => row.trim().startsWith('|'))
    let tableType: 'package' | 'font' | '' = ''
    for (const row of rows) {
      if (row.includes('---')) continue
      const cols = splitMarkdownRow(row)
      const firstCell = cols[0]?.trim() || ''
      if (firstCell === '字体压缩包' || firstCell === '字体整合包') {
        tableType = 'package'
        continue
      }
      if (firstCell === '字体名') {
        tableType = 'font'
        continue
      }
      if (tableType === 'package' && cols.length >= 1) {
        applyFontPackageRow(result, cols[0])
      } else if (tableType === 'font' && cols.length >= 2) {
        applyFontRow(result, cols[0], cols[1])
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
