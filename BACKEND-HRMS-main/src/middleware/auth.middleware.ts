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
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user || !user.isActive) {
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
        return res.status(401).json({ success: false, message: 'Your employee portal is inactive. Please contact HR.' })
      }
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    }
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
}

