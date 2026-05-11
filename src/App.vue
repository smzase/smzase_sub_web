<template>
  <n-config-provider>
    <n-message-provider>
      <n-layout v-if="!isLoggedIn" style="height: 100%;">
        <router-view />
      </n-layout>
      <n-layout v-else style="height: 100%;">
        <n-layout-header bordered style="padding: 0 24px; display: flex; align-items: center; height: 56px; background: #fff;">
          <div style="font-size: 18px; font-weight: 700; margin-right: 32px;">smzase_sub</div>
          <n-menu
            mode="horizontal"
            :value="currentRoute"
            :options="menuOptions"
            @update:value="onMenuSelect"
          />
          <div style="margin-left: auto;">
            <n-button size="small" @click="handleLogout">退出</n-button>
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
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { setToken } from './utils/github'
import { getSessionToken, clearSession, getGHToken, logout as apiLogout } from './utils/api'

const router = useRouter()
const route = useRoute()

const isLoggedIn = ref(false)

const currentRoute = computed(() => {
  if (route.path.startsWith('/upload')) return 'upload'
  if (route.path.startsWith('/subtitles')) return 'subtitles'
  if (route.path.startsWith('/fonts')) return 'fonts'
  if (route.path.startsWith('/settings')) return 'settings'
  return 'upload'
})

const menuOptions = [
  { label: '上传', key: 'upload' },
  { label: '字幕', key: 'subtitles' },
  { label: '字体', key: 'fonts' },
  { label: '设置', key: 'settings' },
]

function onMenuSelect(key: string) {
  router.push(`/${key}`)
}

async function handleLogout() {
  try {
    await apiLogout()
  } catch {
    // noop
  }
  clearSession()
  isLoggedIn.value = false
  router.push('/login')
}

onMounted(async () => {
  const session = getSessionToken()
  if (!session) {
    isLoggedIn.value = false
    router.push('/login')
    return
  }

  try {
    const result = await getGHToken()
    if (result.token) {
      setToken(result.token)
    }
    isLoggedIn.value = true
    if (route.path === '/login') {
      router.replace('/')
    }
  } catch {
    clearSession()
    isLoggedIn.value = false
    router.push('/login')
  }
})
</script>
