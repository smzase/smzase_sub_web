<template>
  <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
    <n-card :title="isSetup ? '创建管理员账号' : '登录'" style="width: 400px;">
      <n-form @submit.prevent="handleSubmit">
        <n-form-item label="用户名">
          <n-input v-model:value="username" placeholder="输入用户名" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="password" type="password" placeholder="输入密码" show-password-on="click" />
        </n-form-item>
        <n-form-item v-if="secondPasswordEnabled && !isSetup" label="二密">
          <n-input v-model:value="secondPassword" type="password" placeholder="输入二密" show-password-on="click" />
        </n-form-item>
        <div v-if="turnstileEnabled && turnstileSiteKey && !isSetup" style="margin-bottom: 16px; display: flex; justify-content: center;">
          <div :id="turnstileContainerId"></div>
        </div>
        <n-button type="primary" block :loading="loading" attr-type="submit" :disabled="turnstileEnabled && !turnstileToken && !isSetup">
          {{ isSetup ? '创建账号' : '登录' }}
        </n-button>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useMessage } from 'naive-ui'
import { getAuthStatus, setupAccount, login, setSessionToken } from '../utils/api'

const message = useMessage()
const loading = ref(false)
const isSetup = ref(false)
const secondPasswordEnabled = ref(false)
const turnstileEnabled = ref(false)
const turnstileSiteKey = ref('')
const turnstileToken = ref('')
const turnstileContainerId = 'turnstile-container'
const turnstileWidgetId = ref<string | undefined>(undefined)
const username = ref('')
const password = ref('')
const secondPassword = ref('')

function renderTurnstile() {
  const win = window as any
  if (!win.turnstile || !turnstileSiteKey.value) return
  const container = document.getElementById(turnstileContainerId)
  if (!container || turnstileWidgetId.value) return
  turnstileWidgetId.value = win.turnstile.render(`#${turnstileContainerId}`, {
    sitekey: turnstileSiteKey.value,
    callback: (token: string) => {
      turnstileToken.value = token
    },
    'expired-callback': () => {
      turnstileToken.value = ''
    },
    'error-callback': () => {
      turnstileToken.value = ''
    },
  })
}

function resetTurnstile() {
  const win = window as any
  if (win.turnstile && turnstileWidgetId.value) {
    win.turnstile.reset(turnstileWidgetId.value)
    turnstileToken.value = ''
  }
}

onMounted(async () => {
  try {
    const status = await getAuthStatus()
    isSetup.value = !status.configured
    secondPasswordEnabled.value = !!status.secondPasswordEnabled
    turnstileEnabled.value = !!status.turnstileEnabled
    turnstileSiteKey.value = status.turnstileSiteKey || ''
    if (turnstileEnabled.value && turnstileSiteKey.value && !isSetup.value) {
      await nextTick()
      const win = window as any
      if (win.turnstile) {
        renderTurnstile()
      } else {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=_turnstileCb'
        script.async = true
        ;(window as any)._turnstileCb = () => {
          renderTurnstile()
        }
        document.head.appendChild(script)
      }
    }
  } catch {
    isSetup.value = true
  }
})

onUnmounted(() => {
  const win = window as any
  if (win.turnstile && turnstileWidgetId.value) {
    win.turnstile.remove(turnstileWidgetId.value)
  }
  delete (window as any)._turnstileCb
})

async function handleSubmit() {
  if (!username.value || !password.value) {
    message.warning('请填写用户名和密码')
    return
  }
  if (secondPasswordEnabled.value && !isSetup.value && !secondPassword.value) {
    message.warning('请填写二密')
    return
  }
  loading.value = true
  try {
    if (isSetup.value) {
      await setupAccount(username.value, password.value)
      message.success('账号创建成功')
    }
    const result = await login(username.value, password.value, secondPassword.value, turnstileToken.value)
    setSessionToken(result.token)
    message.success('登录成功')
    window.location.href = '/'
  } catch (err: any) {
    resetTurnstile()
    message.error(err.message || '操作失败')
  } finally {
    loading.value = false
  }
}
</script>
