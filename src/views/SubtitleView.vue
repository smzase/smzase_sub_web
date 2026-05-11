<template>
  <div>
    <n-card title="字幕列表">
      <template #header-extra>
        <n-button size="small" :loading="loading" @click="loadData">刷新</n-button>
      </template>

      <n-spin :show="loading">
        <n-empty v-if="!loading && years.length === 0" description="暂无字幕数据" />

        <n-collapse v-if="years.length > 0" :default-expanded-names="years">
          <n-collapse-item v-for="year in years" :key="year" :title="year + ' 年'" :name="year">
            <n-list bordered>
              <n-list-item v-for="anime in animeByYear[year]" :key="anime.folder">
                <n-thing>
                  <template #header>
                    <span style="cursor: pointer;" @click="toggleAnimeDetail(year, anime.folder)">
                      {{ anime.folder }}
                    </span>
                  </template>
                  <template #header-extra>
                    <n-space>
                      <n-tag size="small" v-for="lang in anime.languages" :key="lang">
                        {{ lang === 'zh-hans' ? '简中' : lang === 'zh-hant' ? '繁中' : lang }}
                      </n-tag>
                      <n-tag size="small" type="info">{{ anime.subtitleCount }} 个字幕</n-tag>
                    </n-space>
                  </template>
                </n-thing>

                <template v-if="expandedAnime === `${year}/${anime.folder}`">
                  <n-divider style="margin: 8px 0;" />
                  <n-spin :show="detailLoading">
                    <div v-if="animeDetail">
                      <div v-if="animeDetail.coverUrl" style="margin-bottom: 12px;">
                        <n-image :src="animeDetail.coverUrl" width="200" />
                      </div>
                      <n-descriptions bordered :column="2" size="small" style="margin-bottom: 12px;">
                        <n-descriptions-item label="英文标题">{{ animeDetail.titleEn }}</n-descriptions-item>
                        <n-descriptions-item label="中文名">{{ animeDetail.titleCn }}</n-descriptions-item>
                      </n-descriptions>

                      <n-data-table
                        v-if="animeDetail.subtitles.length > 0"
                        :columns="subtitleColumns"
                        :data="animeDetail.subtitles"
                        :pagination="false"
                        size="small"
                        style="margin-bottom: 12px;"
                      />

                      <div v-if="animeDetail.fonts.length > 0">
                        <n-text strong style="display: block; margin-bottom: 8px;">使用字体</n-text>
                        <n-data-table
                          :columns="fontRefColumns"
                          :data="animeDetail.fonts"
                          :pagination="false"
                          size="small"
                        />
                      </div>
                    </div>
                  </n-spin>
                </template>
              </n-list-item>
            </n-list>
          </n-collapse-item>
        </n-collapse>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import type { AnimeInfo, SubtitleFile, FontRef } from '../types'
import { getContents, rawUrl, getToken, downloadUrl } from '../utils/github'
import { parseAnimeReadme } from '../utils/readme'

interface AnimeListItem {
  folder: string
  languages: string[]
  subtitleCount: number
}

const message = useMessage()
const loading = ref(false)
const detailLoading = ref(false)
const years = ref<string[]>([])
const animeByYear = ref<Record<string, AnimeListItem[]>>({})
const expandedAnime = ref('')
const animeDetail = ref<AnimeInfo | null>(null)

const subtitleColumns: DataTableColumns<SubtitleFile> = [
  { title: '集数', key: 'episode', width: 80, render: (row) => `E${String(row.episode).padStart(2, '0')}` },
  { title: '语言', key: 'lang', width: 80, render: (row) => row.lang === 'zh-hans' ? '简中' : row.lang === 'zh-hant' ? '繁中' : row.lang },
  { title: '文件名', key: 'name', ellipsis: { tooltip: true } },
  {
    title: '操作', key: 'actions', width: 80,
    render: (row) => h(NButton, {
      size: 'tiny', type: 'primary', text: true,
      onClick: () => window.open(row.downloadUrl || downloadUrl(row.path), '_blank'),
    }, { default: () => '下载' }),
  },
]

