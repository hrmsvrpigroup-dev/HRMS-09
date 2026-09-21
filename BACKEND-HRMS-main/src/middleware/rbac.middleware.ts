import { NextFunction, Response } from 'express'

import { AuthRequest } from './auth.middleware'

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || (!roles.includes(req.user.role) && req.user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' })
    }
    next()
  }
}

