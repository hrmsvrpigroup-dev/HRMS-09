import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Briefcase,
  Flag,
  Building2,
  Coffee,
  Sparkles,
  Clock,
  Video,
  Users,
  ExternalLink,
  X,
} from 'lucide-react'
import {
  calendarApi,
  CalendarMonthResponse,
  CalendarHoliday,
  DayScheduleStatus,
} from '../../api/calendar.api'
import { trainingApi, MyTrainingSessionItem } from '../../api/training.api'

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_META: Record<
  DayScheduleStatus,
  {
    label: string
    dotColor: string
    bg: string
    color: string
    border: string
    pillBg: string
    Icon: typeof Briefcase
  }
> = {
  WORKING_DAY: {
    label: 'Working Day',
    dotColor: '#10b981',
    bg: '#ffffff',
    color: '#0f172a',
    border: '#e2e8f0',
    pillBg: '#ecfdf5',
    Icon: Briefcase,
  },
  PUBLIC_HOLIDAY: {
    label: 'Public Holiday',
    dotColor: '#ef4444',
    bg: '#fef2f2',
    color: '#b91c1c',
    border: '#fecaca',
    pillBg: '#fee2e2',
    Icon: Flag,
  },
  COMPANY_HOLIDAY: {
    label: 'Company Holiday',
    dotColor: '#f97316',
    bg: '#fff7ed',
    color: '#c2410c',
    border: '#fed7aa',
    pillBg: '#ffedd5',
    Icon: Building2,
  },
  CUSTOM_HOLIDAY: {
    label: 'Custom Holiday',
    dotColor: '#ec4899',
    bg: '#fdf2f8',
    color: '#be185d',
    border: '#fbcfe8',
    pillBg: '#fce7f3',
    Icon: Sparkles,
  },
  WEEK_OFF: {
    label: 'Week Off',
    dotColor: '#94a3b8',
    bg: '#f8fafc',
    color: '#94a3b8',
    border: '#f1f5f9',
    pillBg: '#f1f5f9',
    Icon: Coffee,
  },
  SPECIAL_WORKING: {
    label: 'Special Working Day',
    dotColor: '#eab308',
    bg: '#fefce8',
    color: '#a16207',
    border: '#fde047',
    pillBg: '#fef9c3',
    Icon: Sparkles,
  },
}

