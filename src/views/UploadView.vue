<template>
  <div>
    <n-card title="字幕上传">
      <n-tabs v-model:value="uploadTab" type="segment" style="margin-bottom: 16px;">
        <n-tab-pane name="subtitle" tab="字幕文件" />
        <n-tab-pane name="font" tab="字体文件" />
      </n-tabs>

      <template v-if="uploadTab === 'subtitle'">
        <n-space vertical size="large">
          <n-space align="center" :wrap="false" style="width: 100%;">
            <n-select
              v-model:value="selectedYear"
              :options="yearOptions"
              placeholder="选择年份"
              style="width: 140px;"
              :loading="yearLoading"
              filterable
              tag
              @update:value="onYearSelect"
            />
            <n-select
              v-model:value="selectedAnime"
              :options="animeOptions"
              placeholder="选择动画"
              style="flex: 1; min-width: 200px;"
              :loading="animeLoading"
              :disabled="!selectedYear"
              filterable
              tag
              @update:value="onAnimeSelect"
            />
            <n-button size="small" @click="showTemplateModal = true">模板</n-button>
          </n-space>

          <n-space v-if="currentAnimeLabel" align="center" size="small">
            <n-text>当前:</n-text>
            <n-tag type="info" size="small">{{ currentAnimeLabel }}</n-tag>
            <n-tag v-for="lang in detectedLanguages" :key="lang" size="small">
              {{ lang === 'zh-hans' ? (template.subtitleType === 'bilingual' ? '简日双语' : '简中') : lang === 'zh-hant' ? (template.subtitleType === 'bilingual' ? '繁日雙語' : '繁中') : lang }}
            </n-tag>
          </n-space>

          <div
            class="drop-zone"
            :class="{ 'drop-zone--active': isDragging }"
            @click="triggerSubtitleFileInput"
            @dragover.prevent="onDragOver"
            @dragleave="onDragLeave"
            @drop.prevent="onSubtitleDrop"
          >
            <input
              ref="subtitleFileInput"
              type="file"
              multiple
              accept=".ass"
              style="display: none;"
              @change="onSubtitleFileInputChange"
            />
            <div style="padding: 32px 0; text-align: center;">
              <n-text style="font-size: 16px; display: block; margin-bottom: 8px;">
                点击、拖拽或粘贴 ASS 字幕文件到此处上传
              </n-text>
              <n-text depth="3">
                文件名格式: 01.zh-hans.ass / 01.zh-hant.ass，语言将自动识别
              </n-text>
            </div>
          </div>

          <n-data-table
            v-if="subtitleQueue.length > 0"
            :columns="subtitleColumns"
            :data="subtitleQueue"
            :row-key="(row: QueueItem) => row.id"
          />

          <n-space v-if="subtitleQueue.length > 0">
            <n-button
              type="primary"
              :loading="uploading"
              :disabled="uploading || !canUploadSubtitles"
              @click="commitSubtitles"
            >
              提交上传 ({{ subtitleQueue.length }} 个文件)
            </n-button>
            <n-button :disabled="uploading" @click="subtitleQueue = []">清空队列</n-button>
          </n-space>
        </n-space>
      </template>

      <template v-if="uploadTab === 'font'">
        <div
          class="drop-zone"
          :class="{ 'drop-zone--active': isFontDragging }"
          @click="triggerFontFileInput"
          @dragover.prevent="onFontDragOver"
          @dragleave="onFontDragLeave"
          @drop.prevent="onFontDrop"
        >
          <input
            ref="fontFileInput"
            type="file"
            multiple
            accept=".ttf,.otf,.ttc,.woff,.woff2"
            style="display: none;"
            @change="onFontFileInputChange"
          />
          <div style="padding: 32px 0; text-align: center;">
            <n-text style="font-size: 16px; display: block; margin-bottom: 8px;">
              点击、拖拽或粘贴字体文件到此处上传
            </n-text>
            <n-text depth="3">
              支持 TTF/OTF/TTC/WOFF/WOFF2 格式，大于 25MB 的文件将自动分片上传
            </n-text>
          </div>
        </div>

        <n-data-table
          v-if="fontQueue.length > 0"
          :columns="fontColumns"
          :data="fontQueue"
          :row-key="(row: QueueItem) => row.id"
          style="margin-top: 16px;"
        />

        <n-space style="margin-top: 16px;" v-if="fontQueue.length > 0">
          <n-button type="primary" :loading="uploading" :disabled="uploading" @click="commitFonts">
            提交上传 ({{ fontQueue.length }} 个字体)
          </n-button>
          <n-button :disabled="uploading" @click="fontQueue = []">清空队列</n-button>
        </n-space>
      </template>
    </n-card>

    <n-modal v-model:show="showTemplateModal" preset="card" title="模板管理" style="width: 600px;">
      <n-tabs type="line" style="margin-bottom: 16px;">
        <n-tab-pane name="edit" tab="编辑当前模板">
          <n-form label-placement="left" label-width="100">
            <n-form-item label="模板名称">
              <n-input v-model:value="template.name" placeholder="给模板起个名字，方便保存和识别" />
            </n-form-item>
            <n-form-item label="组名标签">
              <n-input v-model:value="template.groupTag" placeholder="smzase" />
            </n-form-item>
            <n-form-item label="英文/罗马音标题">
              <n-input v-model:value="template.titleEn" placeholder="Ichijyoma Mankitsu Gurashi!" />
            </n-form-item>
            <n-form-item label="中文名">
              <n-input v-model:value="template.titleCn" placeholder="短时间享乐生活!" />
            </n-form-item>
            <n-grid :cols="2" :x-gap="12">
              <n-grid-item>
                <n-form-item label="年份">
                  <n-input v-model:value="template.year" placeholder="2026" />
                </n-form-item>
              </n-grid-item>
              <n-grid-item>
                <n-form-item label="季度">
                  <n-input-number v-model:value="template.season" :min="1" style="width: 100%;" />
                </n-form-item>
              </n-grid-item>
            </n-grid>
            <n-form-item label="封面图链接">
              <n-input v-model:value="template.coverUrl" placeholder="https://..." />
            </n-form-item>
            <n-form-item label="字幕类型">
              <n-radio-group v-model:value="template.subtitleType">
                <n-radio value="bilingual">中日双语</n-radio>
                <n-radio value="monolingual">单语</n-radio>
              </n-radio-group>
            </n-form-item>
            <n-form-item label="字幕语言">
              <n-text depth="3">上传文件时自动从文件名识别 (.zh-hans. / .zh-hant.)</n-text>
            </n-form-item>
          </n-form>
          <n-text depth="3" style="font-size: 12px; display: block; margin-top: 4px;">
            命名预览: [{{ template.groupTag }}] {{ template.titleEn }} - S{{ String(template.season).padStart(2, '0') }}E01.zh-hans.ass
          </n-text>
          <n-button type="primary" block style="margin-top: 12px;" @click="applyTemplateAndSave">应用并保存</n-button>
        </n-tab-pane>

        <n-tab-pane name="saved" tab="已保存模板">
          <n-list bordered v-if="savedTemplates.length > 0">
            <n-list-item v-for="(t, idx) in savedTemplates" :key="idx">
              <n-thing>
                <template #header>{{ t.name || t.titleEn }}</template>
                <template #description>
                  <n-text depth="3" style="font-size: 12px;">
                    [{{ t.groupTag }}] {{ t.titleEn }} / {{ t.titleCn }} - {{ t.year }} S{{ String(t.season).padStart(2, '0') }} | {{ t.subtitleType === 'bilingual' ? '中日双语' : '单语' }}
                  </n-text>
                </template>
              </n-thing>
              <template #suffix>
                <n-space size="small">
                  <n-button size="tiny" type="primary" @click="loadTemplate(t)">加载</n-button>
                  <n-button size="tiny" type="error" @click="deleteTemplate(idx)">删除</n-button>
                </n-space>
              </template>
            </n-list-item>
          </n-list>
          <n-empty v-if="savedTemplates.length === 0" description="暂无保存的模板" />
        </n-tab-pane>
      </n-tabs>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted, watch } from 'vue'
