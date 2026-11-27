import { Response } from 'express'
import { CalendarHolidayType } from '@prisma/client'
import { prisma } from '../config/database'
import { AuthRequest } from '../middleware/auth.middleware'
import { sendError, sendSuccess } from '../utils/response.utils'

export type DayScheduleStatus =
  | 'WORKING_DAY'
  | 'PUBLIC_HOLIDAY'
  | 'COMPANY_HOLIDAY'
  | 'CUSTOM_HOLIDAY'
  | 'WEEK_OFF'
  | 'SPECIAL_WORKING'

const DEFAULT_SCHEDULE = {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
}

const calendarCache = new Map<string, { data: any; expiresAt: number }>()
const CACHE_TTL_MS = 30_000

async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (msg.includes('Closed') || err?.code === 'P1017' || err?.code === 'P1001') {
      return await fn()
    }
    throw err
  }
}

export const invalidateCalendarCache = (tenantId?: string) => {
  if (!tenantId) {
    calendarCache.clear()
    return
  }
  for (const key of calendarCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      calendarCache.delete(key)
    }
  }
}

const isWeekdayWorking = (
  schedule: typeof DEFAULT_SCHEDULE,
  utcDay: number
): boolean => {
  switch (utcDay) {
    case 0: return schedule.sunday
    case 1: return schedule.monday
    case 2: return schedule.tuesday
    case 3: return schedule.wednesday
    case 4: return schedule.thursday
    case 5: return schedule.friday
    case 6: return schedule.saturday
    default: return true
  }
}

export async function getTenantMonthCalendar(tenantId: string, year: number, month: number) {
  const cacheKey = `${tenantId}:${year}-${month}`
  const cached = calendarCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1))
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  const [scheduleRow, holidays] = await withDbRetry(() =>
    Promise.all([
      prisma.workSchedule.findUnique({ where: { tenantId } }),
      prisma.calendarHoliday.findMany({
        where: {
          tenantId,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: 'asc' },
      }),
    ])
  )

  const workSchedule = scheduleRow
    ? {
        monday: scheduleRow.monday,
        tuesday: scheduleRow.tuesday,
        wednesday: scheduleRow.wednesday,
        thursday: scheduleRow.thursday,
        friday: scheduleRow.friday,
        saturday: scheduleRow.saturday,
        sunday: scheduleRow.sunday,
      }
    : { ...DEFAULT_SCHEDULE }

  const holidayByDate = new Map<string, (typeof holidays)[number]>()
  for (const h of holidays) {
    const key = h.date.toISOString().split('T')[0]
    holidayByDate.set(key, h)
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days: Record<
    string,
    {
      date: string
      status: DayScheduleStatus
      isWorkingDay: boolean
      holiday: {
        id: string
        title: string
        type: CalendarHolidayType
        description: string | null
        isOptional: boolean
      } | null
    }
  > = {}

  let workingDays = 0
  let holidaysCount = 0
  let weekOffs = 0
  let specialWorkingDays = 0

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, month - 1, d))
    const dateStr = dt.toISOString().split('T')[0]
    const h = holidayByDate.get(dateStr) || null

    let status: DayScheduleStatus
    if (h) {
      status = h.type as DayScheduleStatus
    } else {
      status = isWeekdayWorking(workSchedule, dt.getUTCDay()) ? 'WORKING_DAY' : 'WEEK_OFF'
    }

    const isWorkingDay = status === 'WORKING_DAY' || status === 'SPECIAL_WORKING'
    if (status === 'SPECIAL_WORKING') {
      specialWorkingDays++
      workingDays++
    } else if (status === 'WORKING_DAY') {
      workingDays++
    } else if (status === 'WEEK_OFF') {
      weekOffs++
    } else {
      holidaysCount++
    }

    days[dateStr] = {
      date: dateStr,
      status,
      isWorkingDay,
      holiday: h
        ? {
            id: h.id,
            title: h.title,
            type: h.type,
            description: h.description,
            isOptional: h.isOptional,
          }
        : null,
    }
  }

  const payload = {
    year,
    month,
    workSchedule,
    holidays: holidays.map((h) => ({
      id: h.id,
      date: h.date.toISOString().split('T')[0],
      title: h.title,
      type: h.type,
      description: h.description,
      isOptional: h.isOptional,
    })),
    days,
    summary: {
      workingDays,
      holidaysCount,
      weekOffs,
      specialWorkingDays,
    },
  }

  if (calendarCache.size > 200) calendarCache.clear()
  calendarCache.set(cacheKey, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS })
  return payload
}

