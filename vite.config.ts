import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/naive-ui')) return 'naive-ui'
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router')) return 'vue-vendor'
        },
      },
    },
  },
})
