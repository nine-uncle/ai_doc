import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:3001'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      dedupe: ['@tiptap/core', '@tiptap/pm', '@tiptap/vue-3'],
    },
    optimizeDeps: {
      include: ['@tiptap/vue-3', '@tiptap/starter-kit', '@tiptap/core'],
    },
    server: {
      port: Number(env.VITE_PORT || 5174),
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
