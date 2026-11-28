import { Request, Response } from 'express'
import { prisma } from '../config/database'
import { sendSuccess, sendError } from '../utils/response.utils'

export const employeeRequestController = {
  async createRequest(req: Request, res: Response) {
    try {
      const user = (req as any).user
      if (!user || !user.tenantId) {
        return sendError(res, 'Unauthorized or tenant context missing', 401)
      }

      // Check if user is an employee
      const employee = await prisma.employee.findUnique({
        where: { userId: user.id }
      })

      if (!employee) {
        return sendError(res, 'Only employees can create operations requests', 403)
      }

      const { type, priority, description } = req.body

      if (!type || !description) {
        return sendError(res, 'Type and description are required', 400)
      }

      const employeeRequest = await prisma.employeeRequest.create({
        data: {
          tenantId: user.tenantId,
          employeeId: employee.id,
          type,
          priority: priority || 'MEDIUM',
          description,
          status: 'PENDING'
        }
      })

      return sendSuccess(res, employeeRequest, 'Request created successfully', 201)
    } catch (error: any) {
      console.error('Error creating employee request:', error)
      return sendError(res, error.message || 'Failed to create request', 500)
    }
  },

  async listRequests(req: Request, res: Response) {
    try {
      const user = (req as any).user
      if (!user || !user.tenantId) {
        return sendError(res, 'Unauthorized', 401)
      }

      if (user.role === 'HR' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        const allRequests = await prisma.employeeRequest.findMany({
          where: { tenantId: user.tenantId },
          include: {
            employee: {
              select: { firstName: true, lastName: true, employeeCode: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
        return sendSuccess(res, allRequests)
      }

      const employee = await prisma.employee.findUnique({
        where: { userId: user.id }
      })

      if (!employee) {
        return sendError(res, 'Employee profile not found', 404)
      }

      const requests = await prisma.employeeRequest.findMany({
        where: {
          tenantId: user.tenantId,
          employeeId: employee.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return sendSuccess(res, requests, 'Requests fetched successfully')
    } catch (error: any) {
      console.error('Error fetching employee requests:', error)
      return sendError(res, 'Failed to fetch requests', 500)
    }
  },

  async deleteRequest(req: Request, res: Response) {
    try {
      const { id } = req.params
      const user = (req as any).user

      if (!user || !user.tenantId) {
        return sendError(res, 'Unauthorized', 401)
      }

      if (user.role === 'HR' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        const allRequests = await prisma.employeeRequest.findMany({
          where: { tenantId: user.tenantId },
          include: {
            employee: {
              select: { firstName: true, lastName: true, employeeCode: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
        return sendSuccess(res, allRequests)
      }

      const employee = await prisma.employee.findUnique({
        where: { userId: user.id }
      })

      if (!employee) {
        return sendError(res, 'Employee profile not found', 404)
      }

      const existingRequest = await prisma.employeeRequest.findUnique({
        where: { id }
      })

      if (!existingRequest) {
        return sendError(res, 'Request not found', 404)
      }

      if (existingRequest.tenantId !== user.tenantId || existingRequest.employeeId !== employee.id) {
        return sendError(res, 'Unauthorized to delete this request', 403)
      }

      if (existingRequest.status !== 'PENDING') {
        return sendError(res, 'Only PENDING requests can be deleted', 400)
      }

      await prisma.employeeRequest.delete({
        where: { id }
      })

      return sendSuccess(res, null, 'Request deleted successfully')
    } catch (error: any) {
      console.error('Error deleting employee request:', error)
      return sendError(res, 'Failed to delete request', 500)
    }
  }
}
