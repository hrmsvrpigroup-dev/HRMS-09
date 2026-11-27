import api from './axios'

export type TrainingSessionType = 'TRAINING' | 'MEETING'
export type TrainingSessionStatus = 'SCHEDULED' | 'CANCELLED'
export type TrainingParticipantStatus = 'PENDING' | 'ATTENDED' | 'ABSENT'
export type AttendanceOverrideMode = 'NONE' | 'SESSION_ONLY' | 'HALF_DAY' | 'FULL_DAY'

export interface TrainingParticipantItem {
  id: string
  sessionId: string
  employeeId: string
  attendanceStatus: TrainingParticipantStatus
  overrideMode: AttendanceOverrideMode
  deductedMinutes: number
  hrNotes: string | null
  markedAt: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    email: string
  }
}

export interface TrainingSessionItem {
  id: string
  sessionType: TrainingSessionType
  title: string
  trainerName: string
  sessionDate: string
  timeSlot: string
  duration: string
  teamsUrl: string | null
  meetingId: string | null
  passcode: string | null
  agenda: string | null
  status?: TrainingSessionStatus
  cancelledAt?: string | null
  cancelReason?: string | null
  participants: TrainingParticipantItem[]
}

export interface MyTrainingSessionItem {
  participantId: string
  attendanceStatus: TrainingParticipantStatus
  overrideMode: AttendanceOverrideMode
  deductedMinutes: number
  hrNotes: string | null
  id: string
  sessionType: TrainingSessionType
  title: string
  trainerName: string
  sessionDate: string
  timeSlot: string
  duration: string
  teamsUrl: string | null
  meetingId: string | null
  passcode: string | null
  agenda: string | null
  status?: TrainingSessionStatus
  cancelledAt?: string | null
  cancelReason?: string | null
}

export const trainingApi = {
  listSessions: (params: { year?: number; month?: number; date?: string }) =>
    api.get<{ success: boolean; data: TrainingSessionItem[] }>('/training/sessions', { params }),
  getMySessions: (params: { year?: number; month?: number; today?: boolean }) =>
    api.get<{ success: boolean; data: MyTrainingSessionItem[] }>('/training/my-sessions', { params }),
  markAttendance: (
    sessionId: string,
    payload: {
      employeeId: string
      attendanceStatus: TrainingParticipantStatus
      overrideMode: AttendanceOverrideMode
      hrNotes?: string
    }
  ) =>
    api.patch<{ success: boolean; data: TrainingParticipantItem; message: string }>(
      `/training/sessions/${sessionId}/attendance`,
      payload
    ),
  cancelSession: (sessionId: string, reason?: string) =>
    api.patch<{ success: boolean; data: TrainingSessionItem; message: string }>(
      `/training/sessions/${sessionId}/cancel`,
      { reason }
    ),
}

