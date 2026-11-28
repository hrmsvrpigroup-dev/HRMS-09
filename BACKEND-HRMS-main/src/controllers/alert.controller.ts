import { Response } from 'express'
import { PortalAlertCategory, PortalAlertPriority } from '@prisma/client'
import { prisma } from '../config/database'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendError, sendSuccess } from '../utils/response.utils'

export const alertController = {
  async listAlerts(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const userId = req.user?.id
    if (!tenantId || !userId) return sendError(res, 'Unauthorized', 401)

    try {
      const alerts = await prisma.portalAlert.findMany({
        where: {
          tenantId,
          ...(req.user?.role === 'HR' ? { createdById: userId } : {}),
        },
        include: {
          recipients: {
            include: {
              employee: {
                select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      const formatted = alerts.map((a) => {
        const acknowledgedCount = a.recipients.filter((r) => r.acknowledgedAt !== null).length
        return {
          ...a,
          acknowledgedCount,
          totalTargets: a.recipients.length,
        }
      })

      return sendSuccess(res, formatted)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch alerts', 500)
    }
  },

  async createAlert(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const userId = req.user?.id
    if (!tenantId || !userId) return sendError(res, 'Unauthorized', 401)

    const {
      title,
      message,
      category = 'IMPORTANT_NEWS',
      priority = 'IMPORTANT',
      targetAllUnderHr = false,
      employeeIds = [],
      showAsPopup = true,
      expiryPreset = 'UNTIL_OFF',
    } = req.body as {
      title?: string
      message?: string
      category?: PortalAlertCategory
      priority?: PortalAlertPriority
      targetAllUnderHr?: boolean
      employeeIds?: string[]
      showAsPopup?: boolean
      expiryPreset?: 'UNTIL_OFF' | '10M' | '1H' | 'TODAY' | '7D'
    }

    if (!title?.trim() || !message?.trim()) {
      return sendError(res, 'Title and message are required.', 400)
    }

    let expiresAt: Date | null = null
    const now = Date.now()
    if (expiryPreset === '10M') expiresAt = new Date(now + 10 * 60 * 1000)
    else if (expiryPreset === '1H') expiresAt = new Date(now + 60 * 60 * 1000)
    else if (expiryPreset === 'TODAY') {
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      expiresAt = end
    } else if (expiryPreset === '7D') expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000)

    try {
      let targetEmployees: Array<{ id: string }> = []
      if (targetAllUnderHr) {
        targetEmployees = await prisma.employee.findMany({
          where: {
            tenantId,
            status: 'ACTIVE',
            ...(req.user?.role === 'HR' ? { OR: [{ hrUserId: userId }, { hrUserId: null }] } : {}),
          },
          select: { id: true },
        })
      } else if (Array.isArray(employeeIds) && employeeIds.length > 0) {
        targetEmployees = await prisma.employee.findMany({
          where: { tenantId, id: { in: employeeIds } },
          select: { id: true },
        })
      }

      if (targetEmployees.length === 0) {
        return sendError(res, 'Please select at least one employee or enable All Employees Under HR.', 400)
      }

      const resolvedCategory = Object.values(PortalAlertCategory).includes(category)
        ? category
        : PortalAlertCategory.IMPORTANT_NEWS
      const resolvedPriority = Object.values(PortalAlertPriority).includes(priority)
        ? priority
        : PortalAlertPriority.IMPORTANT

      const created = await prisma.portalAlert.create({
        data: {
          tenantId,
          createdById: userId,
          createdByName: req.user?.email || 'HR',
          category: resolvedCategory,
          priority: resolvedPriority,
          title: title.trim(),
          message: message.trim(),
          targetAllUnderHr: Boolean(targetAllUnderHr),
          showAsPopup: Boolean(showAsPopup),
          isActive: true,
          expiresAt,
          recipients: {
            create: targetEmployees.map((emp) => ({
              tenantId,
              employeeId: emp.id,
            })),
          },
        },
        include: {
          recipients: {
            include: {
              employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true } },
            },
          },
        },
      })

      return sendSuccess(
        res,
        { ...created, acknowledgedCount: 0, totalTargets: created.recipients.length },
        `Alert published to ${created.recipients.length} employee(s).`,
        201
      )
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to create alert', 500)
    }
  },

  async toggleAlert(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const { id } = req.params
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)

    try {
      const existing = await prisma.portalAlert.findFirst({ where: { id, tenantId } })
      if (!existing) return sendError(res, 'Alert not found', 404)

      const updated = await prisma.portalAlert.update({
        where: { id: existing.id },
        data: { isActive: !existing.isActive },
      })
      return sendSuccess(res, updated, `Alert ${updated.isActive ? 'activated' : 'paused'}.`)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to toggle alert', 500)
    }
  },

  async deleteAlert(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const { id } = req.params
    if (!tenantId) return sendError(res, 'Tenant context not found', 400)

    try {
      const existing = await prisma.portalAlert.findFirst({ where: { id, tenantId } })
      if (!existing) return sendError(res, 'Alert not found', 404)

      await prisma.portalAlert.delete({ where: { id: existing.id } })
      return sendSuccess(res, { id: existing.id }, 'Alert deleted successfully.')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to delete alert', 500)
    }
  },

  async getMyActiveAlerts(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const userId = req.user?.id
    if (!tenantId || !userId) return sendError(res, 'Unauthorized', 401)

    try {
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, email: true },
      })
      if (!employee) return sendSuccess(res, [])

      const now = new Date()
      const recipients = await prisma.portalAlertRecipient.findMany({
        where: {
          tenantId,
          employeeId: employee.id,
          acknowledgedAt: null,
          alert: {
            isActive: true,
            showAsPopup: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        },
        include: {
          alert: true,
        },
        orderBy: { alert: { createdAt: 'desc' } },
      })

      return sendSuccess(
        res,
        recipients.map((r) => ({
          id: r.alert.id,
          category: r.alert.category,
          priority: r.alert.priority,
          title: r.alert.title,
          message: r.alert.message,
          createdByName: r.alert.createdByName,
          createdAt: r.alert.createdAt,
        }))
      )
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch active alerts', 500)
    }
  },

  async acknowledgeAlert(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const userId = req.user?.id
    const { id } = req.params
    if (!tenantId || !userId) return sendError(res, 'Unauthorized', 401)

    try {
      const employee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true },
      })
      if (!employee) return sendSuccess(res, { acknowledged: true })

      await prisma.portalAlertRecipient.updateMany({
        where: { alertId: id, tenantId, employeeId: employee.id },
        data: { acknowledgedAt: new Date() },
      })
      return sendSuccess(res, { acknowledged: true }, 'Alert acknowledged.')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to acknowledge alert', 500)
    }
  },
}

