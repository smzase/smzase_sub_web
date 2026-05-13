<template>
  <div>
    <n-card title="设置">
      <n-spin :show="loading">
        <n-form label-placement="left" label-width="220" style="max-width: 600px;">
          <n-form-item>
            <n-space align="center" :wrap="false">
              <n-switch
                v-model:value="allowLargeSubtitleUpload"
                :loading="savingUploadSettings"
                @update:value="saveLargeSubtitleUploadSetting"
              />
              <span>允许上传超过 25MB 的字幕</span>
            </n-space>
          </n-form-item>

          <n-divider title-placement="left">账号安全</n-divider>
          <n-collapse>
            <n-collapse-item title="登录账号与二密" name="account-security">
              <n-form-item label="二密登录">
                <n-space align="center" :wrap="false">
                  <n-switch
                    v-model:value="secondPasswordEnabled"
                    :loading="savingSecondPassword"
                    @update:value="saveSecondPassword"
                  />
                  <span>{{ secondPasswordConfigured ? '已设置二密' : '未设置二密' }}</span>
                </n-space>
              </n-form-item>
              <n-form-item label="二密">
                <n-input
                  v-model:value="secondPassword"
                  type="password"
                  placeholder="输入新的二密"
                  show-password-on="click"
                />
              </n-form-item>
              <n-form-item>
                <n-button type="primary" @click="saveSecondPassword" :loading="savingSecondPassword">保存二密设置</n-button>
              </n-form-item>

              <n-divider title-placement="left">账号密码</n-divider>
              <n-form-item label="用户名">
                <n-input v-model:value="accountUsername" placeholder="输入用户名" />
              </n-form-item>
              <n-form-item label="旧密码">
                <n-input v-model:value="oldPassword" type="password" placeholder="修改密码时必填" show-password-on="click" />
              </n-form-item>
              <n-form-item label="新密码">
                <n-input v-model:value="newPassword" type="password" placeholder="不修改密码则留空" show-password-on="click" />
              </n-form-item>
              <n-form-item>
                <n-button type="primary" @click="saveAccount" :loading="savingAccount">保存账号密码</n-button>
              </n-form-item>
            </n-collapse-item>
          </n-collapse>

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
import { getGHToken, setGHToken, getR2Domain, setR2Domain, getUploadSettings, saveUploadSettings, getAccount, updateAccount, getSecondPasswordSettings, saveSecondPasswordSettings, clearSession } from '../utils/api'
import { setToken } from '../utils/github'

const message = useMessage()
const loading = ref(true)
const saving = ref(false)
const savingUploadSettings = ref(false)
const savingSecondPassword = ref(false)
const savingAccount = ref(false)
const ghToken = ref('')
const r2Domain = ref('')
const allowLargeSubtitleUpload = ref(false)
const secondPasswordEnabled = ref(false)
const secondPasswordConfigured = ref(false)
const secondPassword = ref('')
const accountUsername = ref('')
const oldPassword = ref('')
const newPassword = ref('')

onMounted(async () => {
  try {
    const [tokenResult, domainResult, uploadSettings, account, secondPasswordSettings] = await Promise.all([
      getGHToken(),
      getR2Domain(),
      getUploadSettings(),
      getAccount(),
      getSecondPasswordSettings(),
    ])
    ghToken.value = tokenResult.token || ''
    r2Domain.value = domainResult.domain || ''
    allowLargeSubtitleUpload.value = !!uploadSettings.allowLargeSubtitleUpload
    accountUsername.value = account.username || ''
    secondPasswordEnabled.value = !!secondPasswordSettings.enabled
    secondPasswordConfigured.value = !!secondPasswordSettings.configured
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

async function saveLargeSubtitleUploadSetting(value: boolean) {
  savingUploadSettings.value = true
  try {
    await saveUploadSettings({ allowLargeSubtitleUpload: value })
    message.success('设置已保存')
  } catch (err: any) {
    allowLargeSubtitleUpload.value = !value
    message.error(`保存失败: ${err.message}`)
  } finally {
    savingUploadSettings.value = false
  }
}

async function saveSecondPassword(value = secondPasswordEnabled.value) {
  if (value && !secondPasswordConfigured.value && !secondPassword.value) {
    secondPasswordEnabled.value = false
    message.warning('请先输入二密')
    return
  }
  savingSecondPassword.value = true
  try {
    const result = await saveSecondPasswordSettings({ enabled: value, password: secondPassword.value || undefined })
    secondPasswordEnabled.value = !!result.enabled
    secondPasswordConfigured.value = !!result.configured
    secondPassword.value = ''
    message.success('二密设置已保存')
  } catch (err: any) {
    secondPasswordEnabled.value = !value
    message.error(`保存失败: ${err.message}`)
  } finally {
    savingSecondPassword.value = false
  }
}

async function saveAccount() {
  if (!accountUsername.value.trim()) {
    message.warning('请填写用户名')
    return
  }
  if (newPassword.value && !oldPassword.value) {
    message.warning('修改密码需要填写旧密码')
    return
  }
  savingAccount.value = true
  try {
    await updateAccount({
      username: accountUsername.value.trim(),
      oldPassword: oldPassword.value || undefined,
      newPassword: newPassword.value || undefined,
    })
    oldPassword.value = ''
    newPassword.value = ''
    clearSession()
    message.success('账号密码已保存，请重新登录')
    window.location.href = '/login'
  } catch (err: any) {
    message.error(`保存失败: ${err.message}`)
  } finally {
    savingAccount.value = false
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
