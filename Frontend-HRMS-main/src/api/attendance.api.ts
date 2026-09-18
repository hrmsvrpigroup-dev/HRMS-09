import api from './axios'

export type AttendanceItem = {
  id: string
  employeeId: string
  date: string
  clockIn?: string
  clockOut?: string
  totalHours?: number
  idleMinutes?: number
  clockInPhoto?: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY'
  notes?: string
  employee?: {
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
  attendanceType?: 'FACIAL' | 'QR' | 'GPS' | 'MANUAL' | 'BOTH'
  hasFaceBaseline?: boolean
  employeeCode?: string
  shift?: string
}

export const attendanceApi = {
  list: (params?: { employeeId?: string; month?: number; year?: number }) => api.get<{ success: boolean; data: AttendanceItem[] }>('/attendance', { params }),
  clockIn: (data?: { faceImage?: string; qrData?: string; clockInPhoto?: string }) => api.post<{ success: boolean; data: AttendanceItem }>('/attendance/clock-in', data),
  manualClockIn: (payload: string | { employeeId: string; date?: string; clockInTime?: string; status?: string; notes?: string }) => {
    const data = typeof payload === 'string' ? { employeeId: payload } : payload
    return api.post<{ success: boolean; data: AttendanceItem }>('/attendance/manual-clock-in', data)
  },
  clockOut: () => api.post<{ success: boolean; data: AttendanceItem }>('/attendance/clock-out'),
  getTodayStatus: () => api.get<{ success: boolean; data: AttendanceItem | null }>('/attendance/today'),
  logIdle: () => api.post<{ success: boolean; data: { idleMinutes: number } }>('/attendance/idle'),
  reset: (id: string) => api.delete<{ success: boolean }>(`/attendance/${id}/reset`),
  continueShift: (id: string) => api.post<{ success: boolean }>(`/attendance/${id}/continue`),
  // Mobile QR attendance
  createMobileQrSession: () => api.post<{ success: boolean; data: { sessionId: string; qrCode: string; expiresAt: string; mobileUrl: string } }>('/attendance/mobile-qr/create'),
  getMobileQrStatus: (sessionId: string) => api.get<{ success: boolean; data: { status: string; accessToken?: string; refreshToken?: string } }>(`/attendance/mobile-qr/status/${sessionId}`),
  verifyMobileSelfie: (data: { sessionId: string; token: string; selfieBase64: string }) => api.post<{ success: boolean; data: any }>('/attendance/mobile-qr/verify', data),
  // Google Sheets Sync
  syncGoogleSheets: () => api.post<{ success: boolean; data: { total: number; synced: number }; message: string }>('/attendance/sync-google-sheets'),
}



