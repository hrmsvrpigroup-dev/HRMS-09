import { Response } from 'express'
import { prisma } from '../config/database'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendError, sendSuccess } from '../utils/response.utils'
import { LeaveType, LeaveStatus } from '@prisma/client'
import { getTenantMonthCalendar } from './calendar.controller'

export const leaveController = {
  async list(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) {
      return sendError(res, 'Tenant context not found', 400)
    }

    const whereClause: any = { tenantId }
    if (req.user?.role === 'EMPLOYEE') {
      whereClause.employee = { userId: req.user.id }
    } else if (req.user?.role === 'HR') {
      whereClause.employee = { hrUserId: req.user.id }
    }

    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : (req.query.take ? parseInt(req.query.take as string, 10) : undefined)
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : undefined

      const items = await prisma.leave.findMany({
        where: whereClause,
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeCode: true, email: true },
          },
          approvedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(limit ? { take: limit } : {}),
        ...(skip ? { skip: skip } : {}),
      })

      return sendSuccess(res, items)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to list leave requests', 500)
    }
  },

  async getNotifications(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) {
      return sendError(res, 'Tenant context not found', 400)
    }

    try {
      const items = await prisma.leave.findMany({
        where: {
          tenantId,
          status: LeaveStatus.PENDING,
        },
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeCode: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      })

      return sendSuccess(res, items)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch leave notifications', 500)
    }
  },

  async create(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const userId = req.user?.id

    if (!tenantId || !userId) {
      return sendError(res, 'Unauthorized', 401)
    }

    const { type, fromDate, toDate, reason } = req.body

    if (!type || !fromDate || !toDate || !reason) {
      return sendError(res, 'Required fields type, fromDate, toDate, reason are missing.', 400)
    }

    const ALLOWED_LEAVE_TYPES = new Set<string>([LeaveType.CASUAL, LeaveType.SICK, LeaveType.MATERNITY])
    if (!ALLOWED_LEAVE_TYPES.has(type)) {
      return sendError(res, 'Only Casual Leave, Emergency Leave / Sick Leave, and Maternity Leave are allowed.', 400)
    }

    try {
      // Find employee
      const employee = await prisma.employee.findUnique({
        where: { userId },
      })
      if (!employee) {
        return sendError(res, 'Employee profile not found.', 404)
      }

      const fromStr = String(fromDate).split('T')[0]
      const toStr = String(toDate).split('T')[0]
      const from = new Date(`${fromStr}T00:00:00.000Z`)
      const to = new Date(`${toStr}T00:00:00.000Z`)

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return sendError(res, 'Invalid start or end date.', 400)
      }
      if (to < from) {
        return sendError(res, 'End date cannot be earlier than start date.', 400)
      }

      const diffMs = to.getTime() - from.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1

      if (type === LeaveType.CASUAL) {
        if (diffDays > 1) {
          return sendError(res, 'Casual Leave is allowed for only 1 day per month.', 400)
        }
        const dayOfWeek = from.getUTCDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
        if (dayOfWeek === 1 || dayOfWeek === 5) {
          return sendError(res, 'Casual Leave is not allowed on Monday or Friday.', 400)
        }
      }

      if (type === LeaveType.SICK && diffDays > 1) {
        return sendError(res, 'Emergency Leave / Sick Leave is allowed for only 1 day per month.', 400)
      }

      if (type === LeaveType.CASUAL || type === LeaveType.SICK) {
        const calMonth = await getTenantMonthCalendar(tenantId, from.getUTCFullYear(), from.getUTCMonth() + 1)
        const dayInfo = calMonth?.days?.[fromStr]
        if (dayInfo && !dayInfo.isWorkingDay) {
          const reasonLabel = dayInfo.holiday ? `${dayInfo.holiday.title} (Holiday)` : 'a scheduled Week Off'
          return sendError(res, `Leave is not required on ${reasonLabel}.`, 400)
        }
      }

      if (type === LeaveType.CASUAL || type === LeaveType.SICK) {
        const year = from.getUTCFullYear()
        const month = from.getUTCMonth()
        const monthStart = new Date(Date.UTC(year, month, 1))
        const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999))

        const existingMonthLeaves = await prisma.leave.findMany({
          where: {
            employeeId: employee.id,
            type: type as LeaveType,
            status: { notIn: [LeaveStatus.REJECTED, LeaveStatus.CANCELLED] },
            fromDate: { gte: monthStart, lte: monthEnd },
          },
          select: { days: true },
        })
        const usedDays = existingMonthLeaves.reduce((sum, item) => sum + (item.days || 1), 0)
        if (usedDays + diffDays > 1) {
          const label = type === LeaveType.CASUAL ? 'Casual Leave' : 'Emergency Leave / Sick Leave'
          return sendError(res, `${label} limit reached: only 1 day per month is allowed.`, 400)
        }
      }

      const leave = await prisma.leave.create({
        data: {
          tenantId,
          employeeId: employee.id,
          type: type as LeaveType,
          fromDate: from,
          toDate: to,
          days: diffDays,
          reason,
          status: LeaveStatus.PENDING,
        },
      })

      return sendSuccess(res, leave, 'Leave request submitted successfully', 201)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to submit leave request', 500)
    }
  },

  async approve(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const officerId = req.user?.id
    const { id } = req.params
    const { status } = req.body

    if (!tenantId || !officerId) {
      return sendError(res, 'Unauthorized', 401)
    }

    if (!status || !Object.values(LeaveStatus).includes(status)) {
      return sendError(res, 'A valid leave approval status (APPROVED/REJECTED) is required.', 400)
    }

    try {
      const leaveRequest = await prisma.leave.findUnique({
        where: { id },
        include: { employee: true },
      })

      if (!leaveRequest || leaveRequest.tenantId !== tenantId) {
        return sendError(res, 'Leave request not found.', 404)
      }

      if (req.user?.role === 'HR' && leaveRequest.employee?.hrUserId !== officerId) {
        return sendError(res, 'Unauthorized to approve this leave request.', 403)
      }

      if (leaveRequest.status !== LeaveStatus.PENDING) {
        return sendError(res, 'This leave request has already been processed.', 400)
      }

      const updatedLeave = await prisma.leave.update({
        where: { id },
        data: {
          status: status as LeaveStatus,
          approvedById: officerId,
          approvedAt: new Date(),
        },
      })

      return sendSuccess(res, updatedLeave, `Leave request status successfully updated to ${status}`)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to process leave request', 500)
    }
  },
}
