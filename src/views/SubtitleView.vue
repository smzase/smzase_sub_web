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
                      <n-button size="tiny" :loading="sortLoading === `${year}/${anime.folder}`" @click.stop="refreshAnimeSort(year, anime.folder)">刷新排序</n-button>
                      <n-button size="tiny" @click.stop="openTemplateLinkModal(year, anime.folder)">关联模板</n-button>
                      <n-tooltip trigger="hover">
                        <template #trigger>
                          <n-button size="tiny" :loading="episodeTitleLoading === `${year}/${anime.folder}`" @click.stop="openEpisodeTitleModal(year, anime.folder)">编辑内容</n-button>
                        </template>
                        可编辑简介、集标题、Staff 信息
                      </n-tooltip>
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
                        v-if="animeDetail.subtitlePackages?.length"
                        :columns="subtitlePackageColumns"
                        :data="animeDetail.subtitlePackages"
                        :row-key="(row: SubtitlePackageRef) => row.lang"
                        :pagination="false"
                        size="small"
                        style="margin-bottom: 12px;"
                      />

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
                        <n-button size="tiny" type="error" :loading="batchDeleting" :disabled="batchDeleting" @click="doBatchDelete">确认</n-button>
                        <n-button size="tiny" :disabled="batchDeleting" @click="confirmBatchDelete = false">取消</n-button>
                      </n-space>

                      <n-collapse v-if="animeDetail.fontPackages?.length || animeDetail.fonts.length > 0" :default-expanded-names="[]">
                        <n-collapse-item title="使用字体" name="fonts">
                          <n-data-table
                            v-if="animeDetail.fontPackages?.length"
                            :columns="fontPackageColumns"
                            :data="animeDetail.fontPackages"
                            :row-key="(row: FontPackageRef) => row.name"
                            :pagination="false"
                            size="small"
                            style="margin-bottom: 8px;"
                          />
                          <n-data-table
                            v-if="animeDetail.fonts.length > 0"
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
                            <n-button size="tiny" type="error" :loading="fontBatchRemoving" :disabled="fontBatchRemoving" @click="doFontBatchRemove">确认</n-button>
                            <n-button size="tiny" :disabled="fontBatchRemoving" @click="confirmFontBatchRemove = false">取消</n-button>
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

    <n-modal v-model:show="showTemplateLinkModal" preset="card" title="关联模板" style="width: 520px;">
      <n-form label-placement="left" label-width="80">
        <n-form-item label="文件夹">
          <n-input :value="templateLinkTarget ? `${templateLinkTarget.year}/${templateLinkTarget.folder}` : ''" readonly />
        </n-form-item>
        <n-form-item label="模板">
          <n-select
            v-model:value="selectedTemplateLink"
            :options="templateLinkOptions"
            placeholder="选择模板"
            filterable
            clearable
            :loading="templateLinkLoading"
          />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showTemplateLinkModal = false">取消</n-button>
          <n-button :disabled="!selectedTemplateLink" :loading="savingTemplateLink" @click="clearTemplateLink">取消关联</n-button>
          <n-button type="primary" :disabled="!selectedTemplateLink" :loading="savingTemplateLink" @click="saveTemplateLink">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showEpisodeTitleModal" preset="card" title="编辑内容" style="width: 680px;">
      <n-collapse v-model:expanded-names="introTitleExpandedNames">
        <n-collapse-item title="集标题" name="episode-titles">
          <n-form label-placement="left" label-width="80">
            <n-form-item v-for="ep in episodeTitleList" :key="ep.episode" :label="`EP${String(ep.episode).padStart(2, '0')}`">
              <n-input v-model:value="ep.title" placeholder="输入本集标题" />
            </n-form-item>
          </n-form>
          <n-empty v-if="episodeTitleList.length === 0" description="暂无集数" />
        </n-collapse-item>
        <n-collapse-item title="简介" name="description">
          <n-input
            v-model:value="animeDescription"
            type="textarea"
            placeholder="输入简介"
            :autosize="{ minRows: 5, maxRows: 12 }"
          />
        </n-collapse-item>
        <n-collapse-item title="Staff" name="staff">
          <n-form label-placement="left" label-width="80">
            <n-form-item label="放置位置">
              <n-radio-group v-model:value="staffPosition">
                <n-radio value="after-description">简介后面</n-radio>
                <n-radio value="after-fonts">使用字体后面</n-radio>
              </n-radio-group>
            </n-form-item>
            <div class="staff-editor">
              <div class="staff-editor-header">
                <div class="staff-role-header">职位</div>
                <div class="staff-people-header">人员</div>
                <div class="staff-action-header"></div>
              </div>
              <div v-for="(_, index) in staffItems" :key="index" class="staff-editor-row">
                <n-input
                  v-model:value="staffItems[index].role"
                  type="textarea"
                  placeholder="职位"
                  class="staff-role-input"
                  :autosize="{ minRows: 1, maxRows: 6 }"
                />
                <n-input
                  v-model:value="staffItems[index].people"
                  type="textarea"
                  placeholder="人员"
                  class="staff-people-input"
                  :autosize="{ minRows: 1, maxRows: 6 }"
                />
                <n-button size="small" class="staff-delete-button" type="error" @click="removeStaffItem(index)">×</n-button>
              </div>
              <n-button size="small" class="staff-add-button" @click="addStaffItem">＋</n-button>
              <n-text depth="3" class="staff-editor-tip">回车换行后会自动添加 "&lt;br&gt;" 换行，不需要手动添加。</n-text>
            </div>
          </n-form>
        </n-collapse-item>
      </n-collapse>
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
import { NButton, NSpace, NPopconfirm, NTag, NTooltip, useMessage } from 'naive-ui'
import type { DataTableColumns, UploadCustomRequestOptions, SelectOption } from 'naive-ui'
import type { AnimeInfo, SubtitleFile, SubtitlePackageRef, FontRef, FontPackageRef, StaffInfo, StaffItem, StaffPosition } from '../types'
import { getContents, readmeUrl, getToken, downloadUrl, uploadFiles, deleteFile, getFileText, moveFiles } from '../utils/github'
import { parseAnimeReadme, generateAnimeReadme, generateYearReadme, parseYearReadme, generateRootReadme } from '../utils/readme'
import { getTemplates as apiGetTemplates, getEpisodeTitles as apiGetEpisodeTitles, saveEpisodeTitles as apiSaveEpisodeTitles, getAnimeTemplateLinks, saveAnimeTemplateLinks, getAnimeDescriptions, saveAnimeDescriptions, getStaffSettings, getAnimeStaff, saveAnimeStaff } from '../utils/api'

