<template>
  <div>
    <n-card title="字幕列表">
      <template #header-extra>
        <n-space size="small" align="center">
          <n-button size="small" :loading="rootReadmeLoading" @click="refreshRootReadme">更新总README</n-button>
          <n-button size="small" :loading="loading" @click="loadData">刷新</n-button>
        </n-space>
      </template>

      <n-spin :show="loading">
        <n-empty v-if="!loading && years.length === 0" description="暂无字幕数据" />

        <n-collapse v-if="years.length > 0" :default-expanded-names="years">
          <n-collapse-item v-for="year in years" :key="year" :name="year">
            <template #header>
              <n-space align="center" :wrap="false" :size="8">
                <span>{{ year }} 年</span>
                <n-button size="tiny" :loading="yearReadmeLoading === year" @click.stop="refreshYearReadme(year)">更新README</n-button>
              </n-space>
            </template>
            <n-list bordered>
              <n-list-item v-for="anime in animeByYear[year]" :key="anime.folder">
                <n-thing>
                  <template #header>
                    <span style="cursor: pointer;" @click="toggleAnimeDetail(year, anime.folder)">
                      {{ anime.folder }}
                    </span>
                  </template>
                  <template #header-extra>
                    <n-space align="center">
                      <n-tag size="small" v-for="lang in anime.languages" :key="lang">
                        {{ lang === 'zh-hans' ? '简中' : lang === 'zh-hant' ? '繁中' : lang }}
                      </n-tag>
                      <n-tag size="small" type="info">{{ anime.subtitleCount }} 个字幕</n-tag>
                      <n-button size="tiny" :loading="animeReadmeLoading === `${year}/${anime.folder}`" @click.stop="refreshAnimeReadme(year, anime.folder)">更新README</n-button>
                      <n-button size="tiny" :loading="episodeTitleLoading === `${year}/${anime.folder}`" @click.stop="openEpisodeTitleModal(year, anime.folder)">编辑集数标题</n-button>
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

                      <n-data-table
                        v-if="animeDetail.subtitles.length > 0"
                        :columns="subtitleColumns"
                        :data="animeDetail.subtitles"
                        :row-key="(row: SubtitleFile) => row.path"
                        :checked-row-keys="checkedSubtitles"
                        @update:checked-row-keys="onCheckChange"
                        :pagination="false"
                        size="small"
                        style="margin-bottom: 12px;"
                      />

                      <n-space v-if="checkedSubtitles.length > 0" justify="center" style="margin-bottom: 12px;">
                        <n-text depth="3">已选 {{ checkedSubtitles.length }} 项</n-text>
                        <n-button size="tiny" type="primary" @click="batchEdit">批量重新上传</n-button>
                        <n-button size="tiny" type="error" @click="confirmBatchDelete = true">批量删除</n-button>
                      </n-space>
                      <n-space v-if="confirmBatchDelete" justify="center" style="margin-bottom: 12px;">
                        <n-text type="error" style="font-size: 12px;">确认删除 {{ checkedSubtitles.length }} 个字幕?</n-text>
                        <n-button size="tiny" type="error" @click="doBatchDelete">确认</n-button>
                        <n-button size="tiny" @click="confirmBatchDelete = false">取消</n-button>
                      </n-space>

                      <n-collapse v-if="animeDetail.fonts.length > 0" :default-expanded-names="[]">
                        <n-collapse-item title="使用字体" name="fonts">
                          <n-data-table
                            :columns="fontRefColumns"
                            :data="animeDetail.fonts"
                            :row-key="(row: FontRef) => row.name"
                            :checked-row-keys="checkedFonts"
                            @update:checked-row-keys="onFontCheckChange"
                            :pagination="false"
                            size="small"
                          />
                          <n-space v-if="checkedFonts.length > 0" justify="center" style="margin-top: 8px;">
                            <n-text depth="3">已选 {{ checkedFonts.length }} 项</n-text>
                            <n-button size="tiny" type="error" @click="confirmFontBatchRemove = true">批量移除</n-button>
                          </n-space>
                          <n-space v-if="confirmFontBatchRemove" justify="center" style="margin-top: 4px;">
                            <n-text type="error" style="font-size: 12px;">确认移除 {{ checkedFonts.length }} 个字体?</n-text>
                            <n-button size="tiny" type="error" @click="doFontBatchRemove">确认</n-button>
                            <n-button size="tiny" @click="confirmFontBatchRemove = false">取消</n-button>
                          </n-space>
                        </n-collapse-item>
                      </n-collapse>
                    </div>
                  </n-spin>
                </template>
              </n-list-item>
            </n-list>
          </n-collapse-item>
        </n-collapse>
      </n-spin>
    </n-card>

    <n-modal v-model:show="showEditModal" preset="card" title="重新上传字幕" style="width: 480px;">
      <n-upload
        :custom-request="handleEditUpload"
        accept=".ass"
        :show-file-list="false"
        :max="1"
      >
        <n-upload-dragger>
          <div style="padding: 16px 0; text-align: center;">
            <n-text>点击或拖拽替换字幕文件</n-text>
          </div>
        </n-upload-dragger>
      </n-upload>
      <template #action>
        <n-button @click="showEditModal = false">关闭</n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="showEpisodeTitleModal" preset="card" title="编辑集数标题" style="width: 520px;">
      <n-form label-placement="left" label-width="80">
        <n-form-item v-for="ep in episodeTitleList" :key="ep.episode" :label="`EP${String(ep.episode).padStart(2, '0')}`">
          <n-input v-model:value="ep.title" placeholder="输入本集标题" />
        </n-form-item>
      </n-form>
      <n-empty v-if="episodeTitleList.length === 0" description="暂无集数" />
      <template #action>
        <n-space>
          <n-button @click="showEpisodeTitleModal = false">取消</n-button>
          <n-button type="primary" :loading="savingEpisodeTitles" @click="saveEpisodeTitles">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted } from 'vue'
