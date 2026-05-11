<template>
  <n-config-provider>
    <n-message-provider>
      <n-layout style="height: 100%">
        <n-layout-header bordered style="padding: 0 24px; display: flex; align-items: center; height: 56px; background: #fff;">
          <div style="font-size: 18px; font-weight: 700; margin-right: 32px;">smzase_sub</div>
          <n-menu
            mode="horizontal"
            :value="currentRoute"
            :options="menuOptions"
            @update:value="onMenuSelect"
          />
          <div style="margin-left: auto;">
            <n-popover trigger="click" placement="bottom-end">
              <template #trigger>
                <n-button size="small" :type="hasToken ? 'default' : 'warning'">
                  {{ hasToken ? '已连接' : '设置 Token' }}
                </n-button>
              </template>
              <div style="width: 320px;">
                <n-input
                  v-model:value="tokenInput"
                  type="password"
                  placeholder="输入 GitHub Personal Access Token"
                  show-password-on="click"
                />
                <n-button
                  style="margin-top: 8px; width: 100%;"
                  type="primary"
                  @click="saveToken"
                >
                  保存
                </n-button>
              </div>
            </n-popover>
          </div>
        </n-layout-header>
        <n-layout-content style="padding: 24px; max-width: 1200px; margin: 0 auto; width: 100%;">
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { setToken, getToken } from './utils/github'

const router = useRouter()
const route = useRoute()

const tokenInput = ref(getToken())
const hasToken = computed(() => !!getToken())

const currentRoute = computed(() => {
  if (route.path.startsWith('/upload')) return 'upload'
  if (route.path.startsWith('/subtitles')) return 'subtitles'
  if (route.path.startsWith('/fonts')) return 'fonts'
  return 'upload'
})

const menuOptions = [
  { label: '上传', key: 'upload' },
  { label: '字幕', key: 'subtitles' },
  { label: '字体', key: 'fonts' },
]

function onMenuSelect(key: string) {
  router.push(`/${key}`)
}

function saveToken() {
  setToken(tokenInput.value)
}
</script>
