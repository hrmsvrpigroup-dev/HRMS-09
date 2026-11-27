import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

import { prisma } from '../config/database'

type AuthUser = {
  id: string
  tenantId: string | null
  role: string
  email: string
}

type TokenPayload = {
  userId: string
}

export interface AuthRequest extends Request {
  user?: AuthUser
  tenantId?: string
}

const AUTH_CACHE_TTL_MS = 15_000
const authUserCache = new Map<string, { user: AuthUser; expiresAt: number }>()

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' })
  }

  try {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      return res.status(500).json({ success: false, message: 'Server misconfiguration: JWT secret not set' })
    }
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload

    const cached = authUserCache.get(decoded.userId)
    if (cached && cached.expiresAt > Date.now()) {
      req.user = cached.user
      return next()
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user || !user.isActive) {
      authUserCache.delete(decoded.userId)
      return res.status(401).json({ success: false, message: 'Your account is inactive. Please contact HR.' })
    }

    if (user.role === 'EMPLOYEE') {
      const emp = await prisma.employee.findFirst({
        where: {
          OR: [
            { userId: user.id },
            { email: user.email }
          ]
        },
        select: { status: true }
      })
      if (emp && emp.status === 'INACTIVE') {
        authUserCache.delete(decoded.userId)
        return res.status(401).json({ success: false, message: 'Your employee portal is inactive. Please contact HR.' })
      }
    }

    const authUser: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    }
    if (authUserCache.size > 500) authUserCache.clear()
    authUserCache.set(decoded.userId, { user: authUser, expiresAt: Date.now() + AUTH_CACHE_TTL_MS })

    req.user = authUser
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

