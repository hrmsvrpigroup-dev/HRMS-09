import { useEffect, useState } from 'react'
import { leaveApi, LeaveItem } from '../../api/leave.api'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'
import { useAuthStore } from '../../store/auth.store'
import { triggerHrNotification } from '../../utils/notif'

export default function ApplyLeave() {
  const user = useAuthStore((state) => state.user)
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'An employee'
  const [requests, setRequests] = useState<LeaveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    type: 'CASUAL',
    fromDate: '',
    toDate: '',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const res = await leaveApi.list()
      setRequests(res.data.data)
    } catch {
      setError('Could not retrieve your leave requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const getLeaveLabel = (type: string) => {
    if (type === 'SICK') return 'Emergency / Sick Leave'
    if (type === 'CASUAL') return 'Casual Leave'
    if (type === 'MATERNITY') return 'Maternity Leave'
    return type
  }

  const validateLeaveRequest = (): string | null => {
    const { type, fromDate, toDate } = formData
    if (!['CASUAL', 'SICK', 'MATERNITY'].includes(type)) {
      return 'Only Casual Leave, Emergency Leave / Sick Leave, and Maternity Leave are allowed.'
    }
    if (!fromDate || !toDate) return 'Please select both Start Date and End Date.'

    const from = new Date(`${fromDate}T00:00:00Z`)
    const to = new Date(`${toDate}T00:00:00Z`)
    if (to < from) return 'End Date cannot be earlier than Start Date.'

    const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1

    if (type === 'CASUAL') {
      if (diffDays > 1) return 'Casual Leave is allowed for only 1 day per month.'
      const dow = from.getUTCDay()
      if (dow === 1 || dow === 5) return 'Casual Leave is not allowed on Monday or Friday.'
    }

    if (type === 'SICK' && diffDays > 1) {
      return 'Emergency Leave / Sick Leave is allowed for only 1 day per month.'
    }

    if (type === 'CASUAL' || type === 'SICK') {
      const targetYear = from.getUTCFullYear()
      const targetMonth = from.getUTCMonth()
      const usedDays = requests
        .filter((r) => {
          if (r.type !== type) return false
          if (r.status === 'REJECTED' || r.status === 'CANCELLED') return false
          const d = new Date(r.fromDate)
          return d.getUTCFullYear() === targetYear && d.getUTCMonth() === targetMonth
        })
        .reduce((sum, r) => sum + (r.days || 1), 0)

      if (usedDays + diffDays > 1) {
        return `${getLeaveLabel(type)} limit reached: only 1 day per month is allowed.`
      }
    }

    return null
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    setFormSuccess('')

    const validationError = validateLeaveRequest()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSubmitting(true)

    try {
      const res = await leaveApi.create(formData)
      setRequests((prev) => [res.data.data, ...prev])
      setFormSuccess('Leave request submitted successfully! Pending HR approval.')
      triggerHrNotification(`Employee ${fullName} applied for leave (${formData.type}): ${formData.reason}`)
      setFormData({
        type: 'CASUAL',
        fromDate: '',
        toDate: '',
        reason: '',
      })
      // Refetch to pull in relation objects
      const freshRes = await leaveApi.list()
      setRequests(freshRes.data.data)
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit leave request.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Leave Management</h1>
          <p>Submit timeoff leave requests and audit historically processed pipelines.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        {/* Leave application form */}
        <div className="card" style={{ maxWidth: '720px', width: '100%' }}>
          <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', marginBottom: '1.25rem' }}>
            Submit Timeoff Request
          </h3>

          {formSuccess && (
            <div
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                color: 'var(--success)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.88rem',
              }}
            >
              ✓ {formSuccess}
            </div>
          )}

          {formError && (
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: 'var(--error)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.88rem',
              }}
            >
              ✕ {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label>
              Leave Type Division
              <select
                value={formData.type}
                onChange={(event) => setFormData({ ...formData, type: event.target.value })}
                required
              >
                <option value="CASUAL">Casual Leave</option>
                <option value="SICK">Emergency Leave / Sick Leave</option>
                <option value="MATERNITY">Maternity Leave</option>
              </select>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                {formData.type === 'CASUAL' && 'Allowed: 1 day per month. Not allowed on Monday or Friday.'}
                {formData.type === 'SICK' && 'Allowed: 1 day per month.'}
                {formData.type === 'MATERNITY' && 'Maternity Leave policy applies.'}
              </span>
            </label>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ flex: 1 }}>
                Start Date
                <input
                  type="date"
                  value={formData.fromDate}
                  onChange={(event) => setFormData({ ...formData, fromDate: event.target.value })}
                  required
                />
              </label>

              <label style={{ flex: 1 }}>
                End Date
                <input
                  type="date"
                  value={formData.toDate}
                  onChange={(event) => setFormData({ ...formData, toDate: event.target.value })}
                  required
                />
              </label>
            </div>

            <label>
              Request Reason
              <textarea
                placeholder="Explain the reason for leave request..."
                rows={4}
                value={formData.reason}
                onChange={(event) => setFormData({ ...formData, reason: event.target.value })}
                required
              />
            </label>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'Submitting Leave...' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* Historic logs list (Full Width Professional View) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', margin: 0 }}>
              Request History Logs
            </h3>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '4px 12px', borderRadius: '999px' }}>
              Total Requests: {requests.length}
            </span>
          </div>

          {error ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--error)' }}>
              {error}
            </div>
          ) : (
            <div className="card table-container" style={{ margin: 0, width: '100%', overflowX: 'auto', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.9rem 1.15rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                    <th style={{ padding: '0.9rem 1.15rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leave Dates</th>
                    <th style={{ padding: '0.9rem 1.15rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Days</th>
                    <th style={{ padding: '0.9rem 1.15rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</th>
                    <th style={{ padding: '0.9rem 1.15rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decision Status / Signatory</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => {
                    const typeStyle =
                      item.type === 'CASUAL'
                        ? { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
                        : item.type === 'SICK'
                        ? { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
                        : { bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8' }

                    const statusStyle =
                      item.status === 'APPROVED'
                        ? { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
                        : item.status === 'PENDING'
                        ? { bg: '#fffbeb', color: '#b45309', border: '#fde68a' }
                        : { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' }

                    const fromFormatted = new Date(item.fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    const toFormatted = new Date(item.toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.95rem 1.15rem', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px',
                            fontSize: '0.75rem', fontWeight: 700, background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}`,
                          }}>
                            {getLeaveLabel(item.type)}
                          </span>
                        </td>
                        <td style={{ padding: '0.95rem 1.15rem', whiteSpace: 'nowrap', fontSize: '0.86rem', fontWeight: 600, color: '#0f172a' }}>
                          {fromFormatted === toFormatted ? fromFormatted : `${fromFormatted} → ${toFormatted}`}
                        </td>
                        <td style={{ padding: '0.95rem 1.15rem', textAlign: 'center', fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>
                          {item.days} {item.days === 1 ? 'day' : 'days'}
                        </td>
                        <td style={{ padding: '0.95rem 1.15rem', fontSize: '0.86rem', color: '#334155', maxWidth: '320px' }}>
                          {item.reason}
                        </td>
                        <td style={{ padding: '0.95rem 1.15rem', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: '999px',
                            fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.03em',
                            background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`,
                          }}>
                            {item.status}
                          </span>
                          {item.approvedBy && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', fontWeight: 500 }}>
                              by {item.approvedBy.firstName} {item.approvedBy.lastName || ''}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                        No leave requests submitted yet. Use the form above to apply.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
