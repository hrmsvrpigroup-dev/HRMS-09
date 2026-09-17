import dotenv from 'dotenv'
dotenv.config()

import http from 'node:http'
import dns from 'node:dns'

// Force IPv4 first to fix ENETUNREACH errors on Render for external services like Gmail SMTP
dns.setDefaultResultOrder('ipv4first')

import { Server as SocketServer } from 'socket.io'

import app from './app'
import { prisma } from './config/database'
import { redis } from './config/redis'
import { authService } from './services/auth.service'
import { setSocketServer } from './config/socket'
import { runAttendanceJob } from './jobs/attendance.job'
import { syncAllAttendanceToGoogleSheet } from './services/googleSheets.service'

const PORT = Number(process.env.PORT ?? 5000)

const bootstrap = async () => {
  await prisma.$connect()
  if (redis) {
    try {
      await redis.connect()
    } catch {
      // Redis is optional in local dev bootstrap.
    }
  }

  await authService.ensureSuperAdmin()

  // Run auto clock-out checks immediately and every 5 minutes
  runAttendanceJob().catch((err) => console.error('[JOBS] Initial run of attendance job failed:', err))
  setInterval(() => {
    runAttendanceJob().catch((err) => console.error('[JOBS] Periodic run of attendance job failed:', err))
  }, 5 * 60 * 1000)

  // Trigger background backfill sync to Google Sheets on startup to guarantee zero data loss
  syncAllAttendanceToGoogleSheet().catch((err) => console.error('[GOOGLE_SHEETS] Startup sync failed:', err))

  // Keep-alive self ping to prevent Render free-tier instance from sleeping (every 10 minutes)
  const KEEP_ALIVE_URL = process.env.BACKEND_PUBLIC_URL || 'https://hrms-09.onrender.com/api/health'
  const pingKeepAlive = () => {
    try {
      const parsedUrl = new URL(KEEP_ALIVE_URL)
      const isHttps = parsedUrl.protocol === 'https:'
      const client = isHttps ? require('node:https') : require('node:http')
      const req = client.get(KEEP_ALIVE_URL, (res: any) => {
        // eslint-disable-next-line no-console
        console.log(`[KEEP-ALIVE] Pinged ${KEEP_ALIVE_URL} - Status: ${res.statusCode}`)
      })
      req.on('error', (e: any) => {
        // eslint-disable-next-line no-console
        console.warn(`[KEEP-ALIVE] Ping warning: ${e.message}`)
      })
      req.setTimeout(10000, () => req.destroy())
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[KEEP-ALIVE] Error scheduling ping:', e.message)
    }
  }
  // Run first keep-alive ping after 2 minutes, then every 10 minutes
  setTimeout(pingKeepAlive, 2 * 60 * 1000)
  setInterval(pingKeepAlive, 10 * 60 * 1000)

  const server = http.createServer(app)

  // ── Socket.IO ──────────────────────────────────────────────────────────────
  const io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  setSocketServer(io)

  io.on('connection', (socket) => {
    // Desktop joins a room named after the session ID to receive live updates
    socket.on('join-session', (sessionId: string) => {
      socket.join(`session:${sessionId}`)
    })
  })
  // ──────────────────────────────────────────────────────────────────────────

  server.listen(PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`HRMS backend running on http://0.0.0.0:${PORT}`)
  })
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start backend', error)
  process.exit(1)
})

