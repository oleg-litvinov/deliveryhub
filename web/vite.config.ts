import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev, /api is proxied to the deployed stack (VITE_API_TARGET=https://xxxx.cloudfront.net).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: env.VITE_API_TARGET ? { proxy: { '/api': { target: env.VITE_API_TARGET, changeOrigin: true } } } : {},
  }
})
