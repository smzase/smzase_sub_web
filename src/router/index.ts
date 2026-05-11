import { createRouter, createWebHistory } from 'vue-router'
import UploadView from '../views/UploadView.vue'
import SubtitleView from '../views/SubtitleView.vue'
import FontView from '../views/FontView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/upload' },
    { path: '/upload', component: UploadView },
    { path: '/subtitles', component: SubtitleView },
    { path: '/fonts', component: FontView },
  ],
})

export default router