import { NButton, NSpace, NPopconfirm, useMessage } from 'naive-ui'
import type { DataTableColumns, UploadCustomRequestOptions } from 'naive-ui'
import type { AnimeInfo, SubtitleFile, FontRef } from '../types'
import { getContents, readmeUrl, getToken, downloadUrl, uploadFiles, deleteFile } from '../utils/github'
import { parseAnimeReadme, generateAnimeReadme, generateYearReadme, parseYearReadme, generateRootReadme } from '../utils/readme'
import { getTemplates as apiGetTemplates, getEpisodeTitles as apiGetEpisodeTitles, saveEpisodeTitles as apiSaveEpisodeTitles } from '../utils/api'

interface AnimeListItem {
  folder: string
  languages: string[]
  subtitleCount: number
}

interface StoredTemplate {
  titleEn?: string
  titleCn?: string
  year?: string
}

function getTemplateNames(templates: StoredTemplate[], year: string): Record<string, string> {
  const names: Record<string, string> = {}
  for (const t of templates) {
    if (t.year === year && t.titleEn && t.titleCn) {
      names[t.titleEn] = t.titleCn
    }
  }
  return names
}

const message = useMessage()
const loading = ref(false)
const detailLoading = ref(false)
const years = ref<string[]>([])
const animeByYear = ref<Record<string, AnimeListItem[]>>({})
const expandedAnime = ref('')
const animeDetail = ref<AnimeInfo | null>(null)
const checkedSubtitles = ref<string[]>([])
const confirmBatchDelete = ref(false)
const showEditModal = ref(false)
const editingSubtitle = ref<SubtitleFile | null>(null)
const checkedFonts = ref<string[]>([])
const confirmFontBatchRemove = ref(false)
const yearReadmeLoading = ref('')
const rootReadmeLoading = ref(false)
const animeReadmeLoading = ref('')
const showEpisodeTitleModal = ref(false)
const savingEpisodeTitles = ref(false)
const episodeTitleLoading = ref('')
const episodeTitleList = ref<Array<{ episode: number; title: string }>>([])

const subtitleColumns: DataTableColumns<SubtitleFile> = [
  {
    type: 'selection',
  },
  { title: '集数', key: 'episode', width: 70, render: (row) => `EP${String(row.episode).padStart(2, '0')}` },
  { title: '语言', key: 'lang', width: 80, render: (row) => row.lang === 'zh-hans' ? '简中' : row.lang === 'zh-hant' ? '繁中' : row.lang },
  { title: '文件名', key: 'name', ellipsis: { tooltip: true } },
  {
    title: '操作', key: 'actions', width: 120,
    render: (row) => h(NSpace, { size: 4 }, {
      default: () => [
        h(NButton, {
          size: 'tiny', type: 'info', text: true,
          onClick: () => openEditModal(row),
        }, { default: () => '编辑' }),
        h(NPopconfirm, {
          onPositiveClick: () => doDelete(row),
        }, {
          trigger: () => h(NButton, {
            size: 'tiny', type: 'error', text: true,
          }, { default: () => '删除' }),
          default: () => `确认删除 ${row.name}?`,
        }),
      ],
    }),
  },
]