interface AnimeListItem {
  folder: string
  languages: string[]
  subtitleCount: number
}

interface StoredTemplate {
  name?: string
  groupTag?: string
  titleEn?: string
  titleCn?: string
  year?: string
  coverUrl?: string
  languages?: string[]
  subtitleType?: string
}

function getTemplateKey(template: StoredTemplate): string {
  return `${template.year || ''}/${template.titleEn || template.name || ''}`
}

function getAnimeLinkKey(year: string, folder: string): string {
  return `${year}/${folder}`
}

function getTemplateNames(templates: StoredTemplate[], year: string, links: Record<string, string> = {}): Record<string, string> {
  const names: Record<string, string> = {}
  const templateMap = new Map(templates.map(t => [getTemplateKey(t), t]))
  for (const t of templates) {
    if (t.year === year && t.titleEn && t.titleCn) {
      names[t.titleEn] = t.titleCn
    }
  }
  for (const [animeKey, templateKey] of Object.entries(links)) {
    const [animeYear, folder] = animeKey.split('/')
    if (animeYear !== year || !folder) continue
    const linkedTemplate = templateMap.get(templateKey)
    if (linkedTemplate?.titleCn) names[folder] = linkedTemplate.titleCn
  }
  return names
}

function getSubtitleSortValue(sub: SubtitleFile): number {
  const langOrder: Record<string, number> = { 'zh-hans': 0, 'zh-hant': 1 }
  return sub.episode * 10 + (langOrder[sub.lang] ?? 9)
}