import { NTag, NButton, NSpace, useMessage } from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import type { UploadTemplate, SubtitleFile } from '../types'
import { parseOriginalName, buildSubtitleName, buildSubtitlePath, buildFontPath, formatFileSize } from '../utils/rename'
import { uploadFiles, uploadLargeFile, getToken, getContents, rawUrl, downloadUrl } from '../utils/github'
import { generateAnimeReadme, generateYearReadme, parseAnimeReadme, mergeSubtitles } from '../utils/readme'

interface QueueItem {
  id: string
  originalName: string
  newName: string
  path: string
  size: number
  content: ArrayBuffer
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

const TEMPLATE_STORAGE_KEY = 'smzase_saved_templates'
const CURRENT_TEMPLATE_KEY = 'smzase_current_template'

const message = useMessage()
const uploadTab = ref('subtitle')
const uploading = ref(false)
const isDragging = ref(false)
const isFontDragging = ref(false)
const subtitleFileInput = ref<HTMLInputElement | null>(null)
const fontFileInput = ref<HTMLInputElement | null>(null)

const showTemplateModal = ref(false)
const yearLoading = ref(false)
const animeLoading = ref(false)
const selectedYear = ref<string | null>(null)
const selectedAnime = ref<string | null>(null)
const yearOptions = ref<SelectOption[]>([])
const animeOptions = ref<SelectOption[]>([])

const savedTemplates = ref<UploadTemplate[]>([])

const detectedLanguages = ref<string[]>([])

const template = ref<UploadTemplate>({
  name: '',
  groupTag: 'smzase',
  titleEn: '',
  titleCn: '',
  season: 1,
  year: new Date().getFullYear().toString(),
  coverUrl: '',
  languages: [],
  subtitleType: 'bilingual',
})

const subtitleQueue = ref<QueueItem[]>([])
const fontQueue = ref<QueueItem[]>([])

const currentAnimeLabel = computed(() => {
  if (template.value.titleEn) {
    let label = template.value.titleEn
    if (template.value.titleCn) label += ` / ${template.value.titleCn}`
    return label
  }
  return ''
})

const canUploadSubtitles = computed(() => {
  return template.value.titleEn && template.value.year && getToken()
})

const subtitleColumns: DataTableColumns<QueueItem> = [
  { title: '原始文件名', key: 'originalName', width: 200 },
  { title: '重命名后', key: 'newName', ellipsis: { tooltip: true } },
  { title: '大小', key: 'size', width: 100, render: (row) => formatFileSize(row.size) },
  {
    title: '状态', key: 'status', width: 100,
    render: (row) => {
      const typeMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
        pending: 'default', uploading: 'info', done: 'success', error: 'error',
      }
      const labelMap: Record<string, string> = {
        pending: '等待', uploading: '上传中', done: '完成', error: '失败',
      }
      return h(NTag, { type: typeMap[row.status], size: 'small' }, { default: () => labelMap[row.status] })
    },
  },
  {
    title: '操作', key: 'actions', width: 60,
    render: (_row, index) => h(NButton, {
      size: 'tiny', type: 'error', text: true,
      onClick: () => { subtitleQueue.value.splice(index, 1) },
    }, { default: () => '移除' }),
  },
]

