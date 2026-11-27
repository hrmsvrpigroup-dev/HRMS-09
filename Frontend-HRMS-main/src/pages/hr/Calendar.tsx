import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  CalendarDays,
  Plus,
  Trash2,
  Check,
  X,
  Briefcase,
  Flag,
  Building2,
  Coffee,
  Sparkles,
  Video,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hrApi } from '../../api/hr.api'
import {
  calendarApi,
  CalendarMonthResponse,
  CalendarHoliday,
  CalendarHolidayType,
  DayScheduleStatus,
  WorkSchedule,
} from '../../api/calendar.api'
import {
  trainingApi,
  TrainingSessionItem,
  TrainingParticipantStatus,
  AttendanceOverrideMode,
} from '../../api/training.api'

const DAYS_OF_WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const SCHEDULE_DAY_KEYS: Array<{ key: keyof WorkSchedule; label: string }> = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]

const STATUS_META: Record<
  DayScheduleStatus,
  { label: string; shortLabel: string; dotColor: string; bg: string; color: string; border: string; Icon: typeof Briefcase }
> = {
  WORKING_DAY: { label: 'Working Day', shortLabel: 'Work', dotColor: '#10b981', bg: '#ffffff', color: '#0f172a', border: '#e2e8f0', Icon: Briefcase },
  PUBLIC_HOLIDAY: { label: 'Public Holiday', shortLabel: 'Holiday', dotColor: '#ef4444', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', Icon: Flag },
  COMPANY_HOLIDAY: { label: 'Company Holiday', shortLabel: 'Company', dotColor: '#f97316', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', Icon: Building2 },
  CUSTOM_HOLIDAY: { label: 'Custom Holiday', shortLabel: 'Custom', dotColor: '#ec4899', bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8', Icon: Sparkles },
  WEEK_OFF: { label: 'Week Off', shortLabel: 'Off', dotColor: '#94a3b8', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', Icon: Coffee },
  SPECIAL_WORKING: { label: 'Special Working Day', shortLabel: 'Special', dotColor: '#eab308', bg: '#fefce8', color: '#a16207', border: '#fde047', Icon: Sparkles },
}

export default function HRCalendar() {
  const navigate = useNavigate()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [summaryData, setSummaryData] = useState<Record<string, { activeCount: number; leaveCount: number }>>({})
  const [calendarData, setCalendarData] = useState<CalendarMonthResponse | null>(null)
  const [yearHolidays, setYearHolidays] = useState<CalendarHoliday[]>([])
  const [historyFilter, setHistoryFilter] = useState<'ALL' | CalendarHolidayType>('ALL')
  const [scheduleDraft, setScheduleDraft] = useState<WorkSchedule>({
    monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false,
  })
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  // Holiday / Override Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [holidayForm, setHolidayForm] = useState<{
    date: string
    title: string
    type: CalendarHolidayType
    description: string
  }>({
    date: '',
    title: '',
    type: 'PUBLIC_HOLIDAY',
    description: '',
  })
  const [savingHoliday, setSavingHoliday] = useState(false)
  const [sessions, setSessions] = useState<TrainingSessionItem[]>([])
  const [dayAgendaDate, setDayAgendaDate] = useState<string | null>(null)
  const [agendaFilter, setAgendaFilter] = useState<'ALL' | 'MEETING' | 'TRAINING'>('ALL')
  const [activeSessionModal, setActiveSessionModal] = useState<TrainingSessionItem | null>(null)
  const [savingParticipantId, setSavingParticipantId] = useState<string | null>(null)
  const lastTapRef = useRef<{ dateKey: string; time: number } | null>(null)

  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const fetchAll = useCallback(async () => {
    let hasCached = false
    try {
      const cachedMonth = localStorage.getItem(`hrms_hr_cal_${year}_${month}`)
      if (cachedMonth) {
        const parsed = JSON.parse(cachedMonth)
        setCalendarData(parsed)
        if (parsed?.workSchedule) setScheduleDraft(parsed.workSchedule)
        hasCached = true
      }
      const cachedHol = localStorage.getItem(`hrms_hr_cal_hol_${year}`)
      if (cachedHol) setYearHolidays(JSON.parse(cachedHol))
    } catch {}

    if (!hasCached) setLoading(true)
    try {
      hrApi.getAttendanceSummary(year, month)
        .then((attRes) => setSummaryData(attRes || {}))
        .catch(() => {})

      const [calRes, holRes, sessRes] = await Promise.all([
        calendarApi.getMonth(year, month),
        calendarApi.listHolidays(year),
        trainingApi.listSessions({ year, month }).catch(() => null),
      ])
      if (calRes?.data?.data) {
        setCalendarData(calRes.data.data)
        setScheduleDraft(calRes.data.data.workSchedule)
        try { localStorage.setItem(`hrms_hr_cal_${year}_${month}`, JSON.stringify(calRes.data.data)) } catch {}
      }
      if (holRes?.data?.data) {
        setYearHolidays(holRes.data.data)
        try { localStorage.setItem(`hrms_hr_cal_hol_${year}`, JSON.stringify(holRes.data.data)) } catch {}
      }
      setSessions(sessRes?.data?.data || [])
    } catch (err: any) {
      console.error('Failed to fetch calendar data', err)
      setNotice((prev) => prev || `❌ ${err?.response?.data?.message || 'Could not load latest calendar data. Retrying...'}`)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const goToMonth = (nextYear: number, nextMonthIdx: number) => {
    const next = new Date(nextYear, nextMonthIdx, 1)
    setCurrentDate(next)
    if (next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()) {
      setSelectedDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    } else {
      setSelectedDate(next)
    }
  }

  const prevMonth = () => goToMonth(year, currentDate.getMonth() - 1)
  const nextMonth = () => goToMonth(year, currentDate.getMonth() + 1)

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay()
  const firstDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const prevMonthDays = new Date(year, month - 1, 0).getDate()

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i)

  const handleDateClick = (day: number) => {
    const clicked = new Date(year, month - 1, day)
    setSelectedDate(clicked)
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const now = Date.now()
    if (lastTapRef.current && lastTapRef.current.dateKey === dateKey && now - lastTapRef.current.time < 320) {
      setAgendaFilter('ALL')
      setDayAgendaDate(dateKey)
      lastTapRef.current = null
    } else {
      lastTapRef.current = { dateKey, time: now }
    }
  }

  const handleDateDoubleClick = (day: number) => {
    setSelectedDate(new Date(year, month - 1, day))
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setAgendaFilter('ALL')
    setDayAgendaDate(dateKey)
  }

  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
  const selectedDayData = summaryData[selectedDateStr] || { activeCount: 0, leaveCount: 0 }
  const selectedDayInfo = calendarData?.days?.[selectedDateStr]
  const selectedDayStatus: DayScheduleStatus = selectedDayInfo?.status || 'WORKING_DAY'
  const selectedMeta = STATUS_META[selectedDayStatus]
  const SelectedIcon = selectedMeta.Icon

  const sessionsByDate = sessions.reduce<Record<string, TrainingSessionItem[]>>((acc, s) => {
    if (!acc[s.sessionDate]) acc[s.sessionDate] = []
    acc[s.sessionDate].push(s)
    return acc
  }, {})
  const selectedDaySessions = sessionsByDate[selectedDateStr] || []

  const handleMarkSessionAttendance = async (
    sessionId: string,
    employeeId: string,
    attendanceStatus: TrainingParticipantStatus,
    overrideMode: AttendanceOverrideMode
  ) => {
    setSavingParticipantId(employeeId)
    try {
      const res = await trainingApi.markAttendance(sessionId, {
        employeeId,
        attendanceStatus,
        overrideMode,
      })
      const updated = res.data?.data
      setSessions((prev) =>
        prev.map((sess) =>
          sess.id === sessionId
            ? {
                ...sess,
                participants: sess.participants.map((p) =>
                  p.employeeId === employeeId ? { ...p, ...updated } : p
                ),
              }
            : sess
        )
      )
      setActiveSessionModal((prev) =>
        prev && prev.id === sessionId
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.employeeId === employeeId ? { ...p, ...updated } : p
              ),
            }
          : prev
      )
      setNotice(`✅ ${res.data?.message || 'Attendance override saved'}`)
    } catch (err: any) {
      setNotice(`❌ ${err?.response?.data?.message || 'Failed to update session attendance'}`)
    } finally {
      setSavingParticipantId(null)
    }
  }

  const handleCancelSession = async (sess: TrainingSessionItem) => {
    const reasonInput = window.prompt(
      `Cancel "${sess.title}" (${sess.sessionDate} • ${sess.timeSlot})?\n\nOptional cancellation reason for employees:`,
      'Rescheduled / Cancelled by HR'
    )
    if (reasonInput === null) return
    try {
      const res = await trainingApi.cancelSession(sess.id, reasonInput)
      const updated = res.data?.data
      if (updated) {
        setSessions((prev) => prev.map((s) => (s.id === sess.id ? updated : s)))
        setActiveSessionModal((prev) => (prev && prev.id === sess.id ? updated : prev))
      }
      setNotice(`✅ ${res.data?.message || 'Session cancelled and employees notified.'}`)
    } catch (err: any) {
      setNotice(`❌ ${err?.response?.data?.message || 'Failed to cancel session'}`)
    }
  }

  const isToday = (day: number) => today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()
  const isSelected = (day: number) => selectedDate.getDate() === day && selectedDate.getMonth() === month - 1 && selectedDate.getFullYear() === year

  const getDayDot = (day: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const d = summaryData[key]
    if (!d) return null
    if (d.activeCount > 0) return '#22c55e'
    if (d.leaveCount > 0) return '#a855f7'
    return null
  }

  const handleToggleDay = (key: keyof WorkSchedule) => {
    setScheduleDraft((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSaveSchedule = async () => {
    setSavingSchedule(true)
    setNotice('')
    try {
      await calendarApi.updateSchedule(scheduleDraft)
      setNotice('✅ Weekly working days schedule saved.')
      await fetchAll()
    } catch (err: any) {
      setNotice(`❌ ${err?.response?.data?.message || 'Failed to save schedule'}`)
    } finally {
      setSavingSchedule(false)
    }
  }

  const openHolidayModal = (defaultDate?: string, defaultType: CalendarHolidayType = 'PUBLIC_HOLIDAY') => {
    const target = defaultDate || selectedDateStr
    const existing = calendarData?.days?.[target]?.holiday
    setHolidayForm({
      date: target,
      title: existing?.title || '',
      type: existing?.type || defaultType,
      description: existing?.description || '',
    })
    setModalOpen(true)
  }

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!holidayForm.date || !holidayForm.title.trim()) return
    setSavingHoliday(true)
    setNotice('')
    try {
      await calendarApi.upsertHoliday(holidayForm)
      setModalOpen(false)
      setNotice('✅ Calendar holiday / working day override saved.')
      await fetchAll()
    } catch (err: any) {
      setNotice(`❌ ${err?.response?.data?.message || 'Failed to save calendar entry'}`)
    } finally {
      setSavingHoliday(false)
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    setNotice('')
    try {
      await calendarApi.deleteHoliday(id)
      setNotice('✅ Calendar entry removed.')
      await fetchAll()
    } catch (err: any) {
      if (err?.response?.status === 404) {
        try {
          localStorage.removeItem(`hrms_hr_cal_${year}_${month}`)
          localStorage.removeItem(`hrms_hr_cal_hol_${year}`)
        } catch {}
        setNotice('✅ Calendar entry removed.')
        await fetchAll()
        return
      }
      setNotice(`❌ ${err?.response?.data?.message || 'Failed to remove entry'}`)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .hr-cal * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        .hr-cal { background: #f1f5f9; min-height: 100vh; padding: 28px; }

        .hr-cal-hero {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4338ca 100%);
          border-radius: 24px;
          padding: 30px 36px;
          margin-bottom: 20px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .hr-cal-hero-left { position: relative; z-index: 1; }
        .hr-cal-hero-title { font-size: 30px; font-weight: 900; color: #fff; letter-spacing: -0.5px; margin: 0 0 4px; }
        .hr-cal-hero-subtitle { color: rgba(255,255,255,0.7); font-size: 14px; font-weight: 500; }

        .hr-cal-hero-nav {
          display: flex; align-items: center; gap: 14px;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 16px;
          padding: 10px 16px;
          position: relative; z-index: 1;
        }
        .hr-cal-nav-btn {
          width: 34px; height: 34px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.1);
          color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .hr-cal-nav-btn:hover { background: rgba(255,255,255,0.2); }
        .hr-cal-month-label { font-size: 17px; font-weight: 800; color: #fff; min-width: 120px; text-align: center; }

        .hr-cal-controls {
          background: #fff;
          border-radius: 18px;
          padding: 16px 22px;
          margin-bottom: 20px;
          border: 1px solid #e8ecf4;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .hr-cal-body { display: grid; grid-template-columns: 1fr 350px; gap: 22px; align-items: start; }
        @media (max-width: 1024px) { .hr-cal-body { grid-template-columns: 1fr; } }

        .hr-cal-card {
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          border: 1px solid #e8ecf4;
        }
        .hr-cal-grid-header { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); margin-bottom: 10px; }
        .hr-cal-dow { text-align: center; font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 0.06em; padding: 6px 0; }
        .hr-cal-dow.weekend { color: #a78bfa; }
        .hr-cal-grid-body { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }

        .hr-day-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 0; }
        .hr-day-btn {
          width: 100%; min-width: 0; min-height: 58px; border-radius: 12px;
          border: 1px solid transparent; background: transparent;
          font-size: 14px; font-weight: 700; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
          transition: all 0.15s ease; color: #0f172a; padding: 5px 6px; overflow: hidden;
        }
        .hr-day-btn:hover:not(.hr-day-selected) { background: #f1f5f9; }
        .hr-day-today { border-color: #6366f1 !important; background: #eef2ff; color: #4338ca; }
        .hr-day-selected {
          background: linear-gradient(135deg, #7c3aed, #6366f1) !important;
          color: #fff !important;
          box-shadow: 0 8px 20px -4px rgba(124,58,237,0.45);
        }
        .hr-day-empty { color: #cbd5e1; font-size: 13px; font-weight: 500; height: 54px; display: flex; align-items: center; justify-content: center; }
        .hr-day-dot { width: 5px; height: 5px; border-radius: 50%; }

        .hr-cal-side { display: flex; flex-direction: column; gap: 14px; }
        .hr-cal-date-card {
          background: linear-gradient(135deg, #312e81, #4338ca);
          border-radius: 20px; padding: 22px; color: #fff;
          box-shadow: 0 8px 32px rgba(67,56,202,0.28);
        }
        .hr-cal-date-day { font-size: 44px; font-weight: 900; line-height: 1; }
        .hr-cal-date-month { font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.75); margin-top: 4px; }
        .hr-cal-date-weekday { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 0.06em; }

        .hr-stat-card {
          background: #fff; border-radius: 16px; padding: 16px 18px;
          border: 1px solid #e8ecf4; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          display: flex; align-items: center; gap: 14px; cursor: pointer; transition: all 0.2s ease;
        }
        .hr-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-color: #c7d2fe; }
        .hr-stat-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .hr-stat-info { flex: 1; }
        .hr-stat-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .hr-stat-value { font-size: 24px; font-weight: 900; color: #0f172a; line-height: 1.1; margin-top: 2px; }
        .hr-stat-arrow { color: #94a3b8; font-size: 18px; }
        .hr-cal-loading { opacity: 0.6; pointer-events: none; }
      `}</style>

      <div className="hr-cal">
        {/* Hero Header */}
        <div className="hr-cal-hero">
          <div className="hr-cal-hero-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '7px', borderRadius: 10 }}>
                <CalendarDays size={20} color="#c7d2fe" />
              </div>
              <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                HR Master Calendar · Holidays & Working Days
              </span>
            </div>
            <div className="hr-cal-hero-title">{MONTH_NAMES[currentDate.getMonth()]} {year}</div>
            <div className="hr-cal-hero-subtitle">
              Control company holidays, working days, and track daily workforce attendance
              {calendarData?.summary && ` · ${calendarData.summary.workingDays} Working Days · ${calendarData.summary.holidaysCount} Holidays`}
            </div>
          </div>

          <div className="hr-cal-hero-nav">
            <button className="hr-cal-nav-btn" onClick={prevMonth}>
              <ChevronLeft size={18} />
            </button>
            <div className="hr-cal-month-label">
              {MONTH_NAMES[currentDate.getMonth()].slice(0, 3)} {year}
            </div>
            <button className="hr-cal-nav-btn" onClick={nextMonth}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* HR Working Days & Holiday Controls */}
        <div className="hr-cal-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Weekly Working Days:
            </span>
            {SCHEDULE_DAY_KEYS.map(({ key, label }) => {
              const active = scheduleDraft[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleToggleDay(key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: active ? '1.5px solid #16a34a' : '1.5px solid #cbd5e1',
                    background: active ? '#f0fdf4' : '#f8fafc',
                    color: active ? '#15803d' : '#64748b',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#10b981' : '#94a3b8' }} />
                  {label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
              style={{
                padding: '7px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#4338ca',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: savingSchedule ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Check size={14} /> {savingSchedule ? 'Saving...' : 'Save Working Days'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => openHolidayModal(selectedDateStr, 'PUBLIC_HOLIDAY')}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(234,88,12,0.25)',
            }}
          >
            <Plus size={15} /> Add Holiday / Override
          </button>
        </div>

        {notice && (
          <div
            style={{
              padding: '10px 16px',
              marginBottom: 16,
              borderRadius: 12,
              background: notice.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
              border: notice.startsWith('✅') ? '1px solid #bbf7d0' : '1px solid #fecaca',
              color: notice.startsWith('✅') ? '#15803d' : '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {notice}
          </div>
        )}

        {/* Body: Calendar + Side Panel */}
        <div className="hr-cal-body">
          <div className={`hr-cal-card ${loading ? 'hr-cal-loading' : ''}`}>
            <div className="hr-cal-grid-header">
              {DAYS_OF_WEEK.map((d, i) => (
                <div key={d} className={`hr-cal-dow ${i >= 5 ? 'weekend' : ''}`}>{d}</div>
              ))}
            </div>

            <div className="hr-cal-grid-body">
              {blanks.map((_, i) => (
                <div key={`b-${i}`} className="hr-day-cell">
                  <div className="hr-day-empty">{prevMonthDays - blanks.length + i + 1}</div>
                </div>
              ))}

              {days.map((day) => {
                const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayInfo = calendarData?.days?.[dateKey]
                const status: DayScheduleStatus = dayInfo?.status || 'WORKING_DAY'
                const meta = STATUS_META[status]
                const dot = getDayDot(day)
                const selected = isSelected(day)
                const todayDay = isToday(day)
                const daySessions = sessionsByDate[dateKey] || []

                return (
                  <div key={day} className="hr-day-cell">
                    <button
                      onClick={() => handleDateClick(day)}
                      onDoubleClick={() => handleDateDoubleClick(day)}
                      className={`hr-day-btn ${selected ? 'hr-day-selected' : todayDay ? 'hr-day-today' : ''}`}
                      style={!selected && !todayDay ? { background: daySessions.length > 0 && status === 'WORKING_DAY' ? '#f5f3ff' : meta.bg, borderColor: daySessions.length > 0 ? '#8b5cf6' : meta.border, color: meta.color } : undefined}
                      title={[
                        dayInfo?.holiday ? `${meta.label}: ${dayInfo.holiday.title}` : meta.label,
                        ...daySessions.map(s => `${s.sessionType === 'MEETING' ? 'Meeting' : 'Training'}: ${s.title} (${s.timeSlot})`)
                      ].join(' | ')}
                    >
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                        <span>{day}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          {daySessions.length > 0 && (
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: selected ? '#fde047' : '#7c3aed' }} />
                          )}
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: selected ? '#fff' : meta.dotColor }} />
                        </div>
                      </div>
                      {daySessions.length > 0 ? (
                        <span style={{ fontSize: 9, fontWeight: 800, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected ? '#fde047' : '#6d28d9' }}>
                          {daySessions.length > 1 ? `${daySessions.length} Sessions` : daySessions[0].title}
                        </span>
                      ) : dayInfo?.holiday ? (
                        <span style={{ fontSize: 9, fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: selected ? 0.95 : 0.85 }}>
                          {dayInfo.holiday.title}
                        </span>
                      ) : dot && !selected ? (
                        <span className="hr-day-dot" style={{ background: dot }} />
                      ) : null}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Clean Vector Legend */}
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {(Object.keys(STATUS_META) as DayScheduleStatus[]).map((key) => {
                const m = STATUS_META[key]
                const Icon = m.Icon
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569', fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.dotColor, display: 'inline-block' }} />
                    <Icon size={13} color={m.dotColor} />
                    <span>{m.label}</span>
                  </div>
                )
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                Attendance Logged
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#475569', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
                Leaves Logged
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="hr-cal-side">
            <div className="hr-cal-date-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div className="hr-cal-date-weekday">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="hr-cal-date-day">{selectedDate.getDate()}</div>
                  <div className="hr-cal-date-month">
                    {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.16)', padding: 10, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SelectedIcon size={22} color="#fff" />
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700 }}>
                  {selectedMeta.label}
                </span>
                {selectedDayInfo?.holiday ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteHoliday(selectedDayInfo.holiday!.id)}
                    style={{
                      background: 'rgba(239,68,68,0.85)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} /> Remove Override
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openHolidayModal(selectedDateStr, selectedDayStatus === 'WEEK_OFF' ? 'SPECIAL_WORKING' : 'PUBLIC_HOLIDAY')}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: 8,
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {selectedDayStatus === 'WEEK_OFF' ? 'Mark Working Day' : 'Set as Holiday'}
                  </button>
                )}
              </div>

              {selectedDayInfo?.holiday && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 }}>
                  <strong>{selectedDayInfo.holiday.title}</strong>
                  {selectedDayInfo.holiday.description && (
                    <div style={{ opacity: 0.85, marginTop: 2 }}>{selectedDayInfo.holiday.description}</div>
                  )}
                </div>
              )}
            </div>

            <div className="hr-stat-card" onClick={() => navigate(`/hr/attendance/details?date=${selectedDateStr}&type=active`)}>
              <div className="hr-stat-icon" style={{ background: '#dcfce7' }}>
                <UserCheck size={20} color="#16a34a" />
              </div>
              <div className="hr-stat-info">
                <div className="hr-stat-label">Active Employees</div>
                <div className="hr-stat-value" style={{ color: '#16a34a' }}>{selectedDayData.activeCount || 0}</div>
              </div>
              <div className="hr-stat-arrow">›</div>
            </div>

            <div className="hr-stat-card" onClick={() => navigate(`/hr/attendance/details?date=${selectedDateStr}&type=leave`)}>
              <div className="hr-stat-icon" style={{ background: '#ede9fe' }}>
                <Users size={20} color="#7c3aed" />
              </div>
              <div className="hr-stat-info">
                <div className="hr-stat-label">On Leave</div>
                <div className="hr-stat-value" style={{ color: '#7c3aed' }}>{selectedDayData.leaveCount || 0}</div>
              </div>
              <div className="hr-stat-arrow">›</div>
            </div>

            <div className="hr-stat-card" onClick={() => navigate(`/hr/attendance/details?date=${selectedDateStr}&type=inactive`)}>
              <div className="hr-stat-icon" style={{ background: '#fee2e2' }}>
                <UserX size={20} color="#dc2626" />
              </div>
              <div className="hr-stat-info">
                <div className="hr-stat-label">Inactive / Absent</div>
                <div className="hr-stat-value" style={{ color: '#dc2626' }}>—</div>
              </div>
              <div className="hr-stat-arrow">›</div>
            </div>

            {/* Compact Trainings & Meetings Summary Card (Click to Pop Up Full Day Schedule) */}
            <div className="hr-cal-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e0e7ff' }}>
                    <Video size={15} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                      Trainings &amp; Meetings
                    </h4>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                      {selectedDateStr}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: selectedDaySessions.length > 0 ? '#eef2ff' : '#f1f5f9', color: selectedDaySessions.length > 0 ? '#4f46e5' : '#64748b' }}>
                  {selectedDaySessions.length}
                </span>
              </div>

              {selectedDaySessions.length === 0 ? (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                  No trainings or meetings scheduled.
                </div>
              ) : (() => {
                const activeCount = selectedDaySessions.filter((s) => s.status !== 'CANCELLED').length
                const cancelledCount = selectedDaySessions.length - activeCount
                const firstActive = selectedDaySessions.find((s) => s.status !== 'CANCELLED') || selectedDaySessions[0]
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {firstActive.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                        {activeCount} Active{cancelledCount > 0 ? ` • ${cancelledCount} Cancelled` : ''} • {firstActive.timeSlot}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAgendaFilter('ALL'); setDayAgendaDate(selectedDateStr) }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                        color: '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: '0 4px 12px -2px rgba(79,70,229,0.35)',
                      }}
                    >
                      <CalendarDays size={14} /> View &amp; Manage ({selectedDaySessions.length})
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Allotted Calendar History Log */}
        <div className="hr-cal-card" style={{ marginTop: 22, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                Allotted Holidays &amp; Overrides History ({year})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                Complete audit log of all holidays and special working days configured by HR for {year}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'ALL', label: `All (${yearHolidays.length})` },
                  { id: 'PUBLIC_HOLIDAY', label: 'Public Holiday' },
                  { id: 'COMPANY_HOLIDAY', label: 'Company Holiday' },
                  { id: 'CUSTOM_HOLIDAY', label: 'Custom Holiday' },
                  { id: 'SPECIAL_WORKING', label: 'Special Working' },
                ] as const
              ).map((tab) => {
                const active = historyFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHistoryFilter(tab.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: active ? '1.5px solid #4338ca' : '1px solid #cbd5e1',
                      background: active ? '#eef2ff' : '#fff',
                      color: active ? '#4338ca' : '#475569',
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Day</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Title</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {yearHolidays
                  .filter((h) => historyFilter === 'ALL' || h.type === historyFilter)
                  .map((h) => {
                    const meta = STATUS_META[h.type]
                    const Icon = meta.Icon
                    const dt = new Date(`${h.date}T00:00:00Z`)
                    const dateFormatted = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    const dayName = dt.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{dateFormatted}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{dayName}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{h.title}</td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                            <Icon size={12} color={meta.dotColor} />
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12.5, color: '#475569' }}>{h.description || '—'}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setHolidayForm({ date: h.date, title: h.title, type: h.type, description: h.description || '' })
                                setModalOpen(true)
                              }}
                              style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteHoliday(h.id)}
                              style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 12, fontWeight: 700, color: '#b91c1c', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                {yearHolidays.filter((h) => historyFilter === 'ALL' || h.type === historyFilter).length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: 13 }}>
                      No calendar holidays or overrides allotted for {year} under this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Holiday Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Manage Calendar Date</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveHoliday} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Date *
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Entry Type *
                <select
                  value={holidayForm.type}
                  onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value as CalendarHolidayType })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                >
                  <option value="PUBLIC_HOLIDAY">Public Holiday</option>
                  <option value="COMPANY_HOLIDAY">Company Holiday</option>
                  <option value="CUSTOM_HOLIDAY">Custom Holiday</option>
                  <option value="SPECIAL_WORKING">Special Working Day (Override)</option>
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Title *
                <input
                  type="text"
                  required
                  placeholder="e.g. Republic Day / Working Saturday"
                  value={holidayForm.title}
                  onChange={(e) => setHolidayForm({ ...holidayForm, title: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                Description (Optional)
                <textarea
                  rows={2}
                  placeholder="Optional note for employees..."
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHoliday}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4338ca', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  {savingHoliday ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Double-Tap Day Agenda Modal (Clean Multi-Session Schedule) */}
      {dayAgendaDate && (() => {
        const agendaSessions = [...(sessionsByDate[dayAgendaDate] || [])].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
        const meetingCount = agendaSessions.filter((s) => s.sessionType === 'MEETING').length
        const trainingCount = agendaSessions.filter((s) => s.sessionType === 'TRAINING').length
        const filteredAgenda = agendaFilter === 'ALL' ? agendaSessions : agendaSessions.filter((s) => s.sessionType === agendaFilter)
        const agendaDateObj = new Date(`${dayAgendaDate}T00:00:00`)
        const agendaDayInfo = calendarData?.days?.[dayAgendaDate]
        const agendaStatus = STATUS_META[agendaDayInfo?.status || 'WORKING_DAY']

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Day schedule details"
            onClick={(e) => { if (e.target === e.currentTarget) setDayAgendaDate(null) }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.52)', backdropFilter: 'blur(4px)', zIndex: 1040,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(15,23,42,0.22)', border: '1px solid #e2e8f0' }}>
              {/* Clean Compact Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: agendaStatus.bg, color: agendaStatus.color, border: `1px solid ${agendaStatus.border}` }}>
                      {agendaStatus.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                      {meetingCount} {meetingCount === 1 ? 'Meeting' : 'Meetings'} • {trainingCount} {trainingCount === 1 ? 'Training' : 'Trainings'}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
                    {agendaDateObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDayAgendaDate(null)}
                  aria-label="Close day schedule"
                  style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Minimal Segmented Filter */}
              {agendaSessions.length > 0 && (
                <div style={{ padding: '10px 24px', borderBottom: '1px solid #f1f5f9', background: '#ffffff', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    { id: 'ALL', label: `All (${agendaSessions.length})` },
                    { id: 'MEETING', label: `Meetings (${meetingCount})` },
                    { id: 'TRAINING', label: `Trainings (${trainingCount})` },
                  ] as const).map((tab) => {
                    const active = agendaFilter === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAgendaFilter(tab.id)}
                        style={{
                          padding: '6px 13px',
                          borderRadius: 8,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: active ? '1px solid #4338ca' : '1px solid transparent',
                          background: active ? '#eef2ff' : '#f8fafc',
                          color: active ? '#4338ca' : '#64748b',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Clean Compact Multi-Session List */}
              <div style={{ padding: '16px 24px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc' }}>
                {filteredAgenda.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', borderRadius: 14, background: '#ffffff', border: '1px dashed #cbd5e1' }}>
                    <CalendarDays size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: '#334155' }}>No scheduled trainings or meetings</div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                      Schedule sessions from HR Training to display them on this date.
                    </div>
                  </div>
                ) : (
                  filteredAgenda.map((sess) => {
                    const isMeeting = sess.sessionType === 'MEETING'
                    const isCancelled = sess.status === 'CANCELLED'
                    const accent = isCancelled ? '#dc2626' : isMeeting ? '#7c3aed' : '#4f46e5'
                    const badgeBg = isCancelled ? '#fef2f2' : isMeeting ? '#f5f3ff' : '#eef2ff'
                    const attendedCount = sess.participants.filter((p) => p.attendanceStatus === 'ATTENDED').length
                    const absentCount = sess.participants.filter((p) => p.attendanceStatus === 'ABSENT').length

                    return (
                      <div
                        key={sess.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: 14,
                          border: '1px solid #e2e8f0',
                          borderLeft: `4px solid ${accent}`,
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          opacity: isCancelled ? 0.85 : 1,
                          boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                        }}
                      >
                        {/* Top Row: Time + Type + Title */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 6, background: badgeBg, color: accent }}>
                                {isCancelled ? 'Cancelled' : isMeeting ? 'Important Meeting' : 'Training'}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} color="#64748b" /> {sess.timeSlot}
                              </span>
                              <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>• {sess.duration}</span>
                            </div>

                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                              {sess.title}
                            </h4>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              Host: <strong style={{ color: '#334155' }}>{sess.trainerName}</strong>
                              {isCancelled && sess.cancelReason && (
                                <span style={{ color: '#dc2626', fontWeight: 600 }}> • {sess.cancelReason}</span>
                              )}
                            </div>
                          </div>

                          {/* Quick Counts */}
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, fontWeight: 700 }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
                              {sess.participants.length} Invited
                            </span>
                            <span style={{ padding: '3px 8px', borderRadius: 6, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                              {attendedCount} Attended
                            </span>
                            {absentCount > 0 && (
                              <span style={{ padding: '3px 8px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                                {absentCount} Absent
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Action Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                          {sess.agenda ? (
                            <span style={{ fontSize: 11.5, color: '#64748b', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sess.agenda}>
                              {sess.agenda.replace(/\n+/g, ' • ')}
                            </span>
                          ) : <span />}

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {sess.teamsUrl && !isCancelled && (
                              <a
                                href={sess.teamsUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ padding: '6px 12px', borderRadius: 8, background: '#fff', color: accent, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                              >
                                Join Teams
                              </a>
                            )}
                            {!isCancelled && (
                              <button
                                type="button"
                                onClick={() => handleCancelSession(sess)}
                                style={{ padding: '6px 11px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setDayAgendaDate(null); setActiveSessionModal(sess) }}
                              style={{ padding: '6px 13px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              Manage Attendance
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Manual Session Attendance & Override Modal */}
      {activeSessionModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1050,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 760, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6,
                    background: activeSessionModal.sessionType === 'MEETING' ? '#7c3aed' : '#4f46e5', color: '#fff'
                  }}>
                    {activeSessionModal.sessionType === 'MEETING' ? 'Important Meeting' : 'Training Session'}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                    {activeSessionModal.sessionDate} • {activeSessionModal.timeSlot} ({activeSessionModal.duration})
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {activeSessionModal.title}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                  Mark manual attendance and optionally override the employee&apos;s daily attendance record.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const backDate = activeSessionModal.sessionDate
                    setActiveSessionModal(null)
                    setAgendaFilter('ALL')
                    setDayAgendaDate(backDate)
                  }}
                  style={{ border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#334155', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <ChevronLeft size={14} /> Back
                </button>
                {activeSessionModal.status !== 'CANCELLED' ? (
                  <button
                    type="button"
                    onClick={() => handleCancelSession(activeSessionModal)}
                    style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#dc2626', fontSize: 12, fontWeight: 700 }}
                  >
                    Cancel {activeSessionModal.sessionType === 'MEETING' ? 'Meeting' : 'Training'}
                  </button>
                ) : (
                  <span style={{ padding: '4px 10px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 800 }}>
                    CANCELLED
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSessionModal(null)}
                  style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#475569' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {activeSessionModal.participants.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 12 }}>
                No internal employees were linked to this session.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeSessionModal.participants.map((p) => {
                  const isSaving = savingParticipantId === p.employeeId
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                          {p.employee.firstName} {p.employee.lastName}
                          <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 600, color: '#64748b' }}>
                            ({p.employee.employeeCode})
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {p.employee.email} • Status:{' '}
                          <strong style={{
                            color: p.attendanceStatus === 'ATTENDED' ? '#16a34a' : p.attendanceStatus === 'ABSENT' ? '#dc2626' : '#d97706'
                          }}>
                            {p.attendanceStatus}
                          </strong>
                          {p.overrideMode !== 'NONE' && (
                            <span style={{ marginLeft: 8, padding: '1px 7px', borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 11, fontWeight: 700 }}>
                              Override: {p.overrideMode.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleMarkSessionAttendance(activeSessionModal.id, p.employeeId, 'ATTENDED', 'NONE')}
                          style={{
                            padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                            border: p.attendanceStatus === 'ATTENDED' ? '2px solid #16a34a' : '1px solid #bbf7d0',
                            background: p.attendanceStatus === 'ATTENDED' ? '#16a34a' : '#f0fdf4',
                            color: p.attendanceStatus === 'ATTENDED' ? '#fff' : '#15803d',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <CheckCircle2 size={13} /> Attended
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleMarkSessionAttendance(activeSessionModal.id, p.employeeId, 'ABSENT', 'SESSION_ONLY')}
                          style={{
                            padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                            border: p.overrideMode === 'SESSION_ONLY' ? '2px solid #d97706' : '1px solid #fde68a',
                            background: p.overrideMode === 'SESSION_ONLY' ? '#d97706' : '#fffbeb',
                            color: p.overrideMode === 'SESSION_ONLY' ? '#fff' : '#b45309',
                          }}
                        >
                          Cut Session Only
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleMarkSessionAttendance(activeSessionModal.id, p.employeeId, 'ABSENT', 'HALF_DAY')}
                          style={{
                            padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                            border: p.overrideMode === 'HALF_DAY' ? '2px solid #ea580c' : '1px solid #fed7aa',
                            background: p.overrideMode === 'HALF_DAY' ? '#ea580c' : '#fff7ed',
                            color: p.overrideMode === 'HALF_DAY' ? '#fff' : '#c2410c',
                          }}
                        >
                          Cut Half Day
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleMarkSessionAttendance(activeSessionModal.id, p.employeeId, 'ABSENT', 'FULL_DAY')}
                          style={{
                            padding: '6px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                            border: p.overrideMode === 'FULL_DAY' ? '2px solid #dc2626' : '1px solid #fecaca',
                            background: p.overrideMode === 'FULL_DAY' ? '#dc2626' : '#fef2f2',
                            color: p.overrideMode === 'FULL_DAY' ? '#fff' : '#b91c1c',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <AlertTriangle size={13} /> Cut Full Day
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
