import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/Sunday-book-club-vue/',
  plugins: [vue()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        'development-report': fileURLToPath(new URL('./development-report.html', import.meta.url)),
      },
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
})
