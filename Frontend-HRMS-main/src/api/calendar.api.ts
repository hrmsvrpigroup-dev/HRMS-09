import api from './axios'

export type CalendarHolidayType = 'PUBLIC_HOLIDAY' | 'COMPANY_HOLIDAY' | 'CUSTOM_HOLIDAY' | 'SPECIAL_WORKING'

export type DayScheduleStatus =
  | 'WORKING_DAY'
  | 'PUBLIC_HOLIDAY'
  | 'COMPANY_HOLIDAY'
  | 'CUSTOM_HOLIDAY'
  | 'WEEK_OFF'
  | 'SPECIAL_WORKING'

export interface WorkSchedule {
  monday: boolean
  tuesday: boolean
  wednesday: boolean
  thursday: boolean
  friday: boolean
  saturday: boolean
  sunday: boolean
}

export interface CalendarHoliday {
  id: string
  date: string
  title: string
  type: CalendarHolidayType
  description: string | null
  isOptional: boolean
}

export interface CalendarDayInfo {
  date: string
  status: DayScheduleStatus
  isWorkingDay: boolean
  holiday: CalendarHoliday | null
}

export interface CalendarMonthResponse {
  year: number
  month: number
  workSchedule: WorkSchedule
  holidays: CalendarHoliday[]
  days: Record<string, CalendarDayInfo>
  summary: {
    workingDays: number
    holidaysCount: number
    weekOffs: number
    specialWorkingDays: number
  }
}

export const calendarApi = {
  getMonth: (year: number, month: number) =>
    api.get<{ success: boolean; data: CalendarMonthResponse }>('/calendar/month', {
      params: { year, month },
    }),
  listHolidays: (year: number) =>
    api.get<{ success: boolean; data: CalendarHoliday[] }>('/calendar/holidays', {
      params: { year },
    }),
  updateSchedule: (schedule: Partial<WorkSchedule>) =>
    api.put<{ success: boolean; data: WorkSchedule; message: string }>('/calendar/schedule', schedule),
  upsertHoliday: (payload: {
    date: string
    title: string
    type: CalendarHolidayType
    description?: string
    isOptional?: boolean
  }) => api.post<{ success: boolean; data: CalendarHoliday; message: string }>('/calendar/holidays', payload),
  deleteHoliday: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/calendar/holidays/${id}`),
}

