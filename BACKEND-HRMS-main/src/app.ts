import dotenv from 'dotenv'
dotenv.config()

import cors from 'cors'
import express from 'express'
import path from 'path'
import helmet from 'helmet'
import morgan from 'morgan'

import routes from './routes'
import { errorHandler, notFoundHandler } from './middleware/error.middleware'
import { resolveTenant } from './middleware/tenant.middleware'

const app = express()

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://hrmsvrpigroup.com',
  'https://www.hrmsvrpigroup.com',
  'https://hrms-latest-dusky.vercel.app',
]

// Add FRONTEND_URL or ALLOWED_ORIGINS from env (e.g. Vercel deployment URL)
const envOrigins = (process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS || '').split(',')
envOrigins.forEach(url => {
  const trimmed = url.trim()
  if (trimmed && !allowedOrigins.includes(trimmed)) {
    allowedOrigins.push(trimmed)
  }
})

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  next()
})

const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true)
    
    let isAllowed = allowedOrigins.includes(origin) || 
                    origin.startsWith('http://localhost:') || 
                    origin.startsWith('http://127.0.0.1:')

    try {
      const originHost = new URL(origin).hostname
      
      // Allow IP addresses (e.g. 192.168.x.x, 10.x.x.x, 172.x.x.x, 127.0.0.1)
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(originHost) || originHost.includes(':')) {
        isAllowed = true
      }

      // Allow Vercel deployment domains (*.vercel.app, *.projects.vercel.app, *.vercel.dev)
      if (originHost.includes('vercel')) {
        isAllowed = true
      }

      // Allow Render domains (*.onrender.com)
      if (originHost.includes('onrender.com')) {
        isAllowed = true
      }

      // Allow ngrok deployment/tunnel domains (*.ngrok-free.app, *.ngrok-free.dev, etc.)
      if (originHost.includes('ngrok')) {
        isAllowed = true
      }

      // Allow any subdomain on localhost for development (e.g. tenant.localhost, superadmin.localhost)
      if (originHost.endsWith('.localhost') || originHost === 'localhost') {
        isAllowed = true
      }

      // Allow hrmsvrpigroup.com and any subdomains
      if (originHost === 'hrmsvrpigroup.com' || originHost.endsWith('.hrmsvrpigroup.com')) {
        isAllowed = true
      }

      // Allow any subdomain of production allowed origins (e.g. tenant.domain.com, superadmin.domain.com)
      if (!isAllowed) {
        isAllowed = allowedOrigins.some(allowed => {
          try {
            const allowedHost = new URL(allowed).hostname
            return originHost === allowedHost || originHost.endsWith('.' + allowedHost)
          } catch {
            return false
          }
        })
      }
    } catch (err) {
      console.error('CORS URL parsing error:', err)
    }

    callback(null, isAllowed)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-tenant-id',
    'x-tenant-subdomain',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Root welcome route
app.get('/', (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'HRMS Backend API is running',
    health: '/api/health',
  })
})

// Health check route that bypasses tenant resolution
app.get('/api/health', (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'HRMS API is healthy',
    timestamp: new Date().toISOString(),
  })
})

app.use(resolveTenant)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
app.use('/api', routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app