const fontColumns: DataTableColumns<QueueItem> = [
  { title: '文件名', key: 'originalName', ellipsis: { tooltip: true } },
  { title: '大小', key: 'size', width: 120, render: (row) => formatFileSize(row.size) },
  {
    title: '分片', key: 'split', width: 80,
    render: (row) => row.size > 25 * 1024 * 1024 ? h(NTag, { type: 'warning', size: 'small' }, { default: () => '是' }) : '-',
  },
  {
    title: '状态', key: 'status', width: 100,
    render: (row) => {
      const typeMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
        pending: 'default', uploading: 'info', done: 'success', error: 'error',
      }
      const labelMap: Record<string, string> = {
        pending: '等待', uploading: '上传中', done: '完成', error: '失败',
      }
      return h(NTag, { type: typeMap[row.status], size: 'small' }, { default: () => labelMap[row.status] })
    },
  },
  {
    title: '操作', key: 'actions', width: 60,
    render: (_row, index) => h(NButton, {
      size: 'tiny', type: 'error', text: true,
      onClick: () => { fontQueue.value.splice(index, 1) },
    }, { default: () => '移除' }),
  },
]

function detectLanguagesFromQueue() {
  const langs = new Set<string>()
  for (const item of subtitleQueue.value) {
    const parsed = parseOriginalName(item.originalName)
    if (parsed) langs.add(parsed.lang)
  }
  detectedLanguages.value = Array.from(langs)
  template.value.languages = detectedLanguages.value
}

function loadSavedTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY)
    if (raw) savedTemplates.value = JSON.parse(raw)
  } catch {
    savedTemplates.value = []
  }
  try {
    const raw = localStorage.getItem(CURRENT_TEMPLATE_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      template.value = { ...template.value, ...saved }
    }
  } catch {
    // noop
  }
}

function persistCurrentTemplate() {
  localStorage.setItem(CURRENT_TEMPLATE_KEY, JSON.stringify(template.value))
}

function persistTemplates() {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(savedTemplates.value))
}

function saveTemplate() {
  if (!template.value.name && !template.value.titleEn) {
    message.warning('请先填写模板名称或英文标题')
    return
  }
  const name = template.value.name || template.value.titleEn
  const idx = savedTemplates.value.findIndex(t => (t.name || t.titleEn) === name)
  const copy = { ...template.value, name }
  if (idx >= 0) {
    savedTemplates.value[idx] = copy
  } else {
    savedTemplates.value.push(copy)
  }
  persistTemplates()
  message.success(`模板 "${name}" 已保存`)
}

function applyTemplateAndSave() {
  if (template.value.year) {
    selectedYear.value = template.value.year
    const exists = yearOptions.value.some(o => o.value === template.value.year)
    if (!exists) {
      yearOptions.value.push({ label: template.value.year, value: template.value.year })
    }
  }
  if (template.value.titleEn) {
    selectedAnime.value = template.value.titleEn
    const exists = animeOptions.value.some(o => o.value === template.value.titleEn)
    if (!exists) {
      animeOptions.value.push({ label: template.value.titleEn, value: template.value.titleEn })
    }
  }
  saveTemplate()
  showTemplateModal.value = false
}

function loadTemplate(t: UploadTemplate) {
  template.value = { ...t }
  if (t.year) {
    selectedYear.value = t.year
    const exists = yearOptions.value.some(o => o.value === t.year)
    if (!exists) yearOptions.value.push({ label: t.year, value: t.year })
  }
  if (t.titleEn) {
    selectedAnime.value = t.titleEn
    const exists = animeOptions.value.some(o => o.value === t.titleEn)
    if (!exists) animeOptions.value.push({ label: t.titleEn, value: t.titleEn })
  }
  showTemplateModal.value = false
  message.success(`已加载模板 "${t.name || t.titleEn}"`)
}

function deleteTemplate(idx: number) {
  const name = savedTemplates.value[idx]?.name || savedTemplates.value[idx]?.titleEn
  savedTemplates.value.splice(idx, 1)
  persistTemplates()
  message.success(`模板 "${name}" 已删除`)
}