function sortSubtitles(subtitles: SubtitleFile[]): SubtitleFile[] {
  return [...subtitles].sort((a, b) => {
    const diff = getSubtitleSortValue(a) - getSubtitleSortValue(b)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' })
  })
}

function parseRawSubtitleName(name: string): { episode: number; lang: string } | null {
  const match = name.match(/^(\d+)\.(zh-hans|zh-hant)\.ass$/i)
  if (!match) return null
  return { episode: parseInt(match[1], 10), lang: match[2].toLowerCase() }
}

function parseSubtitleFileInfo(name: string): { episode: number; lang: string } {
  const raw = parseRawSubtitleName(name)
  if (raw) return raw
  const epMatch = name.match(/S\d+E(\d+)/i) || name.match(/(?:^|\D)E(\d+)/i)
  const langMatch = name.match(/\.(zh-hans|zh-hant)\./i)
  return {
    episode: epMatch ? parseInt(epMatch[1], 10) : 0,
    lang: langMatch ? langMatch[1].toLowerCase() : '',
  }
}

function buildRenamedSubtitleName(folder: string, episode: number, lang: string): string {
  return `[smzase] ${folder} - S01E${String(episode).padStart(2, '0')}.${lang}.ass`
}

async function ensureTemplateData() {
  if (savedTemplates.value.length === 0) {
    const result = await apiGetTemplates().catch(() => ({ templates: [] }))
    savedTemplates.value = result.templates || []
  }
  const linkResult = await getAnimeTemplateLinks().catch(() => ({ links: {} as Record<string, string> }))
  animeTemplateLinks.value = linkResult.links || {}
}

function getLinkedTemplate(year: string, folder: string): StoredTemplate | undefined {
  const templateKey = animeTemplateLinks.value[getAnimeLinkKey(year, folder)]
  if (!templateKey) return undefined
  return savedTemplates.value.find(t => getTemplateKey(t) === templateKey)
}

function mergeUniqueLanguages(primary: string[], fallback: string[]): string[] {
  const langs = new Set<string>()
  for (const lang of primary) if (lang) langs.add(lang)
  for (const lang of fallback) if (lang) langs.add(lang)
  return Array.from(langs)
}

async function openTemplateLinkModal(year: string, folder: string) {
  templateLinkTarget.value = { year, folder }
  selectedTemplateLink.value = null
  showTemplateLinkModal.value = true
  templateLinkLoading.value = true
  try {
    await ensureTemplateData()
    templateLinkOptions.value = savedTemplates.value
      .filter(t => t.titleEn || t.name)
      .map(t => ({
        label: `${t.year || '未分类'} / ${t.name || t.titleEn}${t.titleCn ? ` / ${t.titleCn}` : ''}`,
        value: getTemplateKey(t),
      }))
    selectedTemplateLink.value = animeTemplateLinks.value[getAnimeLinkKey(year, folder)] || null
  } catch (err: any) {
    message.error(`加载模板失败: ${err.message}`)
  } finally {
    templateLinkLoading.value = false
  }
}

async function saveTemplateLink() {
  if (!templateLinkTarget.value || !selectedTemplateLink.value) return
  savingTemplateLink.value = true
  try {
    const key = getAnimeLinkKey(templateLinkTarget.value.year, templateLinkTarget.value.folder)
    animeTemplateLinks.value = { ...animeTemplateLinks.value, [key]: selectedTemplateLink.value }
    await saveAnimeTemplateLinks(animeTemplateLinks.value)
    const linkedTemplate = getLinkedTemplate(templateLinkTarget.value.year, templateLinkTarget.value.folder)
    if (animeDetail.value && expandedAnime.value === key && linkedTemplate) {
      animeDetail.value.titleCn = animeDetail.value.titleCn || linkedTemplate.titleCn || ''
      animeDetail.value.coverUrl = linkedTemplate.coverUrl || animeDetail.value.coverUrl || ''
      animeDetail.value.languages = mergeUniqueLanguages(animeDetail.value.languages, linkedTemplate.languages || [])
      animeDetail.value.subtitleType = linkedTemplate.subtitleType || animeDetail.value.subtitleType || 'bilingual'
    }
    showTemplateLinkModal.value = false
    message.success('模板关联已保存')
  } catch (err: any) {
    message.error(`保存失败: ${err.message}`)
  } finally {
    savingTemplateLink.value = false
  }
}

