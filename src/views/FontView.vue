<template>
  <div>
    <n-card title="字体列表">
      <template #header-extra>
        <n-space size="small" align="center">
          <n-input
            v-model:value="searchKeyword"
            placeholder="搜索字体..."
            clearable
            size="small"
            style="width: 200px;"
          />
          <n-button size="small" :loading="loading" @click="loadFonts">刷新</n-button>
        </n-space>
      </template>

      <n-spin :show="loading">
        <n-empty v-if="!loading && fonts.length === 0" description="暂无字体数据" />

        <n-data-table
          v-if="fonts.length > 0"
          :columns="columns"
          :data="filteredFonts"
          :pagination="{ pageSize: 20 }"
          :row-key="(row: FontItem) => row.key"
          :checked-row-keys="checkedFonts"
          @update:checked-row-keys="onCheckChange"
        />

        <n-space v-if="checkedFonts.length > 0" justify="center" style="margin-top: 12px;">
          <n-text depth="3">已选 {{ checkedFonts.length }} 项</n-text>
          <n-button size="tiny" type="info" @click="batchLink">批量关联到动画</n-button>
          <n-button size="tiny" type="error" @click="confirmBatchDelete = true">批量删除</n-button>
        </n-space>
        <n-space v-if="confirmBatchDelete" justify="center" style="margin-top: 8px;">
          <n-text type="error" style="font-size: 12px;">确认删除 {{ checkedFonts.length }} 个字体?</n-text>
          <n-button size="tiny" type="error" @click="doBatchDelete">确认</n-button>
          <n-button size="tiny" @click="confirmBatchDelete = false">取消</n-button>
        </n-space>
      </n-spin>
    </n-card>

    <n-modal v-model:show="showLinkModal" preset="dialog" title="关联字体到动画">
      <n-form label-placement="left" label-width="auto">
        <n-form-item label="选择年份">
          <n-select
            v-model:value="linkForm.year"
            :options="yearOptions"
            placeholder="选择年份"
            @update:value="onYearChange"
          />
        </n-form-item>
        <n-form-item label="选择动画">
          <n-select
            v-model:value="linkForm.anime"
            :options="animeOptions"
            placeholder="选择动画"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showLinkModal = false">取消</n-button>
        <n-button type="primary" :loading="linking" @click="linkFontToAnime">确认关联</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { NButton, NSpace, NPopconfirm, useMessage } from 'naive-ui'
import type { DataTableColumns, SelectOption } from 'naive-ui'
import { getContents, readmeUrl, getToken, uploadFiles, deleteFile, downloadUrl } from '../utils/github'
import { deleteFontFromR2, listR2Fonts, getR2Domain } from '../utils/api'
import { formatFileSize } from '../utils/rename'
import { parseAnimeReadme, generateAnimeReadme } from '../utils/readme'

interface FontItem {
  name: string
  key: string
  size: number
  downloadUrl: string
}

const message = useMessage()
const loading = ref(false)
const linking = ref(false)
const fonts = ref<FontItem[]>([])
const searchKeyword = ref('')
const showLinkModal = ref(false)
const selectedFont = ref<FontItem | null>(null)
const checkedFonts = ref<string[]>([])
const confirmBatchDelete = ref(false)

const linkForm = ref({
  year: null as string | null,
  anime: null as string | null,
})

const yearOptions = ref<SelectOption[]>([])
const animeOptions = ref<SelectOption[]>([])

const filteredFonts = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return fonts.value
  return fonts.value.filter(f => f.name.toLowerCase().includes(kw))
})

