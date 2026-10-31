import { Response } from 'express'
import { prisma } from '../config/database'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendError, sendSuccess } from '../utils/response.utils'
import { LeaveType, LeaveStatus } from '@prisma/client'

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

    try {
      // Find employee
      const employee = await prisma.employee.findUnique({
        where: { userId },
      })
      if (!employee) {
        return sendError(res, 'Employee profile not found.', 404)
      }

      const from = new Date(fromDate)
      const to = new Date(toDate)
      const diffMs = to.getTime() - from.getTime()
      const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)

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
