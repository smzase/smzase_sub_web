<template>
  <div>
    <n-card title="设置">
      <n-spin :show="loading">
        <n-form label-placement="left" label-width="160" style="max-width: 600px;">
          <n-divider title-placement="left">GitHub</n-divider>
          <n-form-item label="Personal Access Token">
            <n-input
              v-model:value="ghToken"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              show-password-on="click"
            />
          </n-form-item>
          <n-form-item>
            <n-button type="primary" @click="saveGHToken" :loading="saving">保存 Token</n-button>
          </n-form-item>

          <n-divider title-placement="left">R2 对象存储</n-divider>
          <n-form-item label="字体下载域名">
            <n-input
              v-model:value="r2Domain"
              placeholder="https://fonts.example.com"
            />
          </n-form-item>
          <n-form-item>
            <n-space>
              <n-button type="primary" @click="saveR2Domain" :loading="saving">保存域名</n-button>
            </n-space>
          </n-form-item>
          <n-text depth="3" style="font-size: 12px; display: block; margin-top: -8px;">
            设置 R2 字体文件的公开下载域名。留空则使用 Worker 自身地址作为下载链接。需要你在 Cloudflare 中配置 R2 的自定义域名或公开访问。
          </n-text>
        </n-form>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMessage } from 'naive-ui'
import { getGHToken, setGHToken, getR2Domain, setR2Domain } from '../utils/api'
import { setToken } from '../utils/github'

const message = useMessage()
const loading = ref(true)
const saving = ref(false)
const ghToken = ref('')
const r2Domain = ref('')

onMounted(async () => {
  try {
    const [tokenResult, domainResult] = await Promise.all([getGHToken(), getR2Domain()])
    ghToken.value = tokenResult.token || ''
    r2Domain.value = domainResult.domain || ''
    if (tokenResult.token) setToken(tokenResult.token)
  } catch (err: any) {
    message.error(`加载设置失败: ${err.message}`)
  } finally {
    loading.value = false
  }
})

async function saveGHToken() {
  saving.value = true
  try {
    await setGHToken(ghToken.value)
    setToken(ghToken.value)
    message.success('GitHub Token 已保存')
  } catch (err: any) {
    message.error(`保存失败: ${err.message}`)
  } finally {
    saving.value = false
  }
}

async function saveR2Domain() {
  saving.value = true
  try {
    await setR2Domain(r2Domain.value)
    message.success('R2 下载域名已保存')
  } catch (err: any) {
    message.error(`保存失败: ${err.message}`)
  } finally {
    saving.value = false
  }
}
</script>