async function loadYears() {
  if (!getToken()) return
  yearLoading.value = true
  try {
    const contents = await getContents('Anime subtitles')
    if (!contents || !Array.isArray(contents)) return
    const dirs = contents
      .filter((c: any) => c.type === 'dir')
      .map((c: any) => ({ label: c.name, value: c.name }))
      .sort((a: SelectOption, b: SelectOption) => String(b.value).localeCompare(String(a.value)))
    yearOptions.value = dirs
  } catch {
    // noop
  } finally {
    yearLoading.value = false
  }
}

async function onYearSelect(year: string) {
  template.value.year = year
  selectedAnime.value = null
  animeOptions.value = []
  animeLoading.value = true
  try {
    const contents = await getContents(`Anime subtitles/${year}`)
    if (!contents || !Array.isArray(contents)) return
    animeOptions.value = contents
      .filter((c: any) => c.type === 'dir')
      .map((c: any) => ({ label: c.name, value: c.name }))
  } catch {
    // noop
  } finally {
    animeLoading.value = false
  }
}

async function onAnimeSelect(animeName: string) {
  if (!animeName) return
  const isExisting = animeOptions.value.some(o => o.value === animeName)
  if (isExisting && selectedYear.value) {
    animeLoading.value = true
    try {
      const basePath = `Anime subtitles/${selectedYear.value}/${animeName}`
      const readmeUrl = rawUrl(`${basePath}/README.md`)
      const res = await fetch(readmeUrl)
      if (res.ok) {
        const text = await res.text()
        const parsed = parseAnimeReadme(text)
        template.value = {
          ...template.value,
          name: animeName,
          titleEn: animeName,
          titleCn: parsed.titleCn,
          year: selectedYear.value,
          coverUrl: parsed.coverUrl,
          languages: parsed.languages,
          subtitleType: parsed.subtitleType || 'bilingual',
        }
        detectedLanguages.value = parsed.languages
      } else {
        template.value = {
          ...template.value,
          name: animeName,
          titleEn: animeName,
          year: selectedYear.value,
        }
      }
    } catch {
      template.value = {
        ...template.value,
        name: animeName,
        titleEn: animeName,
        year: selectedYear.value,
      }
    } finally {
      animeLoading.value = false
    }
  } else {
    template.value = {
      ...template.value,
      name: animeName,
      titleEn: animeName,
      year: selectedYear.value || template.value.year,
    }
  }
}

function triggerSubtitleFileInput() {
  subtitleFileInput.value?.click()
}

function triggerFontFileInput() {
  fontFileInput.value?.click()
}

function onSubtitleFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    processSubtitleFiles(Array.from(input.files))
    input.value = ''
  }
}

function onFontFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    processFontFiles(Array.from(input.files))
    input.value = ''
  }
}

function onDragOver() { isDragging.value = true }
function onDragLeave() { isDragging.value = false }
function onFontDragOver() { isFontDragging.value = true }
function onFontDragLeave() { isFontDragging.value = false }

function onSubtitleDrop(e: DragEvent) {
  isDragging.value = false
  if (!e.dataTransfer?.files) return
  processSubtitleFiles(Array.from(e.dataTransfer.files))
}

function onFontDrop(e: DragEvent) {
  isFontDragging.value = false
  if (!e.dataTransfer?.files) return
  processFontFiles(Array.from(e.dataTransfer.files))
}

function onPaste(e: ClipboardEvent) {
  if (!e.clipboardData?.files) return
  const files = Array.from(e.clipboardData.files)
  if (files.length === 0) return

  if (uploadTab.value === 'subtitle') {
    processSubtitleFiles(files)
  } else {
    processFontFiles(files)
  }
}