const columns: DataTableColumns<FontItem> = [
  { type: 'selection' },
  { title: '字体文件名', key: 'name', ellipsis: { tooltip: true } },
  { title: '大小', key: 'size', width: 120, render: (row) => formatFileSize(row.size) },
  {
    title: '操作', key: 'actions', width: 160,
    render: (row) => h(NSpace, { size: 4 }, {
      default: () => [
        h(NButton, {
          size: 'tiny', type: 'info', text: true,
          onClick: () => openLinkModal(row),
        }, { default: () => '关联到动画' }),
        h(NPopconfirm, {
          onPositiveClick: () => doDeleteFont(row),
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

function onCheckChange(keys: string[]) {
  checkedFonts.value = keys
  confirmBatchDelete.value = false
}

async function loadFonts() {
  loading.value = true
  try {
    const result = await listR2Fonts()
    fonts.value = result.files

    const ghContents = await getContents('Fonts')
    if (ghContents && Array.isArray(ghContents)) {
      for (const item of ghContents) {
        if (item.type !== 'file') continue
        const exists = fonts.value.some(f => f.name === item.name)
        if (!exists) {
          fonts.value.push({
            name: item.name,
            key: `Fonts/${item.name}`,
            size: item.size,
            downloadUrl: downloadUrl(`Fonts/${item.name}`),
          })
        }
      }
    }

    await loadYears()
  } catch (err: any) {
    message.error(`加载字体列表失败: ${err.message}`)
  } finally {
    loading.value = false
  }
}

async function loadYears() {
  try {
    const contents = await getContents('Anime subtitles')
    if (!contents || !Array.isArray(contents)) return
    yearOptions.value = contents
      .filter((c: any) => c.type === 'dir')
      .map((c: any) => ({ label: c.name, value: c.name }))
      .sort((a: SelectOption, b: SelectOption) => String(b.value).localeCompare(String(a.value)))
  } catch {
    // noop
  }
}

async function onYearChange(year: string) {
  animeOptions.value = []
  linkForm.value.anime = null
  try {
    const contents = await getContents(`Anime subtitles/${year}`)
    if (!contents || !Array.isArray(contents)) return
    animeOptions.value = contents
      .filter((c: any) => c.type === 'dir')
      .map((c: any) => ({ label: c.name, value: c.name }))
  } catch {
    // noop
  }
}

function openLinkModal(font: FontItem) {
  selectedFont.value = font
  linkForm.value = { year: null, anime: null }
  showLinkModal.value = true
}

function batchLink() {
  if (checkedFonts.value.length === 0) return
  const first = fonts.value.find(f => f.key === checkedFonts.value[0])
  if (first) {
    selectedFont.value = first
    linkForm.value = { year: null, anime: null }
    showLinkModal.value = true
  }
}

async function doDeleteFont(font: FontItem) {
  try {
    if (font.key.startsWith('fonts/')) {
      await deleteFontFromR2(font.key)
    } else {
      await deleteFile(font.key, `chore: 删除字体 ${font.name}`)
    }
    fonts.value = fonts.value.filter(f => f.key !== font.key)
    message.success(`已删除 ${font.name}`)
  } catch (err: any) {
    message.error(`删除失败: ${err.message}`)
  }
}

async function doBatchDelete() {
  try {
    for (const key of checkedFonts.value) {
      const font = fonts.value.find(f => f.key === key)
      if (font) {
        if (font.key.startsWith('fonts/')) {
          await deleteFontFromR2(font.key)
        } else {
          await deleteFile(font.key, `chore: 删除字体 ${font.name}`)
        }
      }
    }
    fonts.value = fonts.value.filter(f => !checkedFonts.value.includes(f.key))
    checkedFonts.value = []
    confirmBatchDelete.value = false
    message.success('批量删除完成')
  } catch (err: any) {
    message.error(`批量删除失败: ${err.message}`)
  }
}

async function linkFontToAnime() {
  if (!linkForm.value.year || !linkForm.value.anime || !selectedFont.value) {
    message.warning('请选择年份和动画')
    return
  }

  linking.value = true
  try {
    const basePath = `Anime subtitles/${linkForm.value.year}/${linkForm.value.anime}`
    const readmePath = `${basePath}/README.md`

    let readmeContent = ''
    const rUrl = readmeUrl(`${basePath}/README.md`)
    try {
      const res = await fetch(rUrl)
      if (res.ok) readmeContent = await res.text()
    } catch {
      // noop
    }

    const parsed = parseAnimeReadme(readmeContent)

    const fontName = selectedFont.value.name
    let fontDl = selectedFont.value.downloadUrl

    if (selectedFont.value.key.startsWith('fonts/') && !fontDl) {
      try {
        const { domain } = await getR2Domain()
        if (domain) {
          fontDl = `${domain.replace(/\/$/, '')}/fonts/${encodeURIComponent(fontName)}`
        }
      } catch {
        // noop
      }
    }

    if (selectedFont.value.key.startsWith('fonts/') && !fontDl) {
      message.warning('请先在设置中配置 R2 下载域名')
      linking.value = false
      return
    }

    const alreadyExists = parsed.fonts.some((f) => f.name === fontName)
    if (alreadyExists) {
      message.info('该字体已关联到此动画')
      showLinkModal.value = false
      return
    }

    parsed.fonts.push({
      name: fontName,
      path: selectedFont.value.key.startsWith('fonts/') ? selectedFont.value.key : `Fonts/${fontName}`,
      downloadUrl: fontDl,
    })

    const contents = await getContents(basePath)
    const assFiles = (contents || []).filter((f: any) => f.name.endsWith('.ass'))
    const subtitles = assFiles.map((f: any) => {
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

    const animeInfo = {
      year: linkForm.value.year,
      folder: linkForm.value.anime,
      titleEn: linkForm.value.anime,
      titleCn: parsed.titleCn,
      coverUrl: parsed.coverUrl,
      languages: parsed.languages,
      subtitles,
      fonts: parsed.fonts,
      subtitleType: parsed.subtitleType || 'bilingual',
    }

    const newReadme = generateAnimeReadme(animeInfo)
    await uploadFiles(
      [{ path: readmePath, content: btoa(unescape(encodeURIComponent(newReadme))), encoding: 'base64' }],
      `feat: 关联字体 ${fontName} 到 ${linkForm.value.anime}`
    )

    message.success(`已将 ${fontName} 关联到 ${linkForm.value.anime}`)
    showLinkModal.value = false
  } catch (err: any) {
    message.error(`关联失败: ${err.message}`)
  } finally {
    linking.value = false
  }
}

onMounted(() => {
  if (getToken()) loadFonts()
})
</script>