async function clearTemplateLink() {
  if (!templateLinkTarget.value) return
  savingTemplateLink.value = true
  try {
    const key = getAnimeLinkKey(templateLinkTarget.value.year, templateLinkTarget.value.folder)
    const links = { ...animeTemplateLinks.value }
    delete links[key]
    animeTemplateLinks.value = links
    await saveAnimeTemplateLinks(links)
    selectedTemplateLink.value = null
    showTemplateLinkModal.value = false
    message.success('模板关联已取消')
  } catch (err: any) {
    message.error(`取消关联失败: ${err.message}`)
  } finally {
    savingTemplateLink.value = false
  }
}

async function waitForRenamedFiles(basePath: string, expectedNames: string[]) {
  if (expectedNames.length === 0) return
  for (let i = 0; i < 5; i++) {
    const contents = await getContents(basePath)
    if (contents && Array.isArray(contents)) {
      const names = new Set(contents.map((item: any) => item.name))
      const missing = expectedNames.filter(name => !names.has(name))
      if (missing.length === 0) return
    }
    await new Promise(resolve => setTimeout(resolve, 800))
  }
  throw new Error('GitHub 已提交重命名，但目录列表暂未刷新，请稍后重新打开或再点一次刷新排序')
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
const deletingSubtitlePath = ref('')
const batchDeleting = ref(false)
const showEditModal = ref(false)
const editingSubtitle = ref<SubtitleFile | null>(null)
const checkedFonts = ref<string[]>([])
const confirmFontBatchRemove = ref(false)
const removingFontName = ref('')
const removingFontPackageName = ref('')
const fontBatchRemoving = ref(false)
const yearReadmeLoading = ref('')
const rootReadmeLoading = ref(false)
const animeReadmeLoading = ref('')
const sortLoading = ref('')
const showEpisodeTitleModal = ref(false)
const savingEpisodeTitles = ref(false)
const episodeTitleLoading = ref('')
const episodeTitleList = ref<Array<{ episode: number; title: string }>>([])
const animeDescription = ref('')
const introTitleExpandedNames = ref<string[]>([])
const staffPosition = ref<StaffPosition>('after-description')
const staffItems = ref<StaffItem[]>([])
const showTemplateLinkModal = ref(false)
const templateLinkLoading = ref(false)
const savingTemplateLink = ref(false)
const templateLinkTarget = ref<{ year: string; folder: string } | null>(null)
const selectedTemplateLink = ref<string | null>(null)
const templateLinkOptions = ref<SelectOption[]>([])
const savedTemplates = ref<StoredTemplate[]>([])
const animeTemplateLinks = ref<Record<string, string>>({})

const subtitlePackageColumns: DataTableColumns<SubtitlePackageRef> = [
  { title: '集数', key: 'episode', width: 70, render: () => '合集' },
  { title: '语言', key: 'lang', width: 80, render: (row) => row.lang === 'zh-hans' ? '简中' : row.lang === 'zh-hant' ? '繁中' : row.lang },
  { title: '文件名', key: 'name', ellipsis: { tooltip: true } },
]

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
            loading: deletingSubtitlePath.value === row.path,
            disabled: !!deletingSubtitlePath.value || batchDeleting.value,
          }, { default: () => '删除' }),
          default: () => `确认删除 ${row.name}?`,
        }),
      ],
    }),
  },
]

