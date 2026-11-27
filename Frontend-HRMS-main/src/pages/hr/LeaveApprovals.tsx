import { useEffect, useState } from 'react'
import { leaveApi, LeaveItem } from '../../api/leave.api'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'

export default function LeaveApprovals() {
  const [requests, setRequests] = useState<LeaveItem[]>([])
  const [filteredRequests, setFilteredRequests] = useState<LeaveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter State
  const [statusFilter, setStatusFilter] = useState('PENDING')

  const fetchRequests = async (attempt = 0) => {
    try {
      setLoading(true)
      setError('')
      const res = await leaveApi.list()
      setRequests(res.data?.data || [])
    } catch (err: any) {
      if (attempt < 1) {
        setTimeout(() => fetchRequests(attempt + 1), 600)
        return
      }
      setError(err?.response?.data?.message || 'Could not retrieve workforce leave requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  // Apply filter locally
  useEffect(() => {
    if (statusFilter === 'ALL') {
      setFilteredRequests(requests)
    } else {
      setFilteredRequests(requests.filter((item) => item.status === statusFilter))
    }
  }, [statusFilter, requests])

  const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const updated = await leaveApi.approve(id, action)
      setRequests((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: updated.data.data.status, approvedBy: updated.data.data.approvedBy } : item))
      )
      // Refetch to pull in the resolver relationship properly (name of approvedBy user)
      const res = await leaveApi.list()
      setRequests(res.data.data)
    } catch {
      alert('Could not process leave request.')
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Leave Request Pipelines</h1>
          <p>Review, approve, or reject employee leave requests and document audit logs.</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '1rem',
          padding: '0.75rem 1.5rem',
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-glass)',
        }}
      >
        <button
          onClick={() => setStatusFilter('PENDING')}
          className="btn-secondary"
          style={{
            background: statusFilter === 'PENDING' ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' : 'rgba(255,255,255,0.02)',
            borderColor: statusFilter === 'PENDING' ? 'transparent' : 'var(--border-glass)',
            color: statusFilter === 'PENDING' ? '#fff' : 'var(--text-primary)',
            padding: '0.5rem 1.25rem',
            fontSize: '0.9rem',
          }}
        >
          Pending Review
        </button>

        <button
          onClick={() => setStatusFilter('APPROVED')}
          className="btn-secondary"
          style={{
            background: statusFilter === 'APPROVED' ? 'var(--success)' : 'rgba(255,255,255,0.02)',
            borderColor: statusFilter === 'APPROVED' ? 'transparent' : 'var(--border-glass)',
            color: statusFilter === 'APPROVED' ? '#fff' : 'var(--text-primary)',
            padding: '0.5rem 1.25rem',
            fontSize: '0.9rem',
          }}
        >
          Approved Leaves
        </button>

        <button
          onClick={() => setStatusFilter('REJECTED')}
          className="btn-secondary"
          style={{
            background: statusFilter === 'REJECTED' ? 'var(--error)' : 'rgba(255,255,255,0.02)',
            borderColor: statusFilter === 'REJECTED' ? 'transparent' : 'var(--border-glass)',
            color: statusFilter === 'REJECTED' ? '#fff' : 'var(--text-primary)',
            padding: '0.5rem 1.25rem',
            fontSize: '0.9rem',
          }}
        >
          Rejected Leaves
        </button>

        <button
          onClick={() => setStatusFilter('ALL')}
          className="btn-secondary"
          style={{
            background: statusFilter === 'ALL' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
            borderColor: statusFilter === 'ALL' ? 'rgba(255,255,255,0.2)' : 'var(--border-glass)',
            color: statusFilter === 'ALL' ? '#fff' : 'var(--text-primary)',
            padding: '0.5rem 1.25rem',
            fontSize: '0.9rem',
          }}
        >
          Show All Logs
        </button>
      </div>

      {error ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--error)' }}>
          <div style={{ marginBottom: '0.75rem', fontWeight: 600 }}>{error}</div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fetchRequests(0)}
            style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="card table-container" style={{ marginTop: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee Name</th>
                <th>Leave Type</th>
                <th>Leave Interval</th>
                <th>Total Days</th>
                <th>Request Reason</th>
                <th>Decision Status / Signatory</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                    {item.employee?.employeeCode}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.employee?.firstName} {item.employee?.lastName}
                  </td>
                  <td>
                    <span className="badge badge-info">{item.type}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                      From: {new Date(item.fromDate).toLocaleDateString()}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      To: {new Date(item.toDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.days} days</td>
                  <td>{item.reason}</td>
                  <td>
                    <span
                      className={`badge ${item.status === 'APPROVED'
                          ? 'badge-success'
                          : item.status === 'PENDING'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                    >
                      {item.status}
                    </span>
                    {item.approvedBy && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        by {item.approvedBy.firstName} {item.approvedBy.lastName}
                      </div>
                    )}
                  </td>
                  <td>
                    {item.status === 'PENDING' ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-primary"
                          style={{
                            background: 'var(--success)',
                            boxShadow: 'none',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.8rem',
                          }}
                          onClick={() => handleAction(item.id, 'APPROVED')}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-secondary"
                          style={{
                            borderColor: 'var(--error)',
                            color: 'hsl(0, 84%, 75%)',
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.8rem',
                          }}
                          onClick={() => handleAction(item.id, 'REJECTED')}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Processed</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    No leave requests found under this status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