const fontRefColumns: DataTableColumns<FontRef> = [
  {
    type: 'selection',
  },
  { title: '字体名', key: 'name' },
  {
    title: '操作', key: 'actions', width: 80,
    render: (row) => h(NPopconfirm, {
      onPositiveClick: () => doRemoveFont(row),
    }, {
      trigger: () => h(NButton, {
        size: 'tiny', type: 'error', text: true,
      }, { default: () => '移除' }),
      default: () => `确认移除 ${row.name}?`,
    }),
  },
]

function onCheckChange(keys: string[]) {
  checkedSubtitles.value = keys
  confirmBatchDelete.value = false
}

function onFontCheckChange(keys: string[]) {
  checkedFonts.value = keys
  confirmFontBatchRemove.value = false
}

async function doRemoveFont(font: FontRef) {
  if (!animeDetail.value) return
  animeDetail.value.fonts = animeDetail.value.fonts.filter(f => f.name !== font.name)
  await updateReadme()
  message.success(`已移除 ${font.name}`)
}

async function doFontBatchRemove() {
  if (!animeDetail.value) return
  animeDetail.value.fonts = animeDetail.value.fonts.filter(
    f => !checkedFonts.value.includes(f.name)
  )
  checkedFonts.value = []
  confirmFontBatchRemove.value = false
  await updateReadme()
  message.success('批量移除完成')
}

function openEditModal(sub: SubtitleFile) {
  editingSubtitle.value = sub
  showEditModal.value = true
}

async function handleEditUpload({ file }: UploadCustomRequestOptions) {
  const rawFile = file.file
  if (!rawFile || !editingSubtitle.value || !animeDetail.value) return

  try {
    const content = await rawFile.arrayBuffer()
    const base64 = arrayBufferToBase64(content)
    await uploadFiles(
      [{ path: editingSubtitle.value.path, content: base64, encoding: 'base64' }],
      `fix: 重新上传 ${editingSubtitle.value.name}`
    )
    message.success('字幕已替换')
    showEditModal.value = false
    if (expandedAnime.value) {
      const [y, f] = expandedAnime.value.split('/')
      await toggleAnimeDetail(y, f)
    }
  } catch (err: any) {
    message.error(`替换失败: ${err.message}`)
  }
}

async function doDelete(sub: SubtitleFile) {
  try {
    await deleteFile(sub.path, `chore: 删除 ${sub.name}`)
    message.success('已删除')
    if (animeDetail.value) {
      animeDetail.value.subtitles = animeDetail.value.subtitles.filter(s => s.path !== sub.path)
      await updateReadme()
    }
  } catch (err: any) {
    message.error(`删除失败: ${err.message}`)
  }
}

async function batchEdit() {
  if (checkedSubtitles.value.length === 0) return
  const first = animeDetail.value?.subtitles.find(s => s.path === checkedSubtitles.value[0])
  if (first) {
    editingSubtitle.value = first
    showEditModal.value = true
  }
}

async function doBatchDelete() {
  if (!animeDetail.value) return
  try {
    for (const path of checkedSubtitles.value) {
      const sub = animeDetail.value.subtitles.find(s => s.path === path)
      if (sub) {
        await deleteFile(sub.path, `chore: 删除 ${sub.name}`)
      }
    }
    animeDetail.value.subtitles = animeDetail.value.subtitles.filter(
      s => !checkedSubtitles.value.includes(s.path)
    )
    checkedSubtitles.value = []
    confirmBatchDelete.value = false
    await updateReadme()
    message.success('批量删除完成')
  } catch (err: any) {
    message.error(`批量删除失败: ${err.message}`)
  }
}