const fontPackageColumns: DataTableColumns<FontPackageRef> = [
  {
    title: '字体整合包', key: 'name',
    render: (row) => h(NTag, { type: 'success', bordered: false }, { default: () => row.name }),
  },
  {
    title: '操作', key: 'actions', width: 80,
    render: (row) => h(NPopconfirm, {
      onPositiveClick: () => doRemoveFontPackage(row),
    }, {
      trigger: () => h(NButton, {
        size: 'tiny', type: 'error', text: true,
        loading: removingFontPackageName.value === row.name,
        disabled: !!removingFontPackageName.value,
      }, { default: () => '移除' }),
      default: () => `确认移除 ${row.name}?`,
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
        loading: removingFontName.value === row.name,
        disabled: !!removingFontName.value || fontBatchRemoving.value,
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
  const oldFonts = [...animeDetail.value.fonts]
  removingFontName.value = font.name
  const removeMessage = message.loading(`正在移除 ${font.name}...`, { duration: 0 })
  try {
    animeDetail.value.fonts = animeDetail.value.fonts.filter(f => f.name !== font.name)
    await updateReadme()
    message.success(`已移除 ${font.name}`)
  } catch (err: any) {
    animeDetail.value.fonts = oldFonts
    message.error(`移除失败: ${err.message}`)
  } finally {
    removeMessage.destroy()
    removingFontName.value = ''
  }
}

async function doRemoveFontPackage(pkg: FontPackageRef) {
  if (!animeDetail.value) return
  const oldPackages = [...(animeDetail.value.fontPackages || [])]
  removingFontPackageName.value = pkg.name
  const removeMessage = message.loading(`正在移除 ${pkg.name}...`, { duration: 0 })
  try {
    animeDetail.value.fontPackages = (animeDetail.value.fontPackages || []).filter(f => f.name !== pkg.name)
    await updateReadme()
    message.success(`已移除 ${pkg.name}`)
  } catch (err: any) {
    animeDetail.value.fontPackages = oldPackages
    message.error(`移除失败: ${err.message}`)
  } finally {
    removeMessage.destroy()
    removingFontPackageName.value = ''
  }
}

async function doFontBatchRemove() {
  if (!animeDetail.value) return
  const oldFonts = [...animeDetail.value.fonts]
  fontBatchRemoving.value = true
  const removeMessage = message.loading(`正在移除 ${checkedFonts.value.length} 个字体...`, { duration: 0 })
  try {
    animeDetail.value.fonts = animeDetail.value.fonts.filter(
      f => !checkedFonts.value.includes(f.name)
    )
    checkedFonts.value = []
    confirmFontBatchRemove.value = false
    await updateReadme()
    message.success('批量移除完成')
  } catch (err: any) {
    animeDetail.value.fonts = oldFonts
    message.error(`批量移除失败: ${err.message}`)
  } finally {
    removeMessage.destroy()
    fontBatchRemoving.value = false
  }
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
  deletingSubtitlePath.value = sub.path
  const deleteMessage = message.loading(`正在删除 ${sub.name}...`, { duration: 0 })
  try {
    await deleteFile(sub.path, `chore: 删除 ${sub.name}`)
    if (animeDetail.value) {
      animeDetail.value.subtitles = animeDetail.value.subtitles.filter(s => s.path !== sub.path)
      await updateReadme()
    }
    message.success(`已删除 ${sub.name}`)
  } catch (err: any) {
    message.error(`删除失败: ${err.message}`)
  } finally {
    deleteMessage.destroy()
    deletingSubtitlePath.value = ''
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
  batchDeleting.value = true
  const selectedCount = checkedSubtitles.value.length
  const deleteMessage = message.loading(`正在删除 ${selectedCount} 个字幕...`, { duration: 0 })
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
    message.success(`批量删除完成：${selectedCount} 个字幕`)
  } catch (err: any) {
    message.error(`批量删除失败: ${err.message}`)
  } finally {
    deleteMessage.destroy()
    batchDeleting.value = false
  }
}

async function collectYearAnimeList(year: string): Promise<Array<{ titleEn: string; titleCn: string }>> {
  const yearContents = await getContents(`Anime subtitles/${year}`)
  if (!yearContents || !Array.isArray(yearContents)) return []
  const animeDirs = yearContents.filter((c: any) => c.type === 'dir')
  await ensureTemplateData()
  const templateNames = getTemplateNames(savedTemplates.value, year, animeTemplateLinks.value)
  const existingYearNames: Record<string, string> = {}
  const yearReadmeFile = yearContents.find((c: any) => c.type === 'file' && c.name === 'README.md')
  if (yearReadmeFile) {
    const res = await fetch(readmeUrl(`Anime subtitles/${year}/README.md`))
    if (res.ok) Object.assign(existingYearNames, parseYearReadme(await res.text()))
  }
  const animeList: Array<{ titleEn: string; titleCn: string }> = []
  for (const dir of animeDirs) {
    let titleCn = existingYearNames[dir.name] || templateNames[dir.name] || ''
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
    await ensureTemplateData()
    const linkedTemplate = getLinkedTemplate(animeDetail.value.year, animeDetail.value.folder)
    if (linkedTemplate) {
      animeDetail.value.titleCn = animeDetail.value.titleCn || linkedTemplate.titleCn || ''
      animeDetail.value.coverUrl = linkedTemplate.coverUrl || animeDetail.value.coverUrl || ''
      animeDetail.value.languages = mergeUniqueLanguages(animeDetail.value.languages, linkedTemplate.languages || [])
      animeDetail.value.subtitleType = linkedTemplate.subtitleType || animeDetail.value.subtitleType || 'bilingual'
    }
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

async function mergeKvEpisodeTitles(key: string, titles: Record<number, string>): Promise<Record<number, string>> {
  const merged = { ...titles }
  try {
    const result = await apiGetEpisodeTitles()
    const kvTitles = result.episodeTitles[key] || {}
    for (const [epStr, title] of Object.entries(kvTitles)) {
      const epNum = parseInt(epStr, 10)
      if (!isNaN(epNum) && title) merged[epNum] = title
    }
  } catch {
    // noop
  }
  return merged
}

async function mergeKvDescription(key: string, description: string): Promise<string> {
  try {
    const result = await getAnimeDescriptions()
    return result.descriptions[key] || description
  } catch {
    return description
  }
}

async function mergeKvStaff(key: string, staff: StaffInfo): Promise<StaffInfo> {
  try {
    const result = await getAnimeStaff()
    return result.staff[key] || staff
  } catch {
    return staff
  }
}

function normalizeStaffText(value: string): string {
  return value.trim().replace(/\r\n|\r|\n/g, '<br>')
}

function normalizeStaffItems(items: StaffItem[]): StaffItem[] {
  return items
    .map(item => ({ role: normalizeStaffText(item.role), people: normalizeStaffText(item.people) }))
    .filter(item => item.role || item.people)
}

function addStaffItem() {
  staffItems.value.push({ role: '', people: '' })
}

function removeStaffItem(index: number) {
  staffItems.value.splice(index, 1)
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
    let fontPackages: FontPackageRef[] = []
    let subtitlePackages: SubtitlePackageRef[] = []
    let subtitleType = 'bilingual'
    let episodeTitles: Record<number, string> = {}
    let description = ''
    let staff: StaffInfo = { position: 'after-description', items: [] }

    const readmeFile = contents.find((f: any) => f.name === 'README.md')
    if (readmeFile) {
      const text = await getFileText(`${basePath}/README.md`)
      if (text) {
        const parsed = parseAnimeReadme(text)
        titleCn = parsed.titleCn
        coverUrl = parsed.coverUrl
        languages = parsed.languages
        readmeFonts = parsed.fonts
        fontPackages = parsed.fontPackages
        subtitlePackages = parsed.subtitlePackages
        subtitleType = parsed.subtitleType || 'bilingual'
        episodeTitles = parsed.episodeTitles
        description = parsed.description
        staff = parsed.staff
      }
    }

    await ensureTemplateData()
    const linkedTemplate = getLinkedTemplate(year, folder)
    if (linkedTemplate) {
      titleCn = titleCn || linkedTemplate.titleCn || ''
      coverUrl = linkedTemplate.coverUrl || coverUrl || ''
      languages = mergeUniqueLanguages(languages, linkedTemplate.languages || [])
      subtitleType = linkedTemplate.subtitleType || subtitleType || 'bilingual'
    }

    const assFiles = contents.filter((f: any) => f.name.endsWith('.ass'))
    const subtitles: SubtitleFile[] = sortSubtitles(assFiles.map((f: any) => {
      const parsed = parseSubtitleFileInfo(f.name)
      return {
        name: f.name,
        path: `${basePath}/${f.name}`,
        episode: parsed.episode,
        season: 1,
        lang: parsed.lang,
        downloadUrl: downloadUrl(`${basePath}/${f.name}`),
      }
    }))

    if (languages.length === 0) {
      const langSet = new Set<string>()
      for (const s of subtitles) {
        if (s.lang) langSet.add(s.lang)
      }
      for (const pkg of subtitlePackages) {
        if (pkg.lang) langSet.add(pkg.lang)
      }
      languages = Array.from(langSet)
    }

    episodeTitles = await mergeKvEpisodeTitles(key, episodeTitles)
    description = await mergeKvDescription(key, description)
    staff = await mergeKvStaff(key, staff)

    const animeInfo: AnimeInfo = {
      year,
      folder,
      titleEn: folder,
      titleCn,
      coverUrl,
      languages,
      subtitles,
      subtitlePackages,
      fonts: readmeFonts,
      fontPackages,
      subtitleType,
      episodeTitles,
      description,
      staff,
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

async function refreshAnimeSort(year: string, folder: string) {
  const key = `${year}/${folder}`
  sortLoading.value = key
  try {
    const basePath = `Anime subtitles/${year}/${folder}`
    const contents = await getContents(basePath)
    if (contents && Array.isArray(contents)) {
      const existingNames = new Set(contents.map((item: any) => item.name))
      const moves: Array<{ from: string; to: string; sha?: string }> = []
      for (const item of contents) {
        if (item.type !== 'file') continue
        const parsed = parseRawSubtitleName(item.name)
        if (!parsed) continue
        const newName = buildRenamedSubtitleName(folder, parsed.episode, parsed.lang)
        if (newName === item.name || existingNames.has(newName)) continue
        moves.push({ from: `${basePath}/${item.name}`, to: `${basePath}/${newName}`, sha: item.sha })
        existingNames.add(newName)
      }
      if (moves.length > 0) {
        const movedPaths = await moveFiles(moves, `chore: 重命名 ${folder} 原始字幕文件`)
        const expectedNames = movedPaths.map(path => path.split('/').pop()).filter((name): name is string => !!name)
        await waitForRenamedFiles(basePath, expectedNames)
        message.success(`已重命名 ${expectedNames.length} 个原始字幕文件`)
      } else {
        message.info('没有找到需要重命名的原始字幕文件')
      }
    }
    await refreshAnimeReadme(year, folder)
    if (expandedAnime.value === key) {
      expandedAnime.value = ''
      await toggleAnimeDetail(year, folder)
    }
    message.success(`${folder} 字幕排序已刷新`)
  } catch (err: any) {
    message.error(`刷新排序失败: ${err.message}`)
  } finally {
    sortLoading.value = ''
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
    let description = ''
    try {
      const descriptions = await getAnimeDescriptions()
      description = descriptions.descriptions[key] || ''
    } catch {
      // noop
    }
    animeDescription.value = description || animeDetail.value.description || ''
    let staff = animeDetail.value.staff
    try {
      const allStaff = await getAnimeStaff()
      staff = allStaff.staff[key] || staff
    } catch {
      // noop
    }
    if (!staff || staff.items.length === 0) {
      try {
        const settings = await getStaffSettings()
        staff = { position: settings.settings.position, items: settings.settings.roles.map(role => ({ role, people: '' })) }
      } catch {
        staff = { position: 'after-description', items: [] }
      }
    }
    staffPosition.value = staff.position
    staffItems.value = staff.items.map(item => ({ ...item }))
    introTitleExpandedNames.value = []
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
    animeDetail.value.description = animeDescription.value.trim()
    animeDetail.value.staff = { position: staffPosition.value, items: normalizeStaffItems(staffItems.value) }
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
    let allDescriptions: Record<string, string> = {}
    try {
      const result = await getAnimeDescriptions()
      allDescriptions = result.descriptions
    } catch {
      // noop
    }
    const description = animeDescription.value.trim()
    if (description) {
      allDescriptions[key] = description
    } else {
      delete allDescriptions[key]
    }
    await saveAnimeDescriptions(allDescriptions)
    let allStaff: Record<string, StaffInfo> = {}
    try {
      const result = await getAnimeStaff()
      allStaff = result.staff
    } catch {
      // noop
    }
    const staff = { position: staffPosition.value, items: normalizeStaffItems(staffItems.value) }
    if (staff.items.length > 0) {
      allStaff[key] = staff
    } else {
      delete allStaff[key]
    }
    await saveAnimeStaff(allStaff)
    showEpisodeTitleModal.value = false
    message.success('内容已保存')
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
    let fontPackages: FontPackageRef[] = []
    let subtitlePackages: SubtitlePackageRef[] = []
    let subtitleType = 'bilingual'
    let episodeTitles: Record<number, string> = {}
    let description = ''
    let staff: StaffInfo = { position: 'after-description', items: [] }

    const readmeFile = contents.find((f: any) => f.name === 'README.md')
    if (readmeFile) {
      const text = await getFileText(`${basePath}/README.md`)
      if (text) {
        const parsed = parseAnimeReadme(text)
        titleCn = parsed.titleCn
        coverUrl = parsed.coverUrl
        languages = parsed.languages
        readmeFonts = parsed.fonts
        fontPackages = parsed.fontPackages
        subtitlePackages = parsed.subtitlePackages
        subtitleType = parsed.subtitleType || 'bilingual'
        episodeTitles = parsed.episodeTitles
        description = parsed.description
        staff = parsed.staff
      }
    }

    await ensureTemplateData()
    const linkedTemplate = getLinkedTemplate(year, folder)
    if (linkedTemplate) {
      titleCn = titleCn || linkedTemplate.titleCn || ''
      coverUrl = linkedTemplate.coverUrl || coverUrl || ''
      languages = mergeUniqueLanguages(languages, linkedTemplate.languages || [])
      subtitleType = linkedTemplate.subtitleType || subtitleType || 'bilingual'
    }

    const assFiles = contents.filter((f: any) => f.name.endsWith('.ass'))
    const subtitles: SubtitleFile[] = sortSubtitles(assFiles.map((f: any) => {
      const parsed = parseSubtitleFileInfo(f.name)
      return {
        name: f.name,
        path: `${basePath}/${f.name}`,
        episode: parsed.episode,
        season: 1,
        lang: parsed.lang,
        downloadUrl: downloadUrl(`${basePath}/${f.name}`),
      }
    }))

    if (languages.length === 0) {
      const langSet = new Set<string>()
      for (const s of subtitles) {
        if (s.lang) langSet.add(s.lang)
      }
      for (const pkg of subtitlePackages) {
        if (pkg.lang) langSet.add(pkg.lang)
      }
      languages = Array.from(langSet)
    }

    episodeTitles = await mergeKvEpisodeTitles(key, episodeTitles)
    description = await mergeKvDescription(key, description)
    staff = await mergeKvStaff(key, staff)

    animeDetail.value = {
      year,
      folder,
      titleEn: folder,
      titleCn,
      coverUrl,
      languages,
      subtitles,
      subtitlePackages,
      fonts: readmeFonts,
      fontPackages,
      subtitleType: subtitleType,
      episodeTitles,
      description,
      staff,
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

<style scoped>
.staff-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.staff-editor-header,
.staff-editor-row {
  display: grid;
  grid-template-columns: 220px minmax(340px, 1fr) 34px;
  gap: 8px;
  align-items: center;
}

.staff-editor-header {
  color: #606266;
  font-size: 13px;
}

.staff-role-input,
.staff-people-input {
  width: 100%;
}

.staff-delete-button,
.staff-add-button {
  width: 34px;
  min-width: 34px;
  padding: 0;
}

.staff-add-button {
  align-self: flex-start;
}

.staff-editor-tip {
  font-size: 12px;
}
</style>
