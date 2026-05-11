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
        <n-button type="primary" block :loading="loading" attr-type="submit">
          {{ isSetup ? '创建账号' : '登录' }}
        </n-button>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { getAuthStatus, setupAccount, login, setSessionToken } from '../utils/api'

const message = useMessage()
const loading = ref(false)
const isSetup = ref(false)
const username = ref('')
const password = ref('')

onMounted(async () => {
  try {
    const status = await getAuthStatus()
    isSetup.value = !status.configured
  } catch {
    isSetup.value = true
  }
})

async function handleSubmit() {
  if (!username.value || !password.value) {
    message.warning('请填写用户名和密码')
    return
  }
  loading.value = true
  try {
    if (isSetup.value) {
      await setupAccount(username.value, password.value)
      message.success('账号创建成功')
    }
    const result = await login(username.value, password.value)
    setSessionToken(result.token)
    message.success('登录成功')
    window.location.href = '/'
  } catch (err: any) {
    message.error(err.message || '操作失败')
  } finally {
    loading.value = false
  }
}
</script>
