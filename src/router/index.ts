import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import UploadView from '../views/UploadView.vue'
import SubtitleView from '../views/SubtitleView.vue'
import FontView from '../views/FontView.vue'
import SettingsView from '../views/SettingsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/upload' },
    { path: '/login', component: LoginView },
    { path: '/upload', component: UploadView },
    { path: '/subtitles', component: SubtitleView },
    { path: '/fonts', component: FontView },
    { path: '/settings', component: SettingsView },
  ],
})

export default router