export default function EmployeeCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [calendarData, setCalendarData] = useState<CalendarMonthResponse | null>(null)
  const [yearHolidays, setYearHolidays] = useState<CalendarHoliday[]>([])
  const [mySessions, setMySessions] = useState<MyTrainingSessionItem[]>([])
  const [dayAgendaDate, setDayAgendaDate] = useState<string | null>(null)
  const [agendaFilter, setAgendaFilter] = useState<'ALL' | 'MEETING' | 'TRAINING'>('ALL')
  const [loading, setLoading] = useState(false)
  const lastTapRef = useRef<{ dateKey: string; time: number } | null>(null)

  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  useEffect(() => {
    setLoading(true)
    Promise.all([
      calendarApi.getMonth(year, month).catch(() => null),
      calendarApi.listHolidays(year).catch(() => null),
      trainingApi.getMySessions({ year, month }).catch(() => null),
    ])
      .then(([monthRes, holRes, sessRes]) => {
        if (monthRes?.data?.data) setCalendarData(monthRes.data.data)
        if (holRes?.data?.data) setYearHolidays(holRes.data.data)
        setMySessions(sessRes?.data?.data || [])
      })
      .finally(() => setLoading(false))
  }, [year, month])

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
  const goToToday = () => goToMonth(today.getFullYear(), today.getMonth())

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay()
  const firstDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const prevMonthDays = new Date(year, month - 1, 0).getDate()

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i)

  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
  const selectedInfo = calendarData?.days?.[selectedDateStr]
  const selectedStatus: DayScheduleStatus = selectedInfo?.status || 'WORKING_DAY'
  const selectedMeta = STATUS_META[selectedStatus]
  const SelectedIcon = selectedMeta.Icon

  const sessionsByDate = mySessions.reduce<Record<string, MyTrainingSessionItem[]>>((acc, s) => {
    if (!acc[s.sessionDate]) acc[s.sessionDate] = []
    acc[s.sessionDate].push(s)
    return acc
  }, {})
  const selectedDaySessions = sessionsByDate[selectedDateStr] || []

  const isToday = (day: number) =>
    today.getDate() === day && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()
  const isSelected = (day: number) =>
    selectedDate.getDate() === day && selectedDate.getMonth() === month - 1 && selectedDate.getFullYear() === year

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const upcomingHolidays = yearHolidays
    .filter((h) => h.type !== 'SPECIAL_WORKING' && h.date >= todayIso)
    .slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {/* Clean Compact Header Bar with Inline Stats */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #4f46e5 100%)',
          borderRadius: 18,
          padding: '20px 26px',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 10px 28px -8px rgba(55,48,163,0.42)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarDays size={18} color="#e0e7ff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
              {MONTH_NAMES[currentDate.getMonth()]} {year}
            </h1>
          </div>
          {/* Compact Summary Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#a7f3d0' }}>
              <Briefcase size={12} /> {calendarData?.summary?.workingDays ?? '—'} Working
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.35)', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#fecaca' }}>
              <Flag size={12} /> {calendarData?.summary?.holidaysCount ?? '—'} Holidays
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
              <Coffee size={12} /> {calendarData?.summary?.weekOffs ?? '—'} Week Offs
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={goToToday}
            style={{
              height: 36,
              padding: '0 13px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.22)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Clock size={13} /> Today
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 11, padding: '3px 6px' }}>
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous Month"
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 96, textAlign: 'center', color: '#fff' }}>
              {MONTH_NAMES[currentDate.getMonth()].slice(0, 3)} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next Month"
              style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Calendar + Side Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 310px', gap: '1.1rem', alignItems: 'start' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            padding: '20px 22px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
            opacity: loading ? 0.65 : 1,
            transition: 'opacity 0.2s ease',
          }}
        >
          {/* Weekday Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', marginBottom: 8 }}>
            {DAYS_OF_WEEK.map((d, idx) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: 11.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: idx >= 5 ? '#818cf8' : '#64748b',
                  padding: '6px 0',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Clean, Airy Day Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 7 }}>
            {blanks.map((_, i) => (
              <div
                key={`b-${i}`}
                style={{
                  height: 58,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#cbd5e1',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {prevMonthDays - blanks.length + i + 1}
              </div>
            ))}

            {days.map((day) => {
              const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const info = calendarData?.days?.[dateKey]
              const status: DayScheduleStatus = info?.status || 'WORKING_DAY'
              const meta = STATUS_META[status]
              const selected = isSelected(day)
              const todayDay = isToday(day)
              const daySessions = sessionsByDate[dateKey] || []
              const hasSessions = daySessions.length > 0
              const isSpecialOrHoliday = (status !== 'WORKING_DAY' && status !== 'WEEK_OFF') || hasSessions

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setSelectedDate(new Date(year, month - 1, day))
                    const now = Date.now()
                    if (lastTapRef.current && lastTapRef.current.dateKey === dateKey && now - lastTapRef.current.time < 320) {
                      setAgendaFilter('ALL')
                      setDayAgendaDate(dateKey)
                      lastTapRef.current = null
                    } else {
                      lastTapRef.current = { dateKey, time: now }
                    }
                  }}
                  onDoubleClick={() => {
                    setSelectedDate(new Date(year, month - 1, day))
                    setAgendaFilter('ALL')
                    setDayAgendaDate(dateKey)
                  }}
                  title={[
                    info?.holiday ? `${meta.label}: ${info.holiday.title}` : meta.label,
                    ...daySessions.map(s => `${s.sessionType === 'MEETING' ? 'Meeting' : 'Training'}: ${s.title} (${s.timeSlot})`)
                  ].join(' | ')}
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    height: 58,
                    borderRadius: 12,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isSpecialOrHoliday ? 'flex-start' : 'center',
                    justifyContent: isSpecialOrHoliday ? 'space-between' : 'center',
                    gap: 3,
                    border: selected
                      ? '2px solid #4f46e5'
                      : hasSessions
                      ? '1.5px solid #8b5cf6'
                      : todayDay
                      ? '2px solid #6366f1'
                      : `1px solid ${meta.border}`,
                    background: selected
                      ? 'linear-gradient(135deg, #6366f1, #4338ca)'
                      : hasSessions && status === 'WORKING_DAY'
                      ? '#f5f3ff'
                      : todayDay && status === 'WORKING_DAY'
                      ? '#eef2ff'
                      : meta.bg,
                    color: selected ? '#fff' : meta.color,
                    boxShadow: selected ? '0 8px 18px -4px rgba(79,70,229,0.4)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: isSpecialOrHoliday ? 'space-between' : 'center', gap: 4 }}>
                    <span style={{ fontSize: 14.5, fontWeight: selected || todayDay || isSpecialOrHoliday ? 800 : 600 }}>
                      {day}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {hasSessions && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: selected ? '#fde047' : '#7c3aed',
                          }}
                        />
                      )}
                      {status !== 'WORKING_DAY' && status !== 'WEEK_OFF' && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: selected ? '#fff' : meta.dotColor,
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {hasSessions ? (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: selected ? '#fff' : '#6d28d9',
                      }}
                    >
                      {daySessions.length > 1 ? `${daySessions.length} Sessions` : daySessions[0].title}
                    </span>
                  ) : info?.holiday ? (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: selected ? 0.95 : 0.9,
                      }}
                    >
                      {info.holiday.title}
                    </span>
                  ) : todayDay && !selected ? (
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Today
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {/* Minimalist Legend */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {(Object.keys(STATUS_META) as DayScheduleStatus[]).map((key) => {
              const m = STATUS_META[key]
              const Icon = m.Icon
              return (
                <div key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  <Icon size={13} color={m.dotColor} />
                  <span>{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              borderRadius: 18,
              padding: '20px',
              background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)',
              color: '#fff',
              boxShadow: '0 10px 26px -6px rgba(67,56,202,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.78, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.07em' }}>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.05, marginTop: 4 }}>{selectedDate.getDate()}</div>
                <div style={{ fontSize: 14, opacity: 0.85, fontWeight: 600 }}>
                  {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SelectedIcon size={20} color="#fff" />
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', fontSize: 12, fontWeight: 700 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: selectedMeta.dotColor }} />
              {selectedMeta.label}
            </div>

            {selectedInfo?.holiday && (
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.14)', fontSize: 12.5 }}>
                <div style={{ fontWeight: 700 }}>{selectedInfo.holiday.title}</div>
                {selectedInfo.holiday.description && (
                  <div style={{ opacity: 0.85, marginTop: 3 }}>{selectedInfo.holiday.description}</div>
                )}
              </div>
            )}
          </div>

          {/* Scheduled Trainings & Important Meetings for Selected Day */}
          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              padding: '18px 20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Video size={15} />
                </div>
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
                  Sessions on {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)}
                </h3>
              </div>
              {selectedDaySessions.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#f5f3ff', color: '#6d28d9' }}>
                  {selectedDaySessions.length}
                </span>
              )}
            </div>

            {selectedDaySessions.length === 0 ? (
              <div style={{ padding: '0.9rem', borderRadius: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center', fontSize: 12.5, color: '#64748b' }}>
                No trainings or meetings scheduled on this date.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  const activeCount = selectedDaySessions.filter((s) => s.status !== 'CANCELLED').length
                  const cancelledCount = selectedDaySessions.length - activeCount
                  const firstActive = selectedDaySessions.find((s) => s.status !== 'CANCELLED') || selectedDaySessions[0]
                  return (
                    <>
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
                        <CalendarDays size={14} /> View Sessions ({selectedDaySessions.length})
                      </button>
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: 18,
              padding: '18px 20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: '#eef2ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flag size={15} />
              </div>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>Upcoming Holidays ({year})</h3>
            </div>

            {upcomingHolidays.length === 0 ? (
              <div style={{ padding: '1rem', borderRadius: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center', fontSize: 12.5, color: '#64748b' }}>
                No upcoming holidays scheduled for {year}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {upcomingHolidays.map((h) => {
                  const meta = STATUS_META[h.type]
                  const dt = new Date(`${h.date}T00:00:00Z`)
                  const dayNum = dt.toLocaleDateString('en-GB', { day: '2-digit' })
                  const monShort = dt.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
                  return (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        padding: '9px 11px',
                        borderRadius: 12,
                        background: meta.bg,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      <div
                        style={{
                          minWidth: 42,
                          height: 42,
                          borderRadius: 10,
                          background: '#fff',
                          border: `1px solid ${meta.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 900, color: meta.color, lineHeight: 1 }}>{dayNum}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', marginTop: 2 }}>{monShort}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {h.title}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, marginTop: 2 }}>{meta.label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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
            <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 660, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(15,23,42,0.22)', border: '1px solid #e2e8f0' }}>
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

              <div style={{ padding: '16px 24px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafc' }}>
                {filteredAgenda.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', borderRadius: 14, background: '#ffffff', border: '1px dashed #cbd5e1' }}>
                    <CalendarDays size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: '#334155' }}>No scheduled trainings or meetings</div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
                      You have no trainings or important meetings assigned on this date.
                    </div>
                  </div>
                ) : (
                  filteredAgenda.map((sess) => {
                    const isMeeting = sess.sessionType === 'MEETING'
                    const isCancelled = sess.status === 'CANCELLED'
                    const accent = isCancelled ? '#dc2626' : isMeeting ? '#7c3aed' : '#4f46e5'
                    const badgeBg = isCancelled ? '#fef2f2' : isMeeting ? '#f5f3ff' : '#eef2ff'
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

                          <span style={{
                            fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                            background: sess.attendanceStatus === 'ATTENDED' ? '#f0fdf4' : sess.attendanceStatus === 'ABSENT' ? '#fef2f2' : '#fffbeb',
                            color: sess.attendanceStatus === 'ATTENDED' ? '#15803d' : sess.attendanceStatus === 'ABSENT' ? '#b91c1c' : '#b45309',
                            border: `1px solid ${sess.attendanceStatus === 'ATTENDED' ? '#bbf7d0' : sess.attendanceStatus === 'ABSENT' ? '#fecaca' : '#fde68a'}`
                          }}>
                            {sess.attendanceStatus}
                            {sess.overrideMode !== 'NONE' ? ` (${sess.overrideMode.replace('_', ' ')})` : ''}
                          </span>
                        </div>

                        {(sess.agenda || (sess.teamsUrl && !isCancelled)) && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                            {sess.agenda ? (
                              <span style={{ fontSize: 11.5, color: '#64748b', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sess.agenda}>
                                {sess.agenda.replace(/\n+/g, ' • ')}
                              </span>
                            ) : <span />}

                            {sess.teamsUrl && !isCancelled && (
                              <a
                                href={sess.teamsUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: accent, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                              >
                                <Video size={13} /> Join Teams <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
