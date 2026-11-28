import api from './axios'

export type PortalAlertCategory = 'HOLIDAY' | 'IMPORTANT_NEWS' | 'URGENT_ALERT' | 'GENERAL'
export type PortalAlertPriority = 'INFO' | 'IMPORTANT' | 'WARNING' | 'URGENT'

export interface PortalAlertRecipientItem {
  id: string
  employeeId: string
  acknowledgedAt: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
}

export interface PortalAlertItem {
  id: string
  category: PortalAlertCategory
  priority: PortalAlertPriority
  title: string
  message: string
  targetAllUnderHr: boolean
  showAsPopup: boolean
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  createdByName: string | null
  acknowledgedCount: number
  totalTargets: number
  recipients: PortalAlertRecipientItem[]
}

export interface EmployeeActiveAlertItem {
  id: string
  category: PortalAlertCategory
  priority: PortalAlertPriority
  title: string
  message: string
  createdByName: string | null
  createdAt: string
}

export const alertApi = {
  list: () => api.get<{ success: boolean; data: PortalAlertItem[] }>('/alerts'),
  create: (payload: {
    title: string
    message: string
    category: PortalAlertCategory
    priority: PortalAlertPriority
    targetAllUnderHr: boolean
    employeeIds: string[]
    showAsPopup: boolean
    expiryPreset: 'UNTIL_OFF' | '10M' | '1H' | 'TODAY' | '7D'
  }) => api.post<{ success: boolean; data: PortalAlertItem; message: string }>('/alerts', payload),
  toggle: (id: string) => api.patch<{ success: boolean; data: PortalAlertItem; message: string }>(`/alerts/${id}/toggle`),
  remove: (id: string) => api.delete<{ success: boolean; message: string }>(`/alerts/${id}`),
  getMyActive: () => api.get<{ success: boolean; data: EmployeeActiveAlertItem[] }>('/alerts/my-active'),
  acknowledge: (id: string) => api.post<{ success: boolean; message: string }>(`/alerts/${id}/acknowledge`),
}