const fontRefColumns: DataTableColumns<FontRef> = [
  { title: '字体名', key: 'name' },
  {
    title: '操作', key: 'actions', width: 80,
    render: (row) => h(NButton, {
      size: 'tiny', type: 'primary', text: true,
      onClick: () => window.open(row.downloadUrl || downloadUrl(row.path), '_blank'),
    }, { default: () => '下载' }),
  },
]

async function loadData() {
  if (!getToken()) {
    message.warning('请先设置 GitHub Token')
    return
  }
  loading.value = true
  try {
    const contents = await getContents('Anime subtitles')
    if (!contents || !Array.isArray(contents)) {
      years.value = []
      return
    }

    const yearDirs = contents.filter((c: any) => c.type === 'dir').map((c: any) => c.name).sort().reverse()
    years.value = yearDirs

    for (const year of yearDirs) {
      const yearContents = await getContents(`Anime subtitles/${year}`)
      if (!yearContents || !Array.isArray(yearContents)) continue

      const animeList: AnimeListItem[] = []
      for (const item of yearContents) {
        if (item.type !== 'dir') continue
        const animeContents = await getContents(`Anime subtitles/${year}/${item.name}`)
        if (!animeContents || !Array.isArray(animeContents)) continue

        const assFiles = animeContents.filter((f: any) => f.name.endsWith('.ass'))
        const languages = new Set<string>()
        for (const f of assFiles) {
          if (f.name.includes('.zh-hans.')) languages.add('zh-hans')
          if (f.name.includes('.zh-hant.')) languages.add('zh-hant')
        }

        animeList.push({
          folder: item.name,
          languages: Array.from(languages),
          subtitleCount: assFiles.length,
        })
      }
      animeByYear.value[year] = animeList
    }
  } catch (err: any) {
    message.error(`加载失败: ${err.message}`)
  } finally {
    loading.value = false
  }
}

async function toggleAnimeDetail(year: string, folder: string) {
  const key = `${year}/${folder}`
  if (expandedAnime.value === key) {
    expandedAnime.value = ''
    animeDetail.value = null
    return
  }

  expandedAnime.value = key
  detailLoading.value = true

  try {
    const basePath = `Anime subtitles/${year}/${folder}`
    const contents = await getContents(basePath)
    if (!contents || !Array.isArray(contents)) return

    let titleCn = ''
    let coverUrl = ''
    let languages: string[] = []
    let readmeFonts: FontRef[] = []

    const readmeFile = contents.find((f: any) => f.name === 'README.md')
    if (readmeFile) {
      const readmeUrl = rawUrl(`${basePath}/README.md`)
      const res = await fetch(readmeUrl)
      if (res.ok) {
        const text = await res.text()
        const parsed = parseAnimeReadme(text)
        titleCn = parsed.titleCn
        coverUrl = parsed.coverUrl
        languages = parsed.languages
        readmeFonts = parsed.fonts
      }
    }

    const assFiles = contents.filter((f: any) => f.name.endsWith('.ass'))
    const subtitles: SubtitleFile[] = assFiles.map((f: any) => {
      const epMatch = f.name.match(/E(\d+)/)
      const langMatch = f.name.match(/\.(zh-hans|zh-hant)\./)
      return {
        name: f.name,
        path: `${basePath}/${f.name}`,
        episode: epMatch ? parseInt(epMatch[1], 10) : 0,
        season: 1,
        lang: langMatch ? langMatch[1] : '',
        downloadUrl: downloadUrl(`${basePath}/${f.name}`),
      }
    })

    if (languages.length === 0) {
      const langSet = new Set<string>()
      for (const s of subtitles) {
        if (s.lang) langSet.add(s.lang)
      }
      languages = Array.from(langSet)
    }

    animeDetail.value = {
      year,
      folder,
      titleEn: folder,
      titleCn,
      coverUrl,
      languages,
      subtitles,
      fonts: readmeFonts,
    }
  } catch (err: any) {
    message.error(`加载详情失败: ${err.message}`)
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => {
  if (getToken()) loadData()
})
</script>
