import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { alertApi, PortalAlertCategory, PortalAlertItem, PortalAlertPriority } from '../../api/alert.api'
import { Employee, employeeApi } from '../../api/employee.api'
import { leaveApi } from '../../api/leave.api'

const CATEGORY_META: Record<PortalAlertCategory, { label: string; color: string; bg: string }> = {
  HOLIDAY: { label: 'Holiday Notice', color: '#be185d', bg: '#fdf2f8' },
  IMPORTANT_NEWS: { label: 'Important News', color: '#4338ca', bg: '#eef2ff' },
  URGENT_ALERT: { label: 'Urgent Alert', color: '#dc2626', bg: '#fef2f2' },
  GENERAL: { label: 'General Notice', color: '#0369a1', bg: '#f0f9ff' },
}

const PRIORITY_META: Record<PortalAlertPriority, { label: string; color: string; bg: string }> = {
  INFO: { label: 'Info', color: '#0369a1', bg: '#e0f2fe' },
  IMPORTANT: { label: 'Important', color: '#4338ca', bg: '#e0e7ff' },
  WARNING: { label: 'Warning', color: '#b45309', bg: '#fef3c7' },
  URGENT: { label: 'Emergency', color: '#b91c1c', bg: '#fee2e2' },
}

export default function HRAlerts() {
  const [activeTab, setActiveTab] = useState<'BROADCAST' | 'INCOMING'>('BROADCAST')
  const [alerts, setAlerts] = useState<PortalAlertItem[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [incomingLeaves, setIncomingLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null)
  const [selectedAlertModal, setSelectedAlertModal] = useState<PortalAlertItem | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState<PortalAlertCategory>('HOLIDAY')
  const [priority, setPriority] = useState<PortalAlertPriority>('IMPORTANT')
  const [targetAllUnderHr, setTargetAllUnderHr] = useState(false)
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set())
  const [empSearch, setEmpSearch] = useState('')
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false)
  const [expiryPreset, setExpiryPreset] = useState<'UNTIL_OFF' | '10M' | '1H' | 'TODAY' | '7D'>('TODAY')
  const [showAsPopup, setShowAsPopup] = useState(true)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [alertRes, empRes, leaveRes] = await Promise.all([
        alertApi.list().catch(() => null),
        employeeApi.list().catch(() => null),
        leaveApi.getNotifications().catch(() => null),
      ])
      if (alertRes?.data?.data) setAlerts(alertRes.data.data)
      if (empRes?.data?.data) {
        setEmployees(empRes.data.data)
      }
      if (leaveRes?.data?.data) setIncomingLeaves(leaveRes.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) =>
      `${e.firstName} ${e.lastName} ${e.employeeCode} ${e.email}`.toLowerCase().includes(q)
    )
  }, [employees, empSearch])

  const handleSelectPilot = () => {
    const pilot = employees.find((e) => e.email?.toLowerCase() === 'shiva.kanapuram@vrpitechsolutions.com')
    if (pilot) {
      setTargetAllUnderHr(false)
      setSelectedEmpIds(new Set([pilot.id]))
      setEmpSearch('shiva')
    } else {
      setNotice('❌ Pilot employee shiva.kanapuram@vrpitechsolutions.com not found in employee roster.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    setSending(true)
    setNotice('')
    try {
      const res = await alertApi.create({
        title: title.trim(),
        message: message.trim(),
        category,
        priority,
        targetAllUnderHr,
        employeeIds: Array.from(selectedEmpIds),
        showAsPopup,
        expiryPreset,
      })
      if (res.data?.data) {
        setAlerts((prev) => [res.data.data, ...prev])
        setTitle('')
        setMessage('')
        setNotice(`✅ ${res.data.message}`)
      }
    } catch (err: any) {
      setNotice(`❌ ${err?.response?.data?.message || 'Failed to publish alert'}`)
    } finally {
      setSending(false)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      const res = await alertApi.toggle(id)
      const updated = res.data?.data
      if (updated) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: updated.isActive } : a)))
      }
      setNotice(`✅ ${res.data?.message || 'Updated alert status'}`)
    } catch (err: any) {
      setNotice(`❌ ${err?.response?.data?.message || 'Failed to toggle alert'}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this alert?')) return
    try {
      await alertApi.remove(id)
      setAlerts((prev) => prev.filter((a) => a.id !== id))
      setNotice('✅ Alert deleted.')
    } catch (err: any) {
      setNotice(`❌ ${err?.response?.data?.message || 'Failed to delete alert'}`)
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1320, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%)',
        borderRadius: 20,
        padding: '24px 28px',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Megaphone size={22} />
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff' }}>HR Alerts &amp; Employee Portal Popups</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,0.78)' }}>
            Broadcast holiday notices, important company news, and urgent alerts directly to employees when they open their portal.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.12)', padding: 5, borderRadius: 12 }}>
          <button
            type="button"
            onClick={() => setActiveTab('BROADCAST')}
            style={{
              padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: activeTab === 'BROADCAST' ? '#ffffff' : 'transparent',
              color: activeTab === 'BROADCAST' ? '#312e81' : '#ffffff',
            }}
          >
            Employee Portal Popups ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('INCOMING')}
            style={{
              padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: activeTab === 'INCOMING' ? '#ffffff' : 'transparent',
              color: activeTab === 'INCOMING' ? '#312e81' : '#ffffff',
            }}
          >
            Incoming Leave Alerts ({incomingLeaves.length})
          </button>
        </div>
      </div>

      {notice && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: notice.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          border: notice.startsWith('✅') ? '1px solid #bbf7d0' : '1px solid #fecaca',
          color: notice.startsWith('✅') ? '#15803d' : '#b91c1c',
          fontSize: 13,
          fontWeight: 600,
        }}>
          {notice}
        </div>
      )}

      {activeTab === 'BROADCAST' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(360px, 1.15fr)', gap: 20, alignItems: 'start' }}>
          {/* Left: Compose Popup Alert */}
          <form onSubmit={handleSubmit} style={{ background: '#ffffff', borderRadius: 16, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: '#eef2ff', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Send size={13} />
                </span>
                Send Portal Alert
              </h3>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
                background: showAsPopup ? '#eef2ff' : '#f8fafc',
                border: `1px solid ${showAsPopup ? '#c7d2fe' : '#e2e8f0'}`,
                fontSize: 11.5, fontWeight: 700, color: showAsPopup ? '#4338ca' : '#64748b', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={showAsPopup}
                  onChange={(e) => setShowAsPopup(e.target.checked)}
                  style={{ margin: 0, accentColor: '#4f46e5' }}
                />
                Login Popup
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PortalAlertCategory)}
                  style={{ width: '100%', marginTop: 3, padding: '7px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12, color: '#0f172a' }}
                >
                  <option value="HOLIDAY">Holiday</option>
                  <option value="IMPORTANT_NEWS">Important News</option>
                  <option value="URGENT_ALERT">Urgent Alert</option>
                  <option value="GENERAL">General Notice</option>
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                Priority
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PortalAlertPriority)}
                  style={{ width: '100%', marginTop: 3, padding: '7px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12, color: '#0f172a' }}
                >
                  <option value="INFO">Info (Blue)</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="WARNING">Warning</option>
                  <option value="URGENT">Emergency</option>
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                Expires
                <select
                  value={expiryPreset}
                  onChange={(e) => setExpiryPreset(e.target.value as any)}
                  style={{ width: '100%', marginTop: 3, padding: '7px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12, color: '#0f172a' }}
                >
                  <option value="TODAY">End of Today</option>
                  <option value="10M">10 Minutes</option>
                  <option value="1H">1 Hour</option>
                  <option value="7D">7 Days</option>
                  <option value="UNTIL_OFF">Until Paused</option>
                </select>
              </label>
            </div>

            <input
              type="text"
              required
              placeholder="Alert Title * (e.g. Tomorrow Office Holiday / Urgent Update)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '8px 11px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 600, color: '#0f172a' }}
            />

            <textarea
              required
              rows={3}
              placeholder="Write the popup message employees will see..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ width: '100%', padding: '8px 11px', borderRadius: 9, border: '1px solid #cbd5e1', fontSize: 13, resize: 'vertical', lineHeight: 1.45, color: '#0f172a' }}
            />

            {/* Compact Audience Selector */}
            <div style={{ padding: '10px 11px', borderRadius: 11, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>Audience</span>
                <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 2, borderRadius: 8, gap: 2 }}>
                  <button
                    type="button"
                    onClick={() => setTargetAllUnderHr(false)}
                    style={{
                      padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: !targetAllUnderHr ? '#ffffff' : 'transparent',
                      color: !targetAllUnderHr ? '#4338ca' : '#475569',
                      boxShadow: !targetAllUnderHr ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                    }}
                  >
                    Selected ({selectedEmpIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAllUnderHr(true)}
                    style={{
                      padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: targetAllUnderHr ? '#ffffff' : 'transparent',
                      color: targetAllUnderHr ? '#4338ca' : '#475569',
                      boxShadow: targetAllUnderHr ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
                    }}
                  >
                    All Employees
                  </button>
                </div>
              </div>

              {!targetAllUnderHr && (
                <>
                  {/* Side-by-Side Search + Quick Select Dropdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: 9 }} />
                      <input
                        type="text"
                        placeholder="Search name, code..."
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        style={{ width: '100%', padding: '6px 9px 6px 27px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, background: '#fff' }}
                      />
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        const id = e.target.value
                        if (!id) return
                        setSelectedEmpIds((prev) => {
                          const next = new Set(prev)
                          next.add(id)
                          return next
                        })
                      }}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1',
                        fontSize: 12, background: '#ffffff', color: '#0f172a', fontWeight: 600,
                      }}
                    >
                      <option value="">
                        + Add employee ({filteredEmployees.length})
                      </option>
                      {filteredEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.employeeCode} — {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected Employee Chips */}
                  {selectedEmpIds.size > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {employees
                        .filter((e) => selectedEmpIds.has(e.id))
                        .map((emp) => (
                          <span
                            key={emp.id}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '2px 8px', borderRadius: 999,
                              background: '#eef2ff', border: '1px solid #c7d2fe',
                              color: '#3730a3', fontSize: 11, fontWeight: 700,
                            }}
                          >
                            {emp.firstName} {emp.lastName}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEmpIds((prev) => {
                                  const next = new Set(prev)
                                  next.delete(emp.id)
                                  return next
                                })
                              }}
                              style={{ border: 'none', background: 'transparent', color: '#4338ca', cursor: 'pointer', fontWeight: 800, padding: 0, lineHeight: 1 }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Collapsible Multi-Select List (auto-expands when searching) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setEmpDropdownOpen((prev) => !prev)}
                      style={{ border: 'none', background: 'transparent', color: '#4f46e5', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      {(empDropdownOpen || empSearch.trim()) ? '▲ Hide Checklist' : '▼ Multi-Select Checklist'}
                    </button>
                    {selectedEmpIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedEmpIds(new Set())}
                        style={{ border: 'none', background: 'transparent', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {(empDropdownOpen || empSearch.trim().length > 0) && (
                    <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredEmployees.length === 0 ? (
                        <div style={{ padding: 10, textAlign: 'center', fontSize: 11.5, color: '#64748b' }}>No employees matched &ldquo;{empSearch}&rdquo;.</div>
                      ) : (
                        filteredEmployees.map((emp) => {
                          const checked = selectedEmpIds.has(emp.id)
                          return (
                            <label
                              key={emp.id}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                padding: '5px 8px', borderRadius: 7, cursor: 'pointer',
                                background: checked ? '#eef2ff' : '#ffffff',
                                border: `1px solid ${checked ? '#a5b4fc' : '#e2e8f0'}`,
                                fontSize: 11.5,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedEmpIds((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(emp.id)) next.delete(emp.id)
                                      else next.add(emp.id)
                                      return next
                                    })
                                  }}
                                />
                                <div>
                                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                                  </div>
                                  <div style={{ fontSize: 10.5, color: '#64748b' }}>{emp.email}</div>
                                </div>
                              </div>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={sending}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                boxShadow: '0 4px 12px rgba(79,70,229,0.22)',
              }}
            >
              <Send size={14} /> {sending ? 'Publishing...' : 'Send Portal Popup Alert'}
            </button>
          </form>

          {/* Right: Active & Past Alerts */}
          <div style={{ background: '#ffffff', borderRadius: 18, padding: 22, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#0f172a' }}>Published Portal Alerts</h3>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{alerts.length} Total</span>
            </div>

            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', borderRadius: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: 13 }}>
                No portal popup alerts sent yet. Create one on the left to notify employees when they open their portal.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {alerts.map((a) => {
                  const cat = CATEGORY_META[a.category] || CATEGORY_META.GENERAL
                  const pri = PRIORITY_META[a.priority] || PRIORITY_META.INFO
                  const expanded = expandedAlertId === a.id
                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAlertModal(a)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        borderLeft: `4px solid ${a.isActive ? pri.color : '#94a3b8'}`,
                        background: a.isActive ? '#ffffff' : '#f8fafc',
                        opacity: a.isActive ? 1 : 0.8,
                        cursor: 'pointer',
                        transition: 'box-shadow 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: cat.bg, color: cat.color }}>
                            {cat.label}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: pri.bg, color: pri.color }}>
                            {pri.label}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: a.isActive ? '#dcfce7' : '#e2e8f0', color: a.isActive ? '#15803d' : '#475569' }}>
                            {a.isActive ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {new Date(a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 8 }}>
                        {a.message.replace(/\s+/g, ' ')}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Users size={11} /> {a.acknowledgedCount} / {a.totalTargets} Acknowledged
                        </span>

                        <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleToggle(a.id)}
                            style={{
                              padding: '4px 9px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff',
                              color: a.isActive ? '#b45309' : '#15803d', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {a.isActive ? <><PauseCircle size={12} /> Pause</> : <><PlayCircle size={12} /> Activate</>}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(a.id)}
                            style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: 18, padding: 22, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: '#0f172a' }}>Incoming Leave &amp; Emergency Requests</h3>
          {incomingLeaves.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No pending leave alerts right now.</div>
          ) : (
            incomingLeaves.map((l: any) => (
              <div key={l.id} style={{ padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', background: l.type === 'SICK' ? '#fef2f2' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                    {l.type === 'SICK' ? '🚨 Emergency / Sick Leave' : 'Leave Request'}: {l.employee?.firstName} {l.employee?.lastName} ({l.employee?.employeeCode})
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{l.reason}</div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>
                  {new Date(l.fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Full Alert Details Popup Modal */}
      {selectedAlertModal && (() => {
        const cat = CATEGORY_META[selectedAlertModal.category] || CATEGORY_META.GENERAL
        const pri = PRIORITY_META[selectedAlertModal.priority] || PRIORITY_META.INFO
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Alert Full Details"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedAlertModal(null) }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)', zIndex: 1150,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
            <div style={{ background: '#ffffff', borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(15,23,42,0.28)', border: '1px solid #e2e8f0' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: cat.bg, color: cat.color }}>{cat.label}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: pri.bg, color: pri.color }}>{pri.label}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: selectedAlertModal.isActive ? '#dcfce7' : '#e2e8f0', color: selectedAlertModal.isActive ? '#15803d' : '#475569' }}>
                      {selectedAlertModal.isActive ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{selectedAlertModal.title}</h3>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                    Sent on {new Date(selectedAlertModal.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAlertModal(null)}
                  aria-label="Close alert details"
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '14px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13.5, color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {selectedAlertModal.message}
                </div>

                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                    Recipients ({selectedAlertModal.acknowledgedCount} / {selectedAlertModal.totalTargets} Acknowledged)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedAlertModal.recipients.map((r) => (
                      <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#ffffff', fontSize: 12.5 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{r.employee.firstName} {r.employee.lastName}</span>
                          <span style={{ color: '#64748b', marginLeft: 6 }}>({r.employee.employeeCode})</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 11.5, color: r.acknowledgedAt ? '#16a34a' : '#d97706' }}>
                          {r.acknowledgedAt ? `✓ Seen ${new Date(r.acknowledgedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

