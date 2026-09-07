import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const target = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // 走同源代理，HttpOnly 的会话 cookie 才能在开发环境正常工作。
    proxy: {
      '/api': { target, changeOrigin: true },
    },
    watch: { usePolling: true },
  },
})