function processSubtitleFiles(files: File[]) {
  if (!template.value.titleEn) {
    message.warning('请先选择或输入动画标题')
    return
  }
  if (!template.value.year) {
    message.warning('请先选择或输入年份')
    return
  }

  for (const file of files) {
    if (!file.name.endsWith('.ass')) {
      message.error(`不支持的文件格式: ${file.name}`)
      continue
    }
    const parsed = parseOriginalName(file.name)
    if (!parsed) {
      message.error(`文件名格式不正确: ${file.name}，期望格式: 01.zh-hans.ass`)
      continue
    }
    const newName = buildSubtitleName(template.value, parsed.episode, parsed.lang)
    const path = buildSubtitlePath(template.value, newName)
    file.arrayBuffer().then((content) => {
      subtitleQueue.value.push({
        id: `${Date.now()}-${Math.random()}`,
        originalName: file.name,
        newName,
        path,
        size: file.size,
        content,
        status: 'pending',
      })
      detectLanguagesFromQueue()
    })
  }
}

function processFontFiles(files: File[]) {
  const validExts = ['.ttf', '.otf', '.ttc', '.woff', '.woff2']
  for (const file of files) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!validExts.includes(ext)) {
      message.error(`不支持的字体格式: ${file.name}`)
      continue
    }
    const path = buildFontPath(file.name)
    file.arrayBuffer().then((content) => {
      fontQueue.value.push({
        id: `${Date.now()}-${Math.random()}`,
        originalName: file.name,
        newName: file.name,
        path,
        size: file.size,
        content,
        status: 'pending',
      })
    })
  }
}

async function fetchExistingSubtitles(): Promise<SubtitleFile[]> {
  if (!selectedYear.value || !template.value.titleEn) return []
  const basePath = `Anime subtitles/${selectedYear.value}/${template.value.titleEn}`
  try {
    const contents = await getContents(basePath)
    if (!contents || !Array.isArray(contents)) return []
    return contents
      .filter((f: any) => f.name.endsWith('.ass'))
      .map((f: any) => {
        const epMatch = f.name.match(/E(\d+)/)
        const langMatch = f.name.match(/\.(zh-hans|zh-hant)\./)
        return {
          name: f.name,
          path: `${basePath}/${f.name}`,
          episode: epMatch ? parseInt(epMatch[1], 10) : 0,
          season: template.value.season,
          lang: langMatch ? langMatch[1] : '',
          downloadUrl: downloadUrl(`${basePath}/${f.name}`),
        }
      })
  } catch {
    return []
  }
}

async function fetchExistingReadmeInfo(): Promise<{ fonts: any[]; coverUrl: string; titleCn: string }> {
  if (!selectedYear.value || !template.value.titleEn) return { fonts: [], coverUrl: '', titleCn: '' }
  const basePath = `Anime subtitles/${selectedYear.value}/${template.value.titleEn}`
  try {
    const readmeUrl = rawUrl(`${basePath}/README.md`)
    const res = await fetch(readmeUrl)
    if (!res.ok) return { fonts: [], coverUrl: '', titleCn: '' }
    const text = await res.text()
    const parsed = parseAnimeReadme(text)
    return {
      fonts: parsed.fonts,
      coverUrl: parsed.coverUrl,
      titleCn: parsed.titleCn,
    }
  } catch {
    return { fonts: [], coverUrl: '', titleCn: '' }
  }
}

