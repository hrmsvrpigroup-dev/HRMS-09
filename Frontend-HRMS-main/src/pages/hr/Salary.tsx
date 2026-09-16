import React, { useEffect, useState } from 'react'
import { payrollApi } from '../../api/payroll.api'
import {
  DollarSign, Users, TrendingUp, FileText,
  Edit3, CheckCircle, X, RefreshCw, Search,
  CreditCard, Building, Banknote, Shield, AlertCircle,
  PlusCircle, ThumbsUp, ThumbsDown, Zap, RotateCcw, Clock,
  Download
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EmployeeSalary {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  status: string
  salaryGross: number
  employmentType: string
  joiningDate: string
  department: { name: string } | null
  designation: { title: string } | null
  payrollDetails: {
    salaryStructure: string | null
    basicSalary: number
    paymentType: string | null
    bankName: string | null
    accountNumber: string | null
    ifscCode: string | null
    panNumber: string | null
    uanNumber: string | null
    pfEnabled: boolean
    esiEnabled: boolean
  } | null
  payroll: Array<{
    month: number
    year: number
    basicSalary: number
    hra: number
    allowances: number
    deductions: number
    pf: number
    tax: number
    netSalary: number
    status: string
    paidAt: string | null
  }>
}

interface PayrollRecord {
  id: string
  month: number
  year: number
  basicSalary: number
  hra: number
  allowances: number
  deductions: number
  pf: number
  tax: number
  netSalary: number
  status: string
  paidAt: string | null
  employee: {
    employeeCode: string
    firstName: string
    lastName: string
    email: string
    department: { name: string } | null
    designation: { title: string } | null
  }
}

interface SalaryAdvance {
  id: string
  employeeId: string
  amount: number
  reason: string
  repaymentMonths: number
  monthlyDeduction: number
  amountRepaid: number
  status: string
  rejectionReason: string | null
  disbursedAt: string | null
  approvedAt: string | null
  notes: string | null
  createdAt: string
  employee: {
    employeeCode: string
    firstName: string
    lastName: string
    department: { name: string } | null
    designation: { title: string } | null
  }
}

interface AdvanceStats {
  totalAdvances: number
  totalAmount: number
  pending: number
  approved: number
  disbursed: number
  disbursedAmount: number
  outstandingBalance: number
  repaid: number
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

// ─── Edit Salary Modal ───────────────────────────────────────────────────────
function EditSalaryModal({ emp, onClose, onSaved }: {
  emp: EmployeeSalary
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    salaryGross: String(emp.salaryGross || ''),
    salaryStructure: emp.payrollDetails?.salaryStructure || '',
    basicSalary: String(emp.payrollDetails?.basicSalary || emp.salaryGross || ''),
    paymentType: emp.payrollDetails?.paymentType || 'Bank Transfer',
    bankName: emp.payrollDetails?.bankName || '',
    accountNumber: emp.payrollDetails?.accountNumber || '',
    ifscCode: emp.payrollDetails?.ifscCode || '',
    panNumber: emp.payrollDetails?.panNumber || '',
    uanNumber: emp.payrollDetails?.uanNumber || '',
    pfEnabled: emp.payrollDetails?.pfEnabled ?? false,
    esiEnabled: emp.payrollDetails?.esiEnabled ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }
  const handleToggle = (name: string) => {
    setForm({ ...form, [name]: !(form as any)[name] })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await payrollApi.updateEmployeeSalary(emp.id, {
        salaryGross: Number(form.salaryGross),
        salaryStructure: form.salaryStructure,
        basicSalary: Number(form.basicSalary),
        paymentType: form.paymentType,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        panNumber: form.panNumber,
        uanNumber: form.uanNumber,
        pfEnabled: form.pfEnabled,
        esiEnabled: form.esiEnabled,
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="sal-overlay">
      <div className="sal-modal">
        <div className="sal-modal-header">
          <div>
            <h2>Edit Salary Details</h2>
            <p>{emp.firstName} {emp.lastName} · {emp.employeeCode}</p>
          </div>
          <button className="sal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {error && (
          <div className="sal-alert sal-alert-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="sal-modal-body">
          {/* Compensation */}
          <div className="sal-section-label"><DollarSign size={14} /> Compensation</div>
          <div className="sal-form-grid">
            <div className="sal-field">
              <label>Gross Annual Salary (₹)</label>
              <input type="number" name="salaryGross" value={form.salaryGross} onChange={handleChange} placeholder="e.g. 600000" />
            </div>
            <div className="sal-field">
              <label>Basic Monthly Salary (₹)</label>
              <input type="number" name="basicSalary" value={form.basicSalary} onChange={handleChange} placeholder="e.g. 30000" />
            </div>
            <div className="sal-field">
              <label>Salary Structure</label>
              <select name="salaryStructure" value={form.salaryStructure} onChange={handleChange}>
                <option value="">-- Select Structure --</option>
                <option value="STANDARD">Standard</option>
                <option value="EXECUTIVE">Executive</option>
                <option value="CONTRACTUAL">Contractual</option>
                <option value="INTERN">Intern</option>
              </select>
            </div>
            <div className="sal-field">
              <label>Payment Method</label>
              <select name="paymentType" value={form.paymentType} onChange={handleChange}>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Banking */}
          <div className="sal-section-label"><CreditCard size={14} /> Banking Details</div>
          <div className="sal-form-grid">
            <div className="sal-field">
              <label>Bank Name</label>
              <input type="text" name="bankName" value={form.bankName} onChange={handleChange} placeholder="e.g. HDFC Bank" />
            </div>
            <div className="sal-field">
              <label>Account Number</label>
              <input type="text" name="accountNumber" value={form.accountNumber} onChange={handleChange} placeholder="e.g. 1234567890" />
            </div>
            <div className="sal-field">
              <label>IFSC Code</label>
              <input type="text" name="ifscCode" value={form.ifscCode} onChange={handleChange} placeholder="e.g. HDFC0001234" />
            </div>
            <div className="sal-field">
              <label>PAN Number</label>
              <input type="text" name="panNumber" value={form.panNumber} onChange={handleChange} placeholder="e.g. ABCDE1234F" />
            </div>
            <div className="sal-field">
              <label>UAN Number</label>
              <input type="text" name="uanNumber" value={form.uanNumber} onChange={handleChange} placeholder="UAN (PF Account)" />
            </div>
          </div>

          {/* Statutory */}
          <div className="sal-section-label"><Shield size={14} /> Statutory Deductions</div>
          <div className="sal-toggle-row">
            <button
              type="button"
              className={`sal-toggle ${form.pfEnabled ? 'active' : ''}`}
              onClick={() => handleToggle('pfEnabled')}
            >
              <span className="sal-toggle-dot" />
              <span>PF Enabled (12% of Basic)</span>
            </button>
            <button
              type="button"
              className={`sal-toggle ${form.esiEnabled ? 'active' : ''}`}
              onClick={() => handleToggle('esiEnabled')}
            >
              <span className="sal-toggle-dot" />
              <span>ESI Enabled (0.75% of Gross)</span>
            </button>
          </div>
        </div>

        <div className="sal-modal-footer">
          <button className="sal-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="sal-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Upload Payslip Modal ───────────────────────────────────────────────────
function UploadPayslipModal({ employees, onClose, onSaved }: {
  employees: EmployeeSalary[]
  onClose: () => void
  onSaved: () => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [netSalary, setNetSalary] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [autoDetect, setAutoDetect] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const activeEmployees = employees.filter(e => e.status === 'ACTIVE')
  const filteredEmployees = activeEmployees.filter(e => {
    if (!empSearch.trim()) return true
    const q = empSearch.toLowerCase()
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase()
    const code = (e.employeeCode || '').toLowerCase()
    const dept = (e.department?.name || '').toLowerCase()
    return fullName.includes(q) || code.includes(q) || dept.includes(q)
  })

  const selectedEmployee = activeEmployees.find(e => e.id === employeeId)

  const handleSelectEmployee = (id: string) => {
    setEmployeeId(id)
    setError('')
    const emp = activeEmployees.find(e => e.id === id)
    if (emp && emp.salaryGross && (!netSalary || netSalary === '')) {
      const estimatedMonthlyNet = Math.round(((emp.salaryGross || 0) / 12) * 0.95)
      if (estimatedMonthlyNet > 0) {
        setNetSalary(String(estimatedMonthlyNet))
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
      setError('')
    }
  }

  const handleUpload = async () => {
    if ((!autoDetect && !employeeId) || !month || !year || !file) {
      setError(autoDetect ? 'Please select month, year, and a payslip PDF file.' : 'Please select an employee name, month, year, and payslip PDF file.')
      return
    }

    setUploading(true)
    setError('')
    setSuccessMsg('')

    try {
      const formData = new FormData()
      if (!autoDetect && employeeId) {
        formData.append('employeeId', employeeId)
      }
      formData.append('autoDetect', String(autoDetect))
      formData.append('month', String(month))
      formData.append('year', String(year))
      if (netSalary) {
        formData.append('netSalary', netSalary)
      }
      formData.append('payslip', file)

      await payrollApi.uploadPayslip(formData)
      setSuccessMsg('Salary slip uploaded and synced to employee portal successfully!')
      setTimeout(() => {
        onSaved()
        onClose()
      }, 700)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload salary slip')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="sal-overlay">
      <div className="sal-modal sal-modal-md" style={{ maxWidth: '620px' }}>
        <div className="sal-modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Upload Employee Salary Slip</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Select employee name and upload monthly PDF payslip statement to reflect directly on the employee's portal.
            </p>
          </div>
          <button className="sal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {error && (
          <div className="sal-alert sal-alert-error" style={{ margin: '14px 24px 0' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {successMsg && (
          <div className="sal-alert sal-alert-success" style={{ margin: '14px 24px 0', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        <div className="sal-modal-body" style={{ padding: '18px 24px 24px' }}>
          <div className="sal-form-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
            
            {/* Employee Selection Section */}
            <div className="sal-field full-width" style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. Select Target Employee <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                  <input 
                    type="checkbox" 
                    checked={autoDetect}
                    onChange={(e) => setAutoDetect(e.target.checked)}
                    style={{ width: '14px', height: '14px', accentColor: '#3b82f6' }}
                  />
                  <span>Auto-detect from PDF text</span>
                </label>
              </div>

              {!autoDetect ? (
                <div>
                  {activeEmployees.length > 6 && (
                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search employee name or code..."
                        value={empSearch}
                        onChange={e => setEmpSearch(e.target.value)}
                        style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  )}

                  <select 
                    value={employeeId} 
                    onChange={e => handleSelectEmployee(e.target.value)}
                    style={{ fontSize: '0.85rem', height: '40px', fontWeight: 600, background: '#ffffff', border: '1.5px solid #3b82f6', borderRadius: '6px', color: '#0f172a' }}
                  >
                    <option value="">-- Click to Choose Employee Name --</option>
                    {filteredEmployees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName} ({e.employeeCode}) {e.department?.name ? `• ${e.department.name}` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Selected Employee Info Pill */}
                  {selectedEmployee && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', color: '#ffffff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                          {selectedEmployee.firstName[0]}{selectedEmployee.lastName[0]}
                        </div>
                        <div>
                          <strong style={{ color: '#1e3a8a', fontSize: '0.82rem' }}>{selectedEmployee.firstName} {selectedEmployee.lastName}</strong>
                          <span style={{ color: '#64748b', marginLeft: '6px' }}>({selectedEmployee.employeeCode})</span>
                          <div style={{ color: '#475569', fontSize: '0.72rem' }}>
                            {selectedEmployee.designation?.title || selectedEmployee.department?.name || 'Full-time Employee'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Gross Annual CTC</span>
                        <div style={{ fontWeight: 700, color: '#16a34a' }}>
                          ₹{(selectedEmployee.salaryGross || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '10px 12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.78rem', color: '#475569', fontStyle: 'italic' }}>
                  ℹ️ Auto-detection active: The system will scan the PDF document for employee name or employee ID code.
                </div>
              )}
            </div>

            {/* Month & Year Selection */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="sal-field">
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                  2. Statement Month <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ fontSize: '0.85rem', height: '38px' }}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="sal-field">
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                  3. Statement Year <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ fontSize: '0.85rem', height: '38px' }}>
                  {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Net Salary Amount */}
            <div className="sal-field">
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                <span>4. Net Disbursed Salary (₹)</span>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Optional (Reflects as Net Pay)</span>
              </label>
              <input
                type="number"
                placeholder={selectedEmployee?.salaryGross ? `Estimated Net: ₹${Math.round((selectedEmployee.salaryGross / 12) * 0.95).toLocaleString('en-IN')}` : 'Defaults to standard net monthly pay'}
                value={netSalary}
                onChange={e => setNetSalary(e.target.value)}
                style={{ fontSize: '0.85rem', height: '38px' }}
              />
            </div>

            {/* Payslip PDF Document Upload */}
            <div className="sal-field">
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
                5. Payslip PDF Document <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{
                border: file ? '2px solid #22c55e' : '2px dashed #94a3b8',
                borderRadius: '10px',
                padding: '20px 16px',
                background: file ? '#f0fdf4' : '#f8fafc',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                {file ? (
                  <div>
                    <CheckCircle size={28} style={{ color: '#16a34a', margin: '0 auto 6px' }} />
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
                      📄 {file.name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                      {(file.size / 1024).toFixed(1)} KB — Click or drag to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <FileText size={28} style={{ color: '#3b82f6', margin: '0 auto 6px' }} />
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                      Click or Drag &amp; Drop PDF Payslip
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                      Supports standard PDF payslips up to 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sal-modal-footer" style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="sal-btn-cancel" onClick={onClose} style={{ padding: '8px 18px', fontSize: '0.82rem' }}>
            Cancel
          </button>
          <button 
            className="sal-btn-save sal-btn-success" 
            onClick={handleUpload} 
            disabled={uploading || (!autoDetect && !employeeId) || !file}
            style={{ padding: '8px 22px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {uploading ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Uploading &amp; Syncing...
              </>
            ) : (
              'Upload & Sync to Portal'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Salary Page ────────────────────────────────────────────────────────
export default function Salary() {
  const [tab, setTab] = useState<'overview' | 'payroll' | 'advances'>('overview')
  const [employees, setEmployees] = useState<EmployeeSalary[]>([])
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editEmp, setEditEmp] = useState<EmployeeSalary | null>(null)
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  // Advance state
  const [advances, setAdvances] = useState<SalaryAdvance[]>([])
  const [advanceStats, setAdvanceStats] = useState<AdvanceStats | null>(null)
  const [advanceLoading, setAdvanceLoading] = useState(false)
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('ALL')
  const [showCreateAdvance, setShowCreateAdvance] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [repayModal, setRepayModal] = useState<{ id: string; outstanding: number } | null>(null)
  const [repayAmount, setRepayAmount] = useState('')
  const [advanceForm, setAdvanceForm] = useState({
    employeeId: '', amount: '', reason: '', repaymentMonths: '3', notes: ''
  })
  const [advanceSaving, setAdvanceSaving] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Load employees with salary
  const loadEmployees = async () => {
    setLoading(true)
    try {
      const res = await payrollApi.getEmployeeSalaries()
      setEmployees(res.data.data)
    } catch {
      showToast('Failed to load salary data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Load payroll records for selected month/year
  const loadPayroll = async () => {
    setPayrollLoading(true)
    try {
      const res = await payrollApi.getPayrollRecords(selectedMonth, selectedYear)
      setPayrollRecords(res.data.data)
    } catch {
      showToast('Failed to load payroll records', 'error')
    } finally {
      setPayrollLoading(false)
    }
  }

  useEffect(() => { loadEmployees() }, [])
  useEffect(() => { if (tab === 'payroll') loadPayroll() }, [tab, selectedMonth, selectedYear])
  useEffect(() => { if (tab === 'advances') loadAdvances() }, [tab, advanceStatusFilter])

  const loadAdvances = async () => {
    setAdvanceLoading(true)
    try {
      const [listRes, statsRes] = await Promise.all([
        payrollApi.listAdvances(advanceStatusFilter === 'ALL' ? undefined : advanceStatusFilter),
        payrollApi.getAdvanceStats(),
      ])
      setAdvances(listRes.data.data)
      setAdvanceStats(statsRes.data.data)
    } catch {
      showToast('Failed to load advance data', 'error')
    } finally {
      setAdvanceLoading(false)
    }
  }

  const handleCreateAdvance = async () => {
    if (!advanceForm.employeeId || !advanceForm.amount || !advanceForm.reason) {
      showToast('Employee, amount and reason are required', 'error')
      return
    }
    setAdvanceSaving(true)
    try {
      await payrollApi.createAdvance({
        employeeId: advanceForm.employeeId,
        amount: Number(advanceForm.amount),
        reason: advanceForm.reason,
        repaymentMonths: Number(advanceForm.repaymentMonths) || 3,
        notes: advanceForm.notes || undefined,
      })
      setShowCreateAdvance(false)
      setAdvanceForm({ employeeId: '', amount: '', reason: '', repaymentMonths: '3', notes: '' })
      showToast('Advance request created')
      await loadAdvances()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to create advance', 'error')
    } finally {
      setAdvanceSaving(false)
    }
  }

  const handleAdvanceAction = async (action: () => Promise<any>, successMsg: string) => {
    try {
      await action()
      showToast(successMsg)
      await loadAdvances()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Action failed', 'error')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await payrollApi.generatePayroll(selectedMonth, selectedYear)
      showToast(res.data.message || 'Payroll generated successfully')
      await loadPayroll()
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to generate payroll', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleMarkPaid = async (id: string) => {
    try {
      await payrollApi.markAsPaid(id)
      showToast('Marked as paid')
      await loadPayroll()
    } catch {
      showToast('Failed to update status', 'error')
    }
  }

  // Stats
  const totalPayroll = employees.reduce((s, e) => s + (e.salaryGross || 0), 0)
  const activeCount = employees.filter(e => e.status === 'ACTIVE').length
  const avgSalary = activeCount ? Math.round(employees.reduce((s, e) => s + e.salaryGross, 0) / activeCount) : 0
  const pfEnrolled = employees.filter(e => e.payrollDetails?.pfEnabled).length

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      (e.department?.name || '').toLowerCase().includes(q)
    )
  })

  const totalNetPayroll = payrollRecords.reduce((s, r) => s + r.netSalary, 0)
  const paidCount = payrollRecords.filter(r => r.status === 'PAID').length

  return (
    <div className="sal-page">
      {/* Toast */}
      {toast && (
        <div className={`sal-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Edit Modal */}
      {editEmp && (
        <EditSalaryModal
          emp={editEmp}
          onClose={() => setEditEmp(null)}
          onSaved={loadEmployees}
        />
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="sal-overlay">
          <div className="sal-modal sal-modal-sm">
            <div className="sal-modal-header">
              <h2>Reject Advance Request</h2>
              <button className="sal-close-btn" onClick={() => { setRejectModal(null); setRejectReason(''); }}><X size={20} /></button>
            </div>
            <div className="sal-modal-body">
              <div className="sal-field">
                <label>Reason for Rejection</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Ineligible based on policy"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="sal-modal-footer">
              <button className="sal-btn-cancel" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Cancel</button>
              <button
                className="sal-btn-save sal-btn-danger"
                disabled={!rejectReason}
                onClick={() => {
                  handleAdvanceAction(
                    () => payrollApi.rejectAdvance(rejectModal.id, rejectReason),
                    'Advance request rejected'
                  )
                  setRejectModal(null)
                  setRejectReason('')
                }}
              >Reject Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Repay Modal */}
      {repayModal && (
        <div className="sal-overlay">
          <div className="sal-modal sal-modal-sm">
            <div className="sal-modal-header">
              <h2>Record Manual Repayment</h2>
              <button className="sal-close-btn" onClick={() => { setRepayModal(null); setRepayAmount(''); }}><X size={20} /></button>
            </div>
            <div className="sal-modal-body">
              <p className="sal-hint mb-3">Outstanding Balance: <strong>₹{repayModal.outstanding.toLocaleString('en-IN')}</strong></p>
              <div className="sal-field">
                <label>Repayment Amount (₹)</label>
                <input
                  autoFocus
                  type="number"
                  placeholder="Amount"
                  value={repayAmount}
                  max={repayModal.outstanding}
                  onChange={e => setRepayAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="sal-modal-footer">
              <button className="sal-btn-cancel" onClick={() => { setRepayModal(null); setRepayAmount(''); }}>Cancel</button>
              <button
                className="sal-btn-save sal-btn-success"
                disabled={!repayAmount || Number(repayAmount) <= 0 || Number(repayAmount) > repayModal.outstanding}
                onClick={() => {
                  handleAdvanceAction(
                    () => payrollApi.recordRepayment(repayModal.id, Number(repayAmount)),
                    'Repayment recorded'
                  )
                  setRepayModal(null)
                  setRepayAmount('')
                }}
              >Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Payslip Modal */}
      {showUpload && (
        <UploadPayslipModal
          employees={employees}
          onClose={() => setShowUpload(false)}
          onSaved={() => {
            loadEmployees()
            loadPayroll()
          }}
        />
      )}

      {/* Create Advance Modal */}
      {showCreateAdvance && (
        <div className="sal-overlay">
          <div className="sal-modal">
            <div className="sal-modal-header">
              <h2>New Salary Advance Request</h2>
              <button className="sal-close-btn" onClick={() => setShowCreateAdvance(false)}><X size={20} /></button>
            </div>
            <div className="sal-modal-body">
              <div className="sal-form-grid">
                <div className="sal-field full-width">
                  <label>Select Employee</label>
                  <select
                    value={advanceForm.employeeId}
                    onChange={e => setAdvanceForm({ ...advanceForm, employeeId: e.target.value })}
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.filter(e => e.status === 'ACTIVE').map(e => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>
                    ))}
                  </select>
                </div>
                <div className="sal-field">
                  <label>Amount Requested (₹)</label>
                  <input
                    type="number"
                    value={advanceForm.amount}
                    onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                    placeholder="e.g. 50000"
                  />
                </div>
                <div className="sal-field">
                  <label>Repayment Duration (Months)</label>
                  <select
                    value={advanceForm.repaymentMonths}
                    onChange={e => setAdvanceForm({ ...advanceForm, repaymentMonths: e.target.value })}
                  >
                    <option value="1">1 Month</option>
                    <option value="2">2 Months</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>
                {advanceForm.amount && advanceForm.repaymentMonths && (
                  <div className="sal-field full-width sal-deduction-preview">
                    <AlertCircle size={14} /> Estimated Monthly Deduction: 
                    <strong> ₹{Math.round(Number(advanceForm.amount) / Number(advanceForm.repaymentMonths)).toLocaleString('en-IN')}</strong>
                  </div>
                )}
                <div className="sal-field full-width">
                  <label>Reason for Advance</label>
                  <input
                    type="text"
                    value={advanceForm.reason}
                    onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                    placeholder="e.g. Medical Emergency, Home Renovation"
                  />
                </div>
                <div className="sal-field full-width">
                  <label>Additional Notes (Optional)</label>
                  <input
                    type="text"
                    value={advanceForm.notes}
                    onChange={e => setAdvanceForm({ ...advanceForm, notes: e.target.value })}
                    placeholder="Internal reference details"
                  />
                </div>
              </div>
            </div>
            <div className="sal-modal-footer">
              <button className="sal-btn-cancel" onClick={() => setShowCreateAdvance(false)}>Cancel</button>
              <button className="sal-btn-save" onClick={handleCreateAdvance} disabled={advanceSaving}>
                {advanceSaving ? 'Creating...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sal-header">
        <div>
          <h1>Salary Management</h1>
          <p>Manage employee compensation, payroll generation & payment tracking</p>
        </div>
        <div className="sal-header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button className="sal-btn-outline" onClick={loadEmployees}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="sal-btn-generate sal-btn-success" style={{ margin: 0, height: '40px' }} onClick={() => setShowUpload(true)}>
            <PlusCircle size={15} /> Upload Salary Slip
          </button>
          <button
            className="sal-btn-generate"
            style={{
              margin: 0,
              height: '40px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 14px rgba(99,102,241,0.35)'
            }}
            onClick={() => window.print()}
          >
            <Download size={15} /> Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sal-kpi-grid">
        <div className="sal-kpi-card sal-kpi-blue">
          <div className="sal-kpi-icon"><DollarSign size={22} /></div>
          <div>
            <div className="sal-kpi-value">₹{(totalPayroll / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <div className="sal-kpi-label">Monthly Payroll (Gross)</div>
          </div>
        </div>
        <div className="sal-kpi-card sal-kpi-green">
          <div className="sal-kpi-icon"><Users size={22} /></div>
          <div>
            <div className="sal-kpi-value">{activeCount}</div>
            <div className="sal-kpi-label">Active Employees</div>
          </div>
        </div>
        <div className="sal-kpi-card sal-kpi-purple">
          <div className="sal-kpi-icon"><TrendingUp size={22} /></div>
          <div>
            <div className="sal-kpi-value">₹{avgSalary.toLocaleString('en-IN')}</div>
            <div className="sal-kpi-label">Avg. Annual Salary</div>
          </div>
        </div>
        <div className="sal-kpi-card sal-kpi-amber">
          <div className="sal-kpi-icon"><Shield size={22} /></div>
          <div>
            <div className="sal-kpi-value">{pfEnrolled}</div>
            <div className="sal-kpi-label">PF Enrolled</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sal-tab-bar">
        <button className={`sal-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          <Users size={15} /> Employee Salaries
        </button>
        <button className={`sal-tab ${tab === 'payroll' ? 'active' : ''}`} onClick={() => setTab('payroll')}>
          <FileText size={15} /> Payroll Register
        </button>
        <button className={`sal-tab ${tab === 'advances' ? 'active' : ''}`} onClick={() => setTab('advances')}>
          <Zap size={15} /> Salary Advances
          {advanceStats && advanceStats.pending > 0 && (
            <span className="sal-tab-badge">{advanceStats.pending}</span>
          )}
        </button>
      </div>

      {/* ── TAB 1: Employee Salary Overview ── */}
      {tab === 'overview' && (
        <div className="sal-card">
          {/* Toolbar */}
          <div className="sal-toolbar">
            <div className="sal-search-box">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search by name, code, department..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="sal-emp-count">{filtered.length} employees</div>
          </div>

          {loading ? (
            <div className="sal-loading">Loading salary data...</div>
          ) : filtered.length === 0 ? (
            <div className="sal-empty">No employees found.</div>
          ) : (
            <div className="sal-table-wrap">
              <table className="sal-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Type</th>
                    <th>Annual Gross</th>
                    <th>Basic / mo</th>
                    <th>PF</th>
                    <th>ESI</th>
                    <th>Bank</th>
                    <th>Last Payroll</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => {
                    const lastPay = emp.payroll?.[0]
                    const isExpanded = expandedId === emp.id
                    return (
                      <React.Fragment key={emp.id}>
                        <tr
                          className={`sal-row ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                        >
                          <td>
                            <div className="sal-emp-info">
                              <div className="sal-avatar">{emp.firstName[0]}{emp.lastName[0]}</div>
                              <div>
                                <div className="sal-emp-name">{emp.firstName} {emp.lastName}</div>
                                <div className="sal-emp-code">{emp.employeeCode} · {emp.designation?.title || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="sal-dept-badge">
                              <Building size={11} />
                              {emp.department?.name || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={`sal-status-badge ${emp.employmentType.toLowerCase()}`}>
                              {emp.employmentType.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="sal-money">₹{emp.salaryGross.toLocaleString('en-IN')}</td>
                          <td className="sal-money">
                            {emp.payrollDetails?.basicSalary
                              ? `₹${emp.payrollDetails.basicSalary.toLocaleString('en-IN')}`
                              : <span className="sal-na">Not set</span>}
                          </td>
                          <td>
                            {emp.payrollDetails?.pfEnabled && emp.payrollDetails?.basicSalary ? (
                              <div>
                                <div className="sal-money-sm" style={{ fontWeight: 600 }}>
                                  ₹{Math.min(1800, emp.payrollDetails.basicSalary * 0.12).toLocaleString('en-IN')}/mo
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  ₹{(Math.min(1800, emp.payrollDetails.basicSalary * 0.12) * 12).toLocaleString('en-IN')}/yr
                                </div>
                              </div>
                            ) : (
                              <span className="sal-na">—</span>
                            )}
                          </td>
                          <td>
                            <span className={`sal-bool ${emp.payrollDetails?.esiEnabled ? 'yes' : 'no'}`}>
                              {emp.payrollDetails?.esiEnabled ? '✓' : '—'}
                            </span>
                          </td>
                          <td>
                            {emp.payrollDetails?.bankName
                              ? <span className="sal-bank">{emp.payrollDetails.bankName}</span>
                              : <span className="sal-na">—</span>}
                          </td>
                          <td>
                            {lastPay ? (
                              <div>
                                <div className="sal-money-sm">₹{lastPay.netSalary.toLocaleString('en-IN')}</div>
                                <div className="sal-pay-meta">{MONTHS[lastPay.month - 1]} {lastPay.year}</div>
                              </div>
                            ) : <span className="sal-na">—</span>}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button
                              className="sal-edit-btn"
                              onClick={() => setEditEmp(emp)}
                            >
                              <Edit3 size={14} /> Edit
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr className="sal-detail-row">
                            <td colSpan={10}>
                              <div className="sal-detail-grid">
                                <div className="sal-detail-block">
                                  <div className="sal-detail-title"><Banknote size={13} /> Banking</div>
                                  <div className="sal-detail-item"><span>Account</span>{emp.payrollDetails?.accountNumber || '—'}</div>
                                  <div className="sal-detail-item"><span>IFSC</span>{emp.payrollDetails?.ifscCode || '—'}</div>
                                  <div className="sal-detail-item"><span>Payment Mode</span>{emp.payrollDetails?.paymentType || '—'}</div>
                                </div>
                                <div className="sal-detail-block">
                                  <div className="sal-detail-title"><FileText size={13} /> Tax & Compliance</div>
                                  <div className="sal-detail-item"><span>PAN</span>{emp.payrollDetails?.panNumber || '—'}</div>
                                  <div className="sal-detail-item"><span>UAN</span>{emp.payrollDetails?.uanNumber || '—'}</div>
                                  <div className="sal-detail-item"><span>Structure</span>{emp.payrollDetails?.salaryStructure || '—'}</div>
                                </div>
                                <div className="sal-detail-block">
                                  <div className="sal-detail-title"><TrendingUp size={13} /> Last Payroll Breakdown</div>
                                  {lastPay ? (
                                    <>
                                      <div className="sal-detail-item"><span>Basic</span>₹{lastPay.basicSalary.toLocaleString('en-IN')}</div>
                                      <div className="sal-detail-item"><span>HRA</span>₹{lastPay.hra.toLocaleString('en-IN')}</div>
                                      <div className="sal-detail-item"><span>Allowances</span>₹{lastPay.allowances.toLocaleString('en-IN')}</div>
                                      <div className="sal-detail-item"><span>PF Deduction</span>₹{lastPay.pf.toLocaleString('en-IN')}</div>
                                      <div className="sal-detail-item"><span>Tax</span>₹{lastPay.tax.toLocaleString('en-IN')}</div>
                                      <div className="sal-detail-item sal-net"><span>Net Salary</span>₹{lastPay.netSalary.toLocaleString('en-IN')}</div>
                                    </>
                                  ) : <div className="sal-na">No payroll generated yet.</div>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Payroll Register ── */}
      {tab === 'payroll' && (
        <div className="sal-card">
          {/* Payroll Controls */}
          <div className="sal-payroll-controls">
            <div className="sal-period-selector">
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              className="sal-btn-generate"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating
                ? <><RefreshCw size={15} className="spin" /> Generating...</>
                : <><FileText size={15} /> Generate Payroll</>}
            </button>
          </div>

          {/* Payroll Summary Bar */}
          {payrollRecords.length > 0 && (
            <div className="sal-payroll-summary">
              <div className="sal-summary-item">
                <span>Total Employees</span>
                <strong>{payrollRecords.length}</strong>
              </div>
              <div className="sal-summary-item">
                <span>Total Net Payroll</span>
                <strong>₹{totalNetPayroll.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
              </div>
              <div className="sal-summary-item">
                <span>Paid</span>
                <strong className="sal-paid-count">{paidCount} / {payrollRecords.length}</strong>
              </div>
            </div>
          )}

          {payrollLoading ? (
            <div className="sal-loading">Loading payroll records...</div>
          ) : payrollRecords.length === 0 ? (
            <div className="sal-empty">
              <FileText size={36} />
              <p>No payroll records for {MONTHS[selectedMonth - 1]} {selectedYear}.</p>
              <p className="sal-hint">Click "Generate Payroll" to create records for all active employees.</p>
            </div>
          ) : (
            <div className="sal-table-wrap">
              <table className="sal-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Basic</th>
                    <th>HRA</th>
                    <th>Allowances</th>
                    <th>PF</th>
                    <th>Tax</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.map(rec => (
                    <tr key={rec.id}>
                      <td>
                        <div className="sal-emp-info">
                          <div className="sal-avatar sm">{rec.employee.firstName[0]}{rec.employee.lastName[0]}</div>
                          <div>
                            <div className="sal-emp-name">{rec.employee.firstName} {rec.employee.lastName}</div>
                            <div className="sal-emp-code">{rec.employee.employeeCode}</div>
                          </div>
                        </div>
                      </td>
                      <td>{rec.employee.department?.name || '—'}</td>
                      <td className="sal-money-sm">₹{rec.basicSalary.toLocaleString('en-IN')}</td>
                      <td className="sal-money-sm">₹{rec.hra.toLocaleString('en-IN')}</td>
                      <td className="sal-money-sm">₹{rec.allowances.toLocaleString('en-IN')}</td>
                      <td className="sal-money-sm sal-deduction">₹{rec.pf.toLocaleString('en-IN')}</td>
                      <td className="sal-money-sm sal-deduction">₹{rec.tax.toLocaleString('en-IN')}</td>
                      <td className="sal-money sal-net-col">₹{rec.netSalary.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`sal-pay-status ${rec.status.toLowerCase()}`}>
                          {rec.status}
                        </span>
                      </td>
                      <td>
                        {rec.status !== 'PAID' ? (
                          <button
                            className="sal-mark-paid-btn"
                            onClick={() => handleMarkPaid(rec.id)}
                          >
                            <CheckCircle size={13} /> Mark Paid
                          </button>
                        ) : (
                          <span className="sal-paid-date">
                            {rec.paidAt ? new Date(rec.paidAt).toLocaleDateString('en-IN') : 'Paid'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Salary Advances ── */}
      {tab === 'advances' && (
        <div className="sal-card">
          {/* Advance Toolbar */}
          <div className="sal-toolbar sal-advance-toolbar">
            <div className="sal-search-box">
              <Search size={15} />
              <select
                value={advanceStatusFilter}
                onChange={e => setAdvanceStatusFilter(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: '#1e293b' }}
              >
                <option value="ALL">All Advance Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved (Awaiting Disbursal)</option>
                <option value="DISBURSED">Active (Disbursed)</option>
                <option value="REPAID">Fully Repaid</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            <button className="sal-btn-generate sal-btn-success" onClick={() => setShowCreateAdvance(true)}>
              <PlusCircle size={15} /> New Advance Request
            </button>
          </div>

          {advanceLoading ? (
            <div className="sal-loading">Loading salary advances...</div>
          ) : advances.length === 0 ? (
            <div className="sal-empty">
              <Banknote size={36} />
              <p>No salary advances found matching the filter.</p>
            </div>
          ) : (
            <div className="sal-table-wrap">
              <table className="sal-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Requested</th>
                    <th>Details</th>
                    <th>Repayment Progress</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map(adv => {
                    const outstanding = adv.amount - adv.amountRepaid
                    const progress = Math.round((adv.amountRepaid / adv.amount) * 100)
                    return (
                      <tr key={adv.id}>
                        <td>
                          <div className="sal-emp-info">
                            <div className="sal-avatar sm">{adv.employee.firstName[0]}{adv.employee.lastName[0]}</div>
                            <div>
                              <div className="sal-emp-name">{adv.employee.firstName} {adv.employee.lastName}</div>
                              <div className="sal-emp-code">{adv.employee.employeeCode} · {adv.employee.department?.name || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="sal-money">₹{adv.amount.toLocaleString('en-IN')}</div>
                          <div className="sal-pay-meta">{new Date(adv.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td>
                          <div className="sal-adv-reason">{adv.reason}</div>
                          <div className="sal-pay-meta">{adv.repaymentMonths} months @ ₹{adv.monthlyDeduction.toLocaleString('en-IN')}/mo</div>
                        </td>
                        <td>
                          <div className="sal-progress-wrap">
                            <div className="sal-progress-labels">
                              <span>₹{adv.amountRepaid.toLocaleString('en-IN')} paid</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="sal-progress-bg">
                              <div className="sal-progress-fill" style={{ width: `${progress}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`sal-pay-status ${adv.status.toLowerCase()}`}>
                            {adv.status}
                          </span>
                        </td>
                        <td>
                          <div className="sal-adv-actions">
                            {adv.status === 'PENDING' && (
                              <>
                                <button className="sal-icon-btn approve" title="Approve" onClick={() => handleAdvanceAction(() => payrollApi.approveAdvance(adv.id), 'Advance approved')}>
                                  <ThumbsUp size={15} />
                                </button>
                                <button className="sal-icon-btn reject" title="Reject" onClick={() => setRejectModal({ id: adv.id })}>
                                  <ThumbsDown size={15} />
                                </button>
                              </>
                            )}
                            {adv.status === 'APPROVED' && (
                              <button className="sal-icon-btn disburse" title="Mark as Disbursed" onClick={() => handleAdvanceAction(() => payrollApi.disburseAdvance(adv.id), 'Advance disbursed')}>
                                <Banknote size={15} /> Disburse
                              </button>
                            )}
                            {adv.status === 'DISBURSED' && (
                              <button className="sal-icon-btn repay" title="Record Manual Repayment" onClick={() => setRepayModal({ id: adv.id, outstanding })}>
                                <RotateCcw size={15} /> Repay
                              </button>
                            )}
                            {(adv.status === 'REPAID' || adv.status === 'REJECTED') && (
                              <span className="sal-na">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`
        /* ─── Page Layout ─── */
        .sal-page {
          font-family: 'Inter', system-ui, sans-serif;
          color: #1e293b;
          max-width: 1400px;
          position: relative;
        }

        /* ─── Toast ─── */
        .sal-toast {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 22px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          animation: slideInRight 0.3s ease-out;
        }
        .sal-toast.success { background: #10b981; color: white; }
        .sal-toast.error   { background: #ef4444; color: white; }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }

        /* ─── Header ─── */
        .sal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 28px;
        }
        .sal-header h1 {
          font-size: 1.75rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
          letter-spacing: -0.02em;
        }
        .sal-header p { color: #64748b; margin: 0; font-size: 0.95rem; }
        .sal-header-actions { display: flex; gap: 10px; }

        /* ─── KPI Cards ─── */
        .sal-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }
        .sal-kpi-card {
          border-radius: 16px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 18px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          border: 1px solid rgba(255,255,255,0.6);
        }
        .sal-kpi-icon {
          width: 52px; height: 52px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sal-kpi-blue  { background: linear-gradient(135deg, #eff6ff, #dbeafe); }
        .sal-kpi-blue  .sal-kpi-icon { background: #3b82f6; color: white; }
        .sal-kpi-green { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
        .sal-kpi-green .sal-kpi-icon { background: #10b981; color: white; }
        .sal-kpi-purple { background: linear-gradient(135deg, #faf5ff, #ede9fe); }
        .sal-kpi-purple .sal-kpi-icon { background: #8b5cf6; color: white; }
        .sal-kpi-amber { background: linear-gradient(135deg, #fffbeb, #fef3c7); }
        .sal-kpi-amber .sal-kpi-icon { background: #f59e0b; color: white; }
        .sal-kpi-value {
          font-size: 1.5rem; font-weight: 800; color: #0f172a;
          line-height: 1.2;
        }
        .sal-kpi-label { font-size: 0.8rem; color: #64748b; font-weight: 600; margin-top: 2px; }

        /* ─── Tabs ─── */
        .sal-tab-bar {
          display: flex;
          gap: 4px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 24px;
          width: fit-content;
        }
        .sal-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sal-tab.active {
          background: white;
          color: #4f46e5;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .sal-tab:hover:not(.active) { color: #1e293b; }

        /* ─── Card ─── */
        .sal-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          overflow: hidden;
        }

        /* ─── Toolbar ─── */
        .sal-toolbar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
        }
        .sal-search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 14px;
          flex: 1;
          max-width: 420px;
          color: #94a3b8;
        }
        .sal-search-box input {
          border: none;
          background: transparent;
          outline: none;
          padding: 10px 0;
          font-size: 0.9rem;
          color: #1e293b;
          flex: 1;
        }
        .sal-emp-count {
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 600;
          margin-left: auto;
        }

        /* ─── Table ─── */
        .sal-table-wrap { overflow-x: auto; }
        .sal-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
        }
        .sal-table thead tr {
          background: #f8fafc;
          border-bottom: 2px solid #f1f5f9;
        }
        .sal-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
          white-space: nowrap;
        }
        .sal-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f8fafc;
          vertical-align: middle;
        }
        .sal-row { cursor: pointer; transition: background 0.15s; }
        .sal-row:hover { background: #fafbff; }
        .sal-row.expanded { background: #eef2ff; }

        .sal-emp-info { display: flex; align-items: center; gap: 12px; }
        .sal-avatar {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5, #818cf8);
          color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.75rem;
          flex-shrink: 0;
        }
        .sal-avatar.sm { width: 30px; height: 30px; font-size: 0.65rem; }
        .sal-emp-name { font-weight: 700; color: #0f172a; font-size: 0.9rem; }
        .sal-emp-code { font-size: 0.75rem; color: #94a3b8; margin-top: 1px; }

        .sal-dept-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: #f1f5f9; border-radius: 6px;
          padding: 4px 10px;
          font-size: 0.78rem; font-weight: 600; color: #475569;
          white-space: nowrap;
        }

        .sal-status-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .sal-status-badge.full_time { background: #dcfce7; color: #166534; }
        .sal-status-badge.part_time { background: #fef3c7; color: #92400e; }
        .sal-status-badge.contract  { background: #ede9fe; color: #5b21b6; }
        .sal-status-badge.intern    { background: #dbeafe; color: #1e40af; }

        .sal-money { font-weight: 700; color: #0f172a; font-size: 0.92rem; }
        .sal-money-sm { font-weight: 600; color: #374151; }
        .sal-na { color: #cbd5e1; font-size: 0.8rem; }
        .sal-bank { font-size: 0.82rem; color: #475569; font-weight: 600; }

        .sal-bool { font-weight: 700; font-size: 0.9rem; }
        .sal-bool.yes { color: #10b981; }
        .sal-bool.no  { color: #cbd5e1; }

        .sal-pay-meta { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }

        .sal-edit-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          background: #eef2ff;
          color: #4f46e5;
          border: none;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .sal-edit-btn:hover { background: #e0e7ff; }

        /* Expanded Detail Row */
        .sal-detail-row td { background: #f8fafc; padding: 0 !important; }
        .sal-detail-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
        }
        .sal-detail-block {
          padding: 20px 24px;
          border-right: 1px solid #f1f5f9;
        }
        .sal-detail-block:last-child { border-right: none; }
        .sal-detail-title {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #4f46e5;
          font-weight: 800;
          margin-bottom: 12px;
        }
        .sal-detail-item {
          display: flex; justify-content: space-between;
          align-items: center;
          padding: 5px 0;
          font-size: 0.82rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .sal-detail-item span { color: #94a3b8; font-weight: 600; }
        .sal-detail-item.sal-net {
          font-weight: 800; color: #059669;
          border-bottom: none;
          margin-top: 4px;
        }

        /* Payroll Tab Controls */
        .sal-payroll-controls {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
          flex-wrap: wrap;
        }
        .sal-period-selector { display: flex; gap: 10px; }
        .sal-period-selector select {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          font-size: 0.9rem;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
          outline: none;
        }
        .sal-period-selector select:focus { border-color: #6366f1; }

        .sal-payroll-summary {
          display: flex;
          gap: 0;
          border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
        }
        .sal-summary-item {
          flex: 1;
          padding: 14px 24px;
          border-right: 1px solid #f1f5f9;
          display: flex; flex-direction: column; gap: 2px;
        }
        .sal-summary-item:last-child { border-right: none; }
        .sal-summary-item span { font-size: 0.75rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
        .sal-summary-item strong { font-size: 1.15rem; font-weight: 800; color: #0f172a; }
        .sal-paid-count { color: #10b981 !important; }

        .sal-net-col { color: #059669 !important; font-weight: 700 !important; }
        .sal-deduction { color: #ef4444 !important; }

        .sal-pay-status {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .sal-pay-status.draft     { background: #f1f5f9; color: #64748b; }
        .sal-pay-status.processed { background: #fef3c7; color: #92400e; }
        .sal-pay-status.paid      { background: #dcfce7; color: #166534; }

        .sal-mark-paid-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          background: #dcfce7;
          color: #166534;
          border: none;
          font-weight: 700;
          font-size: 0.78rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .sal-mark-paid-btn:hover { background: #bbf7d0; }

        .sal-paid-date { font-size: 0.78rem; color: #94a3b8; }

        /* Buttons */
        .sal-btn-outline {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 18px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          color: #475569;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sal-btn-outline:hover { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }

        .sal-btn-generate {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 22px;
          border-radius: 10px;
          background: #4f46e5;
          color: white;
          border: none;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(79,70,229,0.35);
          transition: all 0.2s;
          margin-left: auto;
        }
        .sal-btn-generate:hover:not(:disabled) { background: #4338ca; transform: translateY(-1px); }
        .sal-btn-generate:disabled { opacity: 0.65; cursor: not-allowed; }

        /* States */
        .sal-loading {
          padding: 60px 24px;
          text-align: center;
          color: #94a3b8;
          font-size: 0.95rem;
        }
        .sal-empty {
          padding: 60px 24px;
          text-align: center;
          color: #94a3b8;
        }
        .sal-empty svg { margin-bottom: 12px; opacity: 0.4; }
        .sal-empty p { margin: 4px 0; font-size: 0.95rem; }
        .sal-hint { font-size: 0.82rem !important; color: #cbd5e1 !important; }

        /* ─── Edit Modal ─── */
        .sal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,0.55);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .sal-modal {
          background: white;
          border-radius: 20px;
          width: 100%;
          max-width: 680px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 60px rgba(0,0,0,0.2);
          overflow: hidden;
          animation: modalIn 0.25s ease-out;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sal-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 28px 28px 20px;
          border-bottom: 1px solid #f1f5f9;
        }
        .sal-modal-header h2 {
          font-size: 1.25rem; font-weight: 800; color: #0f172a;
          margin: 0 0 4px 0;
        }
        .sal-modal-header p { font-size: 0.85rem; color: #64748b; margin: 0; }
        .sal-close-btn {
          padding: 8px;
          border: none; background: #f1f5f9; border-radius: 8px;
          cursor: pointer; color: #64748b;
          transition: all 0.2s;
        }
        .sal-close-btn:hover { background: #e2e8f0; color: #0f172a; }

        .sal-alert {
          display: flex; align-items: center; gap: 10px;
          margin: 0 28px;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 600;
        }
        .sal-alert-error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

        .sal-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px 28px;
        }
        .sal-section-label {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 800;
          color: #4f46e5;
          margin: 20px 0 14px;
        }
        .sal-section-label:first-child { margin-top: 0; }

        .sal-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .sal-field { display: flex; flex-direction: column; gap: 6px; }
        .sal-field label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
        }
        .sal-field input, .sal-field select {
          height: 42px;
          padding: 0 14px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          font-size: 0.9rem;
          color: #0f172a;
          transition: all 0.2s;
          outline: none;
          font-family: inherit;
          box-sizing: border-box;
        }
        .sal-field input:focus, .sal-field select:focus {
          border-color: #6366f1;
          background: white;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .sal-toggle-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .sal-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          cursor: pointer;
          font-size: 0.88rem;
          font-weight: 600;
          color: #475569;
          transition: all 0.2s;
          flex: 1;
          min-width: 220px;
        }
        .sal-toggle.active {
          border-color: #4f46e5;
          background: #eef2ff;
          color: #4f46e5;
        }
        .sal-toggle-dot {
          width: 18px; height: 18px;
          border-radius: 50%;
          border: 2px solid #cbd5e1;
          background: white;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .sal-toggle.active .sal-toggle-dot {
          background: #4f46e5;
          border-color: #4f46e5;
        }

        .sal-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px 28px;
          border-top: 1px solid #f1f5f9;
          background: #fafbff;
        }
        .sal-btn-cancel {
          padding: 10px 22px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          color: #475569;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .sal-btn-cancel:hover { background: #f1f5f9; }
        .sal-btn-save {
          padding: 10px 28px;
          border: none;
          border-radius: 10px;
          background: #4f46e5;
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(79,70,229,0.35);
          transition: all 0.2s;
        }
        .sal-btn-save:hover:not(:disabled) { background: #4338ca; transform: translateY(-1px); }
        .sal-btn-save:disabled { opacity: 0.65; cursor: not-allowed; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .sal-kpi-grid { grid-template-columns: 1fr 1fr; }
          .sal-form-grid { grid-template-columns: 1fr; }
          .sal-detail-grid { grid-template-columns: 1fr; }
          .sal-detail-block { border-right: none; border-bottom: 1px solid #f1f5f9; }
        }
        @media (max-width: 600px) {
          .sal-kpi-grid { grid-template-columns: 1fr; }
        }
        /* ─── Advances Specific ─── */
        .sal-advance-toolbar { justify-content: space-between; }
        .sal-adv-reason { font-weight: 600; color: #1e293b; font-size: 0.9rem; }
        .sal-progress-wrap { width: 140px; }
        .sal-progress-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748b; margin-bottom: 4px; font-weight: 600; }
        .sal-progress-bg { height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
        .sal-progress-fill { height: 100%; background: #4f46e5; border-radius: 4px; transition: width 0.3s; }
        
        .sal-adv-actions { display: flex; gap: 8px; align-items: center; }
        .sal-icon-btn { 
          display: flex; align-items: center; gap: 6px; padding: 6px 10px; 
          border-radius: 6px; border: none; cursor: pointer; font-weight: 600; font-size: 0.8rem;
          transition: all 0.2s;
        }
        .sal-icon-btn.approve { background: #dcfce7; color: #10b981; }
        .sal-icon-btn.approve:hover { background: #bbf7d0; }
        .sal-icon-btn.reject { background: #fee2e2; color: #ef4444; }
        .sal-icon-btn.reject:hover { background: #fecaca; }
        .sal-icon-btn.disburse { background: #dbeafe; color: #3b82f6; }
        .sal-icon-btn.disburse:hover { background: #bfdbfe; }
        .sal-icon-btn.repay { background: #f1f5f9; color: #475569; }
        .sal-icon-btn.repay:hover { background: #e2e8f0; }
        
        .sal-btn-success { background: #10b981; }
        .sal-btn-success:hover:not(:disabled) { background: #059669; }
        .sal-btn-danger { background: #ef4444; }
        .sal-btn-danger:hover:not(:disabled) { background: #dc2626; }
        .sal-modal-sm { max-width: 450px !important; }
        .sal-deduction-preview { background: #f8fafc; padding: 12px; border-radius: 8px; color: #475569; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; border: 1px dashed #cbd5e1; }
        
        .sal-tab-badge { background: #ef4444; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; font-weight: 800; margin-left: 4px; }

        @media print {
          .no-print,
          .sidebar,
          .mobile-header,
          .mobile-overlay,
          .shell-topbar,
          .sal-header-actions,
          .sal-tab-bar,
          .sal-toolbar,
          .sal-payroll-controls,
          .sal-edit-btn,
          .sal-mark-paid-btn,
          .sal-row:not(.expanded) + .sal-detail-row,
          .sal-detail-row,
          th:last-child,
          td:last-child {
            display: none !important;
          }

          body {
            background: white !important;
            color: black !important;
          }

          .app-shell {
            display: block !important;
          }

          main.content {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }

          .sal-page {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .sal-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .sal-table-wrap {
            overflow: visible !important;
          }

          .sal-table {
            border: 1px solid #cbd5e1 !important;
            width: 100% !important;
          }

          .sal-table th {
            background: #f1f5f9 !important;
            color: #0f172a !important;
            border-bottom: 2px solid #cbd5e1 !important;
          }

          .sal-table td {
            border-bottom: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>
    </div>
  )
}
