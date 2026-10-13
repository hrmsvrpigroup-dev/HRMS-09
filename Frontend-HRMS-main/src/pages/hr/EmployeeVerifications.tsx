import React, { useEffect, useState } from 'react'
import { hrApi } from '../../api/hr.api'
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, Search, FileText, Check, X, ShieldAlert } from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://hrms-09.onrender.com/api').replace(/\/api$/, '')

export default function EmployeeVerifications() {
  const [stats, setStats] = useState({ pending: 0, verified: 0, approved: 0, rejected: 0 })
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [selectedEmp, setSelectedEmp] = useState<any>(null)
  
  const [actionModal, setActionModal] = useState<{ isOpen: boolean, type: 'VERIFY' | 'APPROVE' | 'REJECT', employeeId: string | null }>({ isOpen: false, type: 'VERIFY', employeeId: null })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchVerifications = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await hrApi.getVerifications()
      const payload = res?.data || res
      if (payload?.stats) {
        setStats(payload.stats)
      }
      if (Array.isArray(payload?.queue)) {
        setQueue(payload.queue)
      } else if (Array.isArray(payload)) {
        setQueue(payload)
      }
    } catch (err: any) {
      console.error('Failed to load verification queue:', err)
      setError(err?.response?.data?.message || err?.message || 'Failed to connect to verification queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVerifications()
  }, [])

  const handleAction = async () => {
    if (!actionModal.employeeId || submitting) return
    setSubmitting(true)
    try {
      await hrApi.updateVerificationAction(actionModal.employeeId, actionModal.type, notes, notes)
      setActionModal({ isOpen: false, type: 'VERIFY', employeeId: null })
      setNotes('')
      setSelectedEmp(null)
      fetchVerifications()
    } catch (err) {
      alert('Failed to update status')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredQueue = queue.filter(emp => {
    if (!emp) return false
    const currentStatus = emp.verification?.verificationStatus || 'PENDING_REVIEW'
    if (filter !== 'ALL' && currentStatus !== filter) return false
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      const firstName = (emp.firstName || '').toLowerCase()
      const lastName = (emp.lastName || '').toLowerCase()
      const employeeCode = (emp.employeeCode || '').toLowerCase()
      const email = (emp.email || '').toLowerCase()
      if (!firstName.includes(search) && !lastName.includes(search) && !employeeCode.includes(search) && !email.includes(search)) {
        return false
      }
    }
    return true
  })

  return (
    <div className="verifications-container">
      {/* Premium Header */}
      <div className="verifications-header glass-panel">
        <div className="header-text">
          <h1>HR Verification Panel</h1>
          <p>Review and approve new employee profiles and KYC documents.</p>
        </div>
        <button onClick={fetchVerifications} className="btn-outline">
          <Clock size={16} /> Refresh Queue
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card orange-glow glass-panel">
          <div className="stat-icon-wrapper text-orange"><Clock size={24} /></div>
          <div className="stat-details">
            <p className="stat-label">Needs Review</p>
            <p className="stat-value">{stats.pending}</p>
          </div>
        </div>
        <div className="stat-card green-glow glass-panel">
          <div className="stat-icon-wrapper text-green"><CheckCircle size={24} /></div>
          <div className="stat-details">
            <p className="stat-label">Approved</p>
            <p className="stat-value">{stats.approved}</p>
          </div>
        </div>
        <div className="stat-card red-glow glass-panel">
          <div className="stat-icon-wrapper text-red"><XCircle size={24} /></div>
          <div className="stat-details">
            <p className="stat-label">Rejected</p>
            <p className="stat-value">{stats.rejected}</p>
          </div>
        </div>
      </div>

      <div className="verifications-layout">
        {/* Left Side: Queue List */}
        <div className="queue-list-container glass-panel">
          <div className="queue-filters">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search by name or ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)} className="filter-select">
              <option value="ALL">All Status</option>
              <option value="PENDING_REVIEW">Needs Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Loading verification queue...</div>
          ) : error ? (
            <div className="empty-state" style={{ color: '#ef4444' }}>
              <p>{error}</p>
              <button onClick={fetchVerifications} className="btn-outline" style={{ marginTop: '10px' }}>
                Retry
              </button>
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="empty-state">No employees found in the queue.</div>
          ) : (
            <div className="queue-items">
              {filteredQueue.map(emp => {
                const isSelected = selectedEmp?.id === emp.id
                return (
                  <div key={emp.id} onClick={() => setSelectedEmp(emp)} className={`queue-item ${isSelected ? 'selected' : ''}`}>
                    <div className="queue-item-left">
                      <div className="queue-avatar">
                        {(emp.firstName?.[0] || 'E')}{(emp.lastName?.[0] || '')}
                      </div>
                      <div className="queue-info">
                        <h4>{emp.firstName} {emp.lastName}</h4>
                        <p>{emp.employeeCode} &bull; {emp.email}</p>
                      </div>
                    </div>
                    <div className="queue-status">
                      {emp.verification?.verificationStatus === 'PENDING_REVIEW' && <span className="status-badge badge-orange">NEEDS REVIEW</span>}
                      {emp.verification?.verificationStatus === 'VERIFIED' && <span className="status-badge badge-blue">VERIFIED</span>}
                      {emp.verification?.verificationStatus === 'APPROVED' && <span className="status-badge badge-green">APPROVED</span>}
                      {emp.verification?.verificationStatus === 'REJECTED' && <span className="status-badge badge-red">REJECTED</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Preview Panel */}
        <div className="preview-panel">
          {selectedEmp ? (
            <div className="glass-panel sticky-panel">
              <div className="preview-header">
                <h3>Verification Profile</h3>
                <p>Review submitted details and documents to proceed.</p>
              </div>

              <div className="profile-details-grid">
                <div className="detail-box">
                  <p className="detail-label">Employee Name</p>
                  <p className="detail-value">{selectedEmp.firstName} {selectedEmp.lastName}</p>
                </div>
                <div className="detail-box">
                  <p className="detail-label">Contact Details</p>
                  <p className="detail-value">{selectedEmp.email}</p>
                  <p className="detail-value">{selectedEmp.mobileNumber || selectedEmp.phone}</p>
                </div>
                <div className="detail-box">
                  <p className="detail-label">Role & Department</p>
                  <p className="detail-value">{selectedEmp.department?.name || 'N/A'} &bull; {selectedEmp.employmentType}</p>
                </div>
                <div className="detail-box">
                  <p className="detail-label">Payroll / Bank</p>
                  <p className="detail-value">A/C: {selectedEmp.payrollDetails?.accountNumber || 'N/A'}</p>
                  <p className="detail-value">PAN: {selectedEmp.payrollDetails?.panNumber || 'N/A'}</p>
                </div>
              </div>

              <div className="documents-section">
                <h4 className="docs-title"><FileText size={18} /> Uploaded Documents</h4>
                {selectedEmp.onboardingDocs && selectedEmp.onboardingDocs.length > 0 ? (
                  <div className="docs-list">
                    {selectedEmp.onboardingDocs.map((doc: any) => (
                      <div key={doc.id} className="doc-item">
                        <div className="doc-name">{doc.documentType}</div>
                        <a href={doc.fileUrl.startsWith('http') ? doc.fileUrl : `${API_BASE_URL}${doc.fileUrl.startsWith('/') ? '' : '/'}${doc.fileUrl}`} target="_blank" rel="noreferrer" className="btn-view-doc">
                          <Eye size={16} /> View
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-docs">No documents uploaded by this employee.</p>
                )}
              </div>

              <div className="action-buttons">
                {selectedEmp.verification?.verificationStatus === 'PENDING_REVIEW' && (
                  <div className="button-group">
                    <button onClick={() => setActionModal({ isOpen: true, type: 'APPROVE', employeeId: selectedEmp.id })} className="btn-approve">
                      <Check size={18} /> Approve
                    </button>
                    <button onClick={() => setActionModal({ isOpen: true, type: 'REJECT', employeeId: selectedEmp.id })} className="btn-reject">
                      <X size={18} /> Reject
                    </button>
                  </div>
                )}
                {selectedEmp.verification?.verificationStatus === 'REJECTED' && (
                  <div className="rejection-box">
                    <strong>Rejected Reason:</strong>
                    <p>{selectedEmp.verification?.rejectionReason || 'No reason provided.'}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-preview glass-panel">
              <div className="empty-icon-box">
                <ShieldAlert size={48} />
              </div>
              <p>Select an employee from the queue to review their verification profile and documents.</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {actionModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className={`modal-header ${actionModal.type === 'REJECT' ? 'bg-red' : actionModal.type === 'APPROVE' ? 'bg-green' : 'bg-blue'}`}>
              <h3>{actionModal.type === 'REJECT' ? 'Reject Application' : actionModal.type === 'APPROVE' ? 'Final Approve Employee' : 'Mark as Verified'}</h3>
            </div>
            <div className="modal-body">
              <label>
                {actionModal.type === 'REJECT' ? 'Rejection Reason / Notes (Required)' : 'Verification Notes (Optional)'}
              </label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Enter detailed notes..."
              ></textarea>
            </div>
            <div className="modal-footer">
              <button onClick={() => setActionModal({ isOpen: false, type: 'VERIFY', employeeId: null })} className="btn-cancel-modal">Cancel</button>
              <button 
                onClick={handleAction} 
                disabled={submitting} 
                className={`btn-confirm-modal ${actionModal.type === 'REJECT' ? 'btn-red' : actionModal.type === 'APPROVE' ? 'btn-green' : 'btn-blue'}`}
                style={submitting ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
              >
                {submitting ? 'Processing...' : `Confirm ${actionModal.type}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .verifications-container {
          max-width: 1400px;
          margin: 0 auto;
          font-family: 'Inter', system-ui, sans-serif;
          color: #1e293b;
        }

        .glass-panel {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
          border: 1px solid #f1f5f9;
        }

        .verifications-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          margin-bottom: 24px;
        }

        .header-text h1 {
          font-size: 1.8rem;
          font-weight: 800;
          margin: 0;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .header-text p {
          color: #64748b;
          margin: 4px 0 0 0;
          font-size: 0.95rem;
        }

        .btn-outline {
          padding: 10px 20px;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          background: transparent;
          color: #475569;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-outline:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 32px;
        }

        .stat-card {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.08);
        }

        .orange-glow:hover { border-color: #fed7aa; }
        .blue-glow:hover { border-color: #bfdbfe; }
        .green-glow:hover { border-color: #bbf7d0; }
        .red-glow:hover { border-color: #fecaca; }

        .stat-icon-wrapper {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .text-orange { color: #ea580c; background: #ffedd5; }
        .text-blue { color: #2563eb; background: #dbeafe; }
        .text-green { color: #16a34a; background: #dcfce3; }
        .text-red { color: #dc2626; background: #fee2e2; }

        .stat-label {
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.05em;
          margin: 0 0 4px 0;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          line-height: 1;
        }

        .verifications-layout {
          display: flex;
          gap: 32px;
          align-items: flex-start;
        }

        .queue-list-container {
          flex: 2;
          overflow: hidden;
        }

        .queue-filters {
          display: flex;
          gap: 16px;
          padding: 20px;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
        }

        .search-box {
          position: relative;
          flex-grow: 1;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-box input {
          width: 100%;
          padding: 12px 16px 12px 42px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 0.95rem;
          transition: all 0.2s;
          box-sizing: border-box;
          outline: none;
        }

        .search-box input:focus, .filter-select:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }

        .filter-select {
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 600;
          color: #475569;
          outline: none;
          cursor: pointer;
        }

        .empty-state {
          padding: 60px 20px;
          text-align: center;
          color: #94a3b8;
          font-weight: 500;
          font-size: 1.1rem;
        }

        .queue-items {
          display: flex;
          flex-direction: column;
        }

        .queue-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: all 0.2s;
        }

        .queue-item:hover { background: #f8fafc; }
        
        .queue-item.selected {
          background: #eef2ff;
          border-left: 4px solid #4f46e5;
        }

        .queue-item-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .queue-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #475569;
          font-size: 1.1rem;
        }

        .queue-item.selected .queue-avatar {
          background: #4f46e5;
          color: white;
        }

        .queue-info h4 {
          margin: 0 0 4px 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
        }

        .queue-item.selected .queue-info h4 { color: #312e81; }

        .queue-info p {
          margin: 0;
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 500;
        }

        .status-badge {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .badge-orange { background: #ffedd5; color: #ea580c; border: 1px solid #fdba74; }
        .badge-blue { background: #dbeafe; color: #2563eb; border: 1px solid #93c5fd; }
        .badge-green { background: #dcfce3; color: #16a34a; border: 1px solid #86efac; }
        .badge-red { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }

        .preview-panel {
          flex: 1;
        }

        .sticky-panel {
          position: sticky;
          top: 24px;
          padding: 32px;
        }

        .preview-header h3 {
          font-size: 1.4rem;
          font-weight: 800;
          margin: 0 0 8px 0;
          color: #0f172a;
        }

        .preview-header p {
          color: #64748b;
          margin: 0 0 24px 0;
          font-size: 0.9rem;
          padding-bottom: 24px;
          border-bottom: 1px solid #f1f5f9;
        }

        .profile-details-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          margin-bottom: 32px;
        }

        .detail-box {
          background: #f8fafc;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #f1f5f9;
        }

        .detail-label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.05em;
          margin: 0 0 6px 0;
        }

        .detail-value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .documents-section {
          margin-bottom: 32px;
        }

        .docs-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .docs-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .doc-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          transition: all 0.2s;
        }

        .doc-item:hover {
          border-color: #cbd5e1;
          background: #ffffff;
        }

        .doc-name {
          font-weight: 600;
          color: #334155;
          font-size: 0.95rem;
        }

        .btn-view-doc {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #eef2ff;
          color: #4f46e5;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.85rem;
          text-decoration: none;
          transition: all 0.2s;
        }

        .btn-view-doc:hover {
          background: #4f46e5;
          color: white;
        }

        .no-docs {
          color: #94a3b8;
          font-style: italic;
          font-size: 0.9rem;
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .button-group {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 12px;
        }

        .btn-verify {
          background: #2563eb;
          color: white;
          padding: 16px;
          border-radius: 12px;
          border: none;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .btn-verify:hover { background: #1d4ed8; transform: translateY(-2px); }

        .btn-reject {
          background: white;
          color: #ef4444;
          border: 2px solid #fecaca;
          padding: 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn-reject:hover { background: #fef2f2; border-color: #ef4444; }

        .btn-approve {
          background: #10b981;
          color: white;
          padding: 16px;
          border-radius: 12px;
          border: none;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-approve:hover { background: #059669; transform: translateY(-2px); }

        .rejection-box {
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 20px;
          border-radius: 12px;
          color: #991b1b;
        }

        .rejection-box strong { display: block; margin-bottom: 8px; font-size: 0.95rem; }
        .rejection-box p { margin: 0; font-size: 0.9rem; line-height: 1.5; }

        .empty-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 40px;
          text-align: center;
          min-height: 400px;
        }

        .empty-icon-box {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #cbd5e1;
          margin-bottom: 20px;
        }

        .empty-preview p {
          color: #64748b;
          font-size: 1.1rem;
          font-weight: 500;
          line-height: 1.5;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          width: 100%;
          max-width: 500px;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-header {
          padding: 20px 24px;
          color: white;
        }
        
        .modal-header h3 { margin: 0; font-size: 1.25rem; font-weight: 800; }
        
        .bg-red { background: #ef4444; }
        .bg-green { background: #10b981; }
        .bg-blue { background: #2563eb; }

        .modal-body { padding: 24px; }
        
        .modal-body label {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
          color: #475569;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .modal-body textarea {
          width: 100%;
          padding: 16px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          min-height: 120px;
          font-family: inherit;
          font-size: 0.95rem;
          resize: vertical;
          box-sizing: border-box;
          outline: none;
        }

        .modal-body textarea:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }

        .modal-footer {
          padding: 20px 24px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .btn-cancel-modal {
          padding: 10px 20px;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          background: white;
          color: #475569;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-cancel-modal:hover { background: #f1f5f9; }

        .btn-confirm-modal {
          padding: 10px 24px;
          border-radius: 10px;
          border: none;
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        .btn-red { background: #ef4444; } .btn-red:hover { background: #dc2626; }
        .btn-green { background: #10b981; } .btn-green:hover { background: #059669; }
        .btn-blue { background: #2563eb; } .btn-blue:hover { background: #1d4ed8; }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .verifications-layout { flex-direction: column; }
          .queue-list-container, .preview-panel { width: 100%; flex: auto; }
          .sticky-panel { position: static; }
        }
      `}</style>
    </div>
  )
}
