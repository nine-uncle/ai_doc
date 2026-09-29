import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { collaboraWopiPlugin } from './server/collaboraWopiPlugin.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || 5174)

  return {
    plugins: [
      collaboraWopiPlugin({
        publicWopiOrigin: env.VITE_WOPI_PUBLIC_ORIGIN,
      }),
      vue(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      dedupe: ['vue'],
    },
    server: {
      port,
    },
  }
})