async function collectYearAnimeList(year: string): Promise<Array<{ titleEn: string; titleCn: string }>> {
  const yearContents = await getContents(`Anime subtitles/${year}`)
  if (!yearContents || !Array.isArray(yearContents)) return []
  const animeDirs = yearContents.filter((c: any) => c.type === 'dir')
  const templateNames = await apiGetTemplates().then(res => getTemplateNames(res.templates || [], year)).catch(() => ({} as Record<string, string>))
  const existingYearNames: Record<string, string> = {}
  const yearReadmeFile = yearContents.find((c: any) => c.type === 'file' && c.name === 'README.md')
  if (yearReadmeFile) {
    const res = await fetch(readmeUrl(`Anime subtitles/${year}/README.md`))
    if (res.ok) Object.assign(existingYearNames, parseYearReadme(await res.text()))
  }
  const animeList: Array<{ titleEn: string; titleCn: string }> = []
  for (const dir of animeDirs) {
    let titleCn = templateNames[dir.name] || existingYearNames[dir.name] || ''
    const readmeFile = await getContents(`Anime subtitles/${year}/${dir.name}/README.md`)
    if (readmeFile && readmeFile.name === 'README.md') {
      const rUrl = readmeUrl(`Anime subtitles/${year}/${dir.name}/README.md`)
      const res = await fetch(rUrl)
      if (res.ok) {
        const text = await res.text()
        const parsed = parseAnimeReadme(text)
        if (parsed.titleCn) titleCn = parsed.titleCn
      }
    }
    animeList.push({ titleEn: dir.name, titleCn })
  }
  return animeList
}

async function refreshRootReadme() {
  rootReadmeLoading.value = true
  try {
    const contents = await getContents('Anime subtitles')
    if (!contents || !Array.isArray(contents)) return
    const years = contents
      .filter((c: any) => c.type === 'dir')
      .map((c: any) => c.name)
      .sort((a: string, b: string) => a.localeCompare(b))
    const yearGroups = []
    for (const year of years) {
      yearGroups.push({ year, animeList: await collectYearAnimeList(year) })
    }
    const readmeContent = generateRootReadme(yearGroups)
    await uploadFiles(
      [{ path: 'Anime subtitles/README.md', content: btoa(unescape(encodeURIComponent(readmeContent))), encoding: 'base64' }],
      `docs: 更新 Anime subtitles README`
    )
    message.success('Anime subtitles README 已更新')
  } catch (err: any) {
    message.error(`更新失败: ${err.message}`)
  } finally {
    rootReadmeLoading.value = false
  }
}

async function updateYearReadme(year: string) {
  try {
    const animeList = await collectYearAnimeList(year)
    const readmeContent = generateYearReadme(year, animeList)
    await uploadFiles(
      [{ path: `Anime subtitles/${year}/README.md`, content: btoa(unescape(encodeURIComponent(readmeContent))), encoding: 'base64' }],
      `docs: 更新 ${year} 年 README`
    )
  } catch {
    // noop
  }
}

async function refreshYearReadme(year: string) {
  yearReadmeLoading.value = year
  try {
    await updateYearReadme(year)
    message.success(`${year} 年 README 已更新`)
  } catch (err: any) {
    message.error(`更新失败: ${err.message}`)
  } finally {
    yearReadmeLoading.value = ''
  }
}

async function updateReadme() {
  if (!animeDetail.value || !expandedAnime.value) return
  try {
    const readmePath = `Anime subtitles/${animeDetail.value.year}/${animeDetail.value.titleEn}/README.md`
    const readmeContent = generateAnimeReadme(animeDetail.value)
    await uploadFiles(
      [{ path: readmePath, content: btoa(unescape(encodeURIComponent(readmeContent))), encoding: 'base64' }],
      `docs: 更新 README`
    )
  } catch {
    // noop
  }
}