export const calendarController = {
  async getMonth(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) {
      return sendError(res, 'Tenant context not found', 400)
    }

    const now = new Date()
    const year = Number(req.query.year) || now.getFullYear()
    const month = Number(req.query.month) || now.getMonth() + 1

    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return sendError(res, 'Invalid year or month', 400)
    }

    try {
      const data = await getTenantMonthCalendar(tenantId, year, month)
      return sendSuccess(res, data)
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to fetch calendar month', 500)
    }
  },

  async listHolidays(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) {
      return sendError(res, 'Tenant context not found', 400)
    }

    const year = Number(req.query.year) || new Date().getFullYear()
    const start = new Date(Date.UTC(year, 0, 1))
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

    try {
      const holidays = await withDbRetry(() =>
        prisma.calendarHoliday.findMany({
          where: { tenantId, date: { gte: start, lte: end } },
          orderBy: { date: 'asc' },
        })
      )
      return sendSuccess(
        res,
        holidays.map((h) => ({
          id: h.id,
          date: h.date.toISOString().split('T')[0],
          title: h.title,
          type: h.type,
          description: h.description,
          isOptional: h.isOptional,
        }))
      )
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to list holidays', 500)
    }
  },

  async updateSchedule(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) {
      return sendError(res, 'Tenant context not found', 400)
    }

    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body as Record<string, boolean>

    try {
      const updated = await prisma.workSchedule.upsert({
        where: { tenantId },
        update: {
          ...(typeof monday === 'boolean' ? { monday } : {}),
          ...(typeof tuesday === 'boolean' ? { tuesday } : {}),
          ...(typeof wednesday === 'boolean' ? { wednesday } : {}),
          ...(typeof thursday === 'boolean' ? { thursday } : {}),
          ...(typeof friday === 'boolean' ? { friday } : {}),
          ...(typeof saturday === 'boolean' ? { saturday } : {}),
          ...(typeof sunday === 'boolean' ? { sunday } : {}),
          updatedById: req.user?.id,
        },
        create: {
          tenantId,
          monday: typeof monday === 'boolean' ? monday : true,
          tuesday: typeof tuesday === 'boolean' ? tuesday : true,
          wednesday: typeof wednesday === 'boolean' ? wednesday : true,
          thursday: typeof thursday === 'boolean' ? thursday : true,
          friday: typeof friday === 'boolean' ? friday : true,
          saturday: typeof saturday === 'boolean' ? saturday : false,
          sunday: typeof sunday === 'boolean' ? sunday : false,
          updatedById: req.user?.id,
        },
      })

      invalidateCalendarCache(tenantId)
      return sendSuccess(res, updated, 'Weekly working days updated successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update work schedule', 500)
    }
  },

  async upsertHoliday(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    if (!tenantId) {
      return sendError(res, 'Tenant context not found', 400)
    }

    const { date, title, type, description, isOptional } = req.body as {
      date?: string
      title?: string
      type?: CalendarHolidayType
      description?: string
      isOptional?: boolean
    }

    if (!date || !title?.trim()) {
      return sendError(res, 'Date and title are required', 400)
    }

    const dateStr = String(date).split('T')[0]
    const parsedDate = new Date(`${dateStr}T00:00:00.000Z`)
    if (isNaN(parsedDate.getTime())) {
      return sendError(res, 'Invalid date format', 400)
    }

    const holidayType: CalendarHolidayType =
      type && Object.values(CalendarHolidayType).includes(type)
        ? type
        : CalendarHolidayType.PUBLIC_HOLIDAY

    try {
      const saved = await prisma.calendarHoliday.upsert({
        where: {
          tenantId_date: {
            tenantId,
            date: parsedDate,
          },
        },
        update: {
          title: title.trim(),
          type: holidayType,
          description: description?.trim() || null,
          isOptional: Boolean(isOptional),
        },
        create: {
          tenantId,
          date: parsedDate,
          title: title.trim(),
          type: holidayType,
          description: description?.trim() || null,
          isOptional: Boolean(isOptional),
          createdById: req.user?.id,
        },
      })

      invalidateCalendarCache(tenantId)
      return sendSuccess(
        res,
        {
          id: saved.id,
          date: saved.date.toISOString().split('T')[0],
          title: saved.title,
          type: saved.type,
          description: saved.description,
          isOptional: saved.isOptional,
        },
        'Calendar entry saved successfully',
        201
      )
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to save holiday', 500)
    }
  },

  async deleteHoliday(req: AuthRequest, res: Response) {
    const tenantId = req.tenantId ?? req.user?.tenantId
    const { id } = req.params
    if (!tenantId || !id) {
      return sendError(res, 'Context not found', 400)
    }

    try {
      const existing = await prisma.calendarHoliday.findUnique({ where: { id } })
      if (!existing || existing.tenantId !== tenantId) {
        return sendError(res, 'Calendar entry not found', 404)
      }

      await prisma.calendarHoliday.delete({ where: { id } })
      invalidateCalendarCache(tenantId)
      return sendSuccess(res, null, 'Calendar entry removed successfully')
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to remove holiday', 500)
    }
  },
}

