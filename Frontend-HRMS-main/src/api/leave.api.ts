import api from './axios'

export type LeaveItem = {
  id: string
  employeeId: string
  type: 'CASUAL' | 'SICK' | 'EARNED' | 'MATERNITY' | 'PATERNITY' | 'UNPAID'
  fromDate: string
  toDate: string
  days: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  approvedById?: string
  approvedAt?: string
  createdAt: string
  employee?: {
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
  approvedBy?: {
    firstName: string
    lastName: string
  }
}

export const leaveApi = {
  list: () => api.get<{ success: boolean; data: LeaveItem[] }>('/leaves'),
  getNotifications: () => api.get<{ success: boolean; data: LeaveItem[] }>('/leaves/notifications'),
  create: (data: { type: string; fromDate: string; toDate: string; reason: string }) =>
    api.post<{ success: boolean; data: LeaveItem }>('/leaves', data),
  approve: (id: string, status: 'APPROVED' | 'REJECTED') =>
    api.patch<{ success: boolean; data: LeaveItem }>(`/leaves/${id}`, { status }),
}