async function refreshAnimeReadme(year: string, folder: string) {
  const key = `${year}/${folder}`
  animeReadmeLoading.value = key
  try {
    const basePath = `Anime subtitles/${year}/${folder}`
    const contents = await getContents(basePath)
    if (!contents || !Array.isArray(contents)) return

    let titleCn = ''
    let coverUrl = ''
    let languages: string[] = []
    let readmeFonts: FontRef[] = []
    let subtitleType = 'bilingual'
    let episodeTitles: Record<number, string> = {}

    const readmeFile = contents.find((f: any) => f.name === 'README.md')
    if (readmeFile) {
      const rUrl = readmeUrl(`${basePath}/README.md`)
      const res = await fetch(rUrl)
      if (res.ok) {
        const text = await res.text()
        const parsed = parseAnimeReadme(text)
        titleCn = parsed.titleCn
        coverUrl = parsed.coverUrl
        languages = parsed.languages
        readmeFonts = parsed.fonts
        subtitleType = parsed.subtitleType || 'bilingual'
        episodeTitles = parsed.episodeTitles
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

    const animeInfo: AnimeInfo = {
      year,
      folder,
      titleEn: folder,
      titleCn,
      coverUrl,
      languages,
      subtitles,
      fonts: readmeFonts,
      subtitleType,
      episodeTitles,
    }

    const readmePath = `${basePath}/README.md`
    const readmeContent = generateAnimeReadme(animeInfo)
    await uploadFiles(
      [{ path: readmePath, content: btoa(unescape(encodeURIComponent(readmeContent))), encoding: 'base64' }],
      `docs: 更新 ${folder} README`
    )
    message.success(`${folder} README 已更新`)
  } catch (err: any) {
    message.error(`更新失败: ${err.message}`)
  } finally {
    animeReadmeLoading.value = ''
  }
}

async function openEpisodeTitleModal(year: string, folder: string) {
  const key = `${year}/${folder}`
  episodeTitleLoading.value = key
  try {
    if (!animeDetail.value || expandedAnime.value !== key) {
      await toggleAnimeDetail(year, folder)
    }
    if (!animeDetail.value) return
    const episodes = new Set(animeDetail.value.subtitles.map(s => s.episode))
    const readmeTitles = animeDetail.value.episodeTitles || {}
    let kvTitles: Record<string, string> = {}
    try {
      const result = await apiGetEpisodeTitles()
      kvTitles = result.episodeTitles[key] || {}
    } catch {
      // noop
    }
    const mergedTitles: Record<number, string> = {}
    for (const [epStr, title] of Object.entries(kvTitles)) {
      const epNum = parseInt(epStr, 10)
      if (!isNaN(epNum)) mergedTitles[epNum] = title
    }
    for (const [epStr, title] of Object.entries(readmeTitles)) {
      const epNum = parseInt(epStr, 10)
      if (!isNaN(epNum) && !mergedTitles[epNum]) mergedTitles[epNum] = title
    }
    episodeTitleList.value = Array.from(episodes).sort((a, b) => a - b).map(ep => ({
      episode: ep,
      title: mergedTitles[ep] || '',
    }))
    showEpisodeTitleModal.value = true
  } finally {
    episodeTitleLoading.value = ''
  }
}

async function saveEpisodeTitles() {
  if (!animeDetail.value) return
  savingEpisodeTitles.value = true
  try {
    const titles: Record<number, string> = {}
    for (const ep of episodeTitleList.value) {
      if (ep.title.trim()) titles[ep.episode] = ep.title.trim()
    }
    animeDetail.value.episodeTitles = titles
    await updateReadme()
    const key = `${animeDetail.value.year}/${animeDetail.value.folder}`
    let allTitles: Record<string, Record<string, string>> = {}
    try {
      const result = await apiGetEpisodeTitles()
      allTitles = result.episodeTitles
    } catch {
      // noop
    }
    const kvItem: Record<string, string> = {}
    for (const [epStr, title] of Object.entries(titles)) {
      kvItem[epStr] = title
    }
    allTitles[key] = kvItem
    await apiSaveEpisodeTitles(allTitles)
    showEpisodeTitleModal.value = false
    message.success('集数标题已保存')
  } catch (err: any) {
    message.error(`保存失败: ${err.message}`)
  } finally {
    savingEpisodeTitles.value = false
  }
}

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
  checkedSubtitles.value = []
  confirmBatchDelete.value = false
  checkedFonts.value = []
  confirmFontBatchRemove.value = false

  try {
    const basePath = `Anime subtitles/${year}/${folder}`
    const contents = await getContents(basePath)
    if (!contents || !Array.isArray(contents)) return

    let titleCn = ''
    let coverUrl = ''
    let languages: string[] = []
    let readmeFonts: FontRef[] = []
    let subtitleType = 'bilingual'
    let episodeTitles: Record<number, string> = {}

    const readmeFile = contents.find((f: any) => f.name === 'README.md')
    if (readmeFile) {
      const rUrl = readmeUrl(`${basePath}/README.md`)
        const res = await fetch(rUrl)
      if (res.ok) {
        const text = await res.text()
        const parsed = parseAnimeReadme(text)
        titleCn = parsed.titleCn
        coverUrl = parsed.coverUrl
        languages = parsed.languages
        readmeFonts = parsed.fonts
        subtitleType = parsed.subtitleType || 'bilingual'
        episodeTitles = parsed.episodeTitles
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
      subtitleType: subtitleType,
      episodeTitles,
    }
  } catch (err: any) {
    message.error(`加载详情失败: ${err.message}`)
  } finally {
    detailLoading.value = false
  }
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

onMounted(() => {
  if (getToken()) loadData()
})
</script>
