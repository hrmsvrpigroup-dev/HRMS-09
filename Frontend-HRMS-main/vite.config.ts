import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file for the current mode (.env, .env.development, .env.production, etc.)
  const env = loadEnv(mode, process.cwd(), '')

  const getApiUrl = () => {
    let url = env.VITE_API_URL
    if (mode === 'production' || process.env.VERCEL) {
      if (!url || url.includes('your-backend') || url.includes('hrms1-kk6q')) {
        return 'https://hrms-09.onrender.com/api'
      }
    }
    if (!url) {
      return 'http://localhost:5000/api'
    }
    url = url.trim()
    if (!url.endsWith('/api')) {
      url = url.replace(/\/$/, '') + '/api'
    }
    return url
  }



  const getWsUrl = () => {
    let url = env.VITE_WS_URL
    if (!url || url.includes('your-backend') || url.includes('hrms1-kk6q')) {
      return 'wss://hrms-09.onrender.com'
    }
    url = url.trim().replace(/\/$/, '')
    if (url.endsWith('/api')) {
      url = url.slice(0, -4)
    }
    if (url.startsWith('https://')) {
      url = 'wss://' + url.substring(8)
    } else if (url.startsWith('http://')) {
      url = 'ws://' + url.substring(7)
    }
    return url
  }

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(getApiUrl()),
      'import.meta.env.VITE_WS_URL': JSON.stringify(getWsUrl()),
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['lucide-react', 'framer-motion'],
            'vendor-charts': ['recharts'],
          },
        },
      },
    },
  }
})