async function commitSubtitles() {
  if (!getToken()) {
    message.error('请先设置 GitHub Token')
    return
  }
  uploading.value = true
  try {
    const files: Array<{ path: string; content: string; encoding: 'utf-8' | 'base64' }> = []

    for (const item of subtitleQueue.value) {
      item.status = 'uploading'
      const base64 = arrayBufferToBase64(item.content)
      files.push({ path: item.path, content: base64, encoding: 'base64' })
    }

    const newEpisodes: SubtitleFile[] = subtitleQueue.value.map((item) => {
      const parsed = parseOriginalName(item.originalName)!
      return {
        name: item.newName,
        path: item.path,
        episode: parsed.episode,
        season: template.value.season,
        lang: parsed.lang,
        downloadUrl: downloadUrl(item.path),
      }
    })

    const existingSubs = await fetchExistingSubtitles()
    const allSubs = mergeSubtitles(existingSubs, newEpisodes)

    const existingInfo = await fetchExistingReadmeInfo()
    const coverUrl = template.value.coverUrl || existingInfo.coverUrl
    const titleCn = template.value.titleCn || existingInfo.titleCn
    const fonts = existingInfo.fonts

    const allLanguages = new Set<string>()
    for (const sub of allSubs) {
      if (sub.lang) allLanguages.add(sub.lang)
    }

    const animeInfo = {
      year: template.value.year,
      folder: template.value.titleEn,
      titleEn: template.value.titleEn,
      titleCn,
      coverUrl,
      languages: Array.from(allLanguages),
      subtitles: allSubs,
      fonts,
      subtitleType: template.value.subtitleType,
    }

    const readmePath = `Anime subtitles/${template.value.year}/${template.value.titleEn}/README.md`
    const readmeContent = generateAnimeReadme(animeInfo)
    files.push({ path: readmePath, content: btoa(unescape(encodeURIComponent(readmeContent))), encoding: 'base64' })

    const yearReadmePath = `Anime subtitles/${template.value.year}/README.md`
    const yearReadme = generateYearReadme(template.value.year, [
      { titleEn: template.value.titleEn, titleCn },
    ])
    files.push({ path: yearReadmePath, content: btoa(unescape(encodeURIComponent(yearReadme))), encoding: 'base64' })

    const epList = [...new Set(newEpisodes.map(e => e.episode))].sort((a, b) => a - b)
    const langLabels = detectedLanguages.value.map(l =>
      l === 'zh-hans' ? (template.value.subtitleType === 'bilingual' ? '简日双语' : '简中') :
      l === 'zh-hant' ? (template.value.subtitleType === 'bilingual' ? '繁日雙語' : '繁中') : l
    ).join(' ')
    const epStr = epList.map(e => `EP${String(e).padStart(2, '0')}`).join(', ')
    const commitTitleCn = titleCn || template.value.titleEn
    await uploadFiles(files, `[${commitTitleCn}] ${epStr} ${langLabels}`)

    for (const item of subtitleQueue.value) {
      item.status = 'done'
    }
    message.success('字幕上传成功')
    subtitleQueue.value = []
    detectedLanguages.value = []
  } catch (err: any) {
    for (const item of subtitleQueue.value) {
      if (item.status === 'uploading') {
        item.status = 'error'
        item.error = err.message
      }
    }
    message.error(`上传失败: ${err.message}`)
  } finally {
    uploading.value = false
  }
}

async function commitFonts() {
  if (!getToken()) {
    message.error('请先设置 GitHub Token')
    return
  }
  uploading.value = true
  try {
    for (const item of fontQueue.value) {
      item.status = 'uploading'
      try {
        if (item.size > 25 * 1024 * 1024) {
          await uploadLargeFile(item.path, item.content, `feat: add font ${item.originalName}`)
        } else {
          const base64 = arrayBufferToBase64(item.content)
          await uploadFiles(
            [{ path: item.path, content: base64, encoding: 'base64' }],
            `feat: add font ${item.originalName}`
          )
        }
        item.status = 'done'
      } catch (err: any) {
        item.status = 'error'
        item.error = err.message
      }
    }
    message.success('字体上传完成')
    fontQueue.value = []
  } finally {
    uploading.value = false
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
  document.addEventListener('paste', onPaste)
  loadSavedTemplates()
  if (getToken()) loadYears()
})

watch(template, () => {
  persistCurrentTemplate()
}, { deep: true })

onUnmounted(() => {
  document.removeEventListener('paste', onPaste)
})
</script>

<style scoped>
.drop-zone {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.drop-zone:hover {
  border-color: #18a058;
  background-color: rgba(24, 160, 88, 0.04);
}

.drop-zone--active {
  border-color: #18a058;
  background-color: rgba(24, 160, 88, 0.08);
}
</style>
