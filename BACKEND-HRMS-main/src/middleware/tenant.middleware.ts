import { NextFunction, Response } from 'express'

import { prisma } from '../config/database'
import { AuthRequest } from './auth.middleware'

const RESERVED_SUBDOMAINS = new Set(['localhost', 'api', 'superadmin', 'www', 'hr', 'admin', 'employee', 'app', 'dashboard', 'portal', 'main', 'login'])

const isIP = (host: string) => {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')
}

const parseSubdomain = (host: string) => {
  const cleanHost = host.split(':')[0]
  if (!cleanHost || isIP(cleanHost)) {
    return ''
  }
  const parts = cleanHost.split('.')
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0]
  }
  if (parts.length < 3) {
    return ''
  }
  return parts[0]
}

export const resolveTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const explicitSubdomain = req.header('x-tenant-subdomain')?.trim().toLowerCase() ?? ''
    let derivedSubdomain = ''

    let fullHost = ''
    if (req.headers.origin) {
      try {
        const originUrl = new URL(req.headers.origin)
        fullHost = originUrl.hostname
        derivedSubdomain = parseSubdomain(originUrl.hostname)
      } catch (e) {
        // Ignore invalid origin
      }
    } else {
      fullHost = req.headers.host ?? ''
      derivedSubdomain = parseSubdomain(fullHost)
    }

    // Ignore Vercel preview/deployment URLs, Render URLs, and ngrok tunnel URLs for tenant resolution
    if (fullHost.includes('vercel.app') || fullHost.includes('onrender.com') || fullHost.includes('ngrok')) {
      derivedSubdomain = ''
    }

    const subdomain = explicitSubdomain || derivedSubdomain

    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
      return next()
    }

    const tenant = await prisma.tenant.findUnique({ where: { subdomain } })
    if (!tenant || tenant.status !== 'ACTIVE') {
      return res.status(404).json({ success: false, message: 'Company portal not found or suspended' })
    }

    req.tenantId = tenant.id
    return next()
  } catch (error) {
    return next(error)
  }
}

export const tenantIsolation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' })
  }

  if (req.user.role === 'SUPER_ADMIN') {
    if (!req.tenantId) {
      try {
        const defaultTenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
        if (defaultTenant) req.tenantId = defaultTenant.id
      } catch (_) {}
    }
    return next()
  }

  const effectiveTenantId = req.user.tenantId || req.tenantId
  if (!effectiveTenantId) {
    return res.status(403).json({ success: false, message: 'Forbidden: tenant context missing' })
  }

  req.tenantId = effectiveTenantId
  return next()
}
