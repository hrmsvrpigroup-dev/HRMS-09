import React, { useEffect, useState } from 'react'
import { payrollApi } from '../../api/payroll.api'
import { attendanceApi, AttendanceItem } from '../../api/attendance.api'
import {
  DollarSign, Users, TrendingUp, FileText,
  Edit3, CheckCircle, X, RefreshCw, Search,
  CreditCard, Building, Banknote, Shield, AlertCircle,
  PlusCircle, ThumbsUp, ThumbsDown, Zap, RotateCcw, Clock,
  Download, Eye, Printer, Calendar, Calculator, Check, Info, ChevronDown, ChevronUp
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

// ─── Number to Words INR Helper ──────────────────────────────────────────────
function formatINRWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only'
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen ']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const n = ('000000000' + Math.floor(num)).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/)
  if (!n) return 'Rupees Only'
  let str = ''
  str += Number(n[1]) !== 0 ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : ''
  str += Number(n[2]) !== 0 ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : ''
  str += Number(n[3]) !== 0 ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : ''
  str += Number(n[4]) !== 0 ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : ''
  str += Number(n[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Rupees Only' : 'Rupees Only'
  return str.replace(/\s+/g, ' ').trim()
}

// ─── Payslip Preview Modal ───────────────────────────────────────────────────
function PayslipPreviewModal({
  employee,
  month,
  year,
  calcData,
  onClose,
  uploadedFile,
}: {
  employee: EmployeeSalary
  month: number
  year: number
  calcData: {
    daysInMonth: number
    workingDays: number
    grossSalary: number
    perDayIncome: number
    deductions: number
    netSalary: number
    payableDays: number
    lossOfPayDays: number
    basicSalary: number
    hra: number
    allowances: number
    pf: number
    tax: number
  }
  onClose: () => void
  uploadedFile: File | null
}) {
  const [viewMode, setViewMode] = useState<'statement' | 'pdf'>(uploadedFile ? 'pdf' : 'statement')
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    if (uploadedFile) {
      const url = URL.createObjectURL(uploadedFile)
      setPdfBlobUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [uploadedFile])

  const monthName = MONTHS[month - 1]

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="sal-overlay" style={{ zIndex: 1100 }}>
      <div className="sal-modal" style={{ maxWidth: '820px', width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Preview Header */}
        <div className="sal-modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Eye size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Payslip Preview — {monthName} {year}
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                {employee.firstName} {employee.lastName} ({employee.employeeCode}) • {employee.department?.name || 'General Department'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {uploadedFile && (
              <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('statement')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: viewMode === 'statement' ? '#ffffff' : 'transparent',
                    color: viewMode === 'statement' ? '#1e293b' : '#64748b',
                    boxShadow: viewMode === 'statement' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  System Breakdown
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('pdf')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: viewMode === 'pdf' ? '#ffffff' : 'transparent',
                    color: viewMode === 'pdf' ? '#1e293b' : '#64748b',
                    boxShadow: viewMode === 'pdf' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Uploaded PDF
                </button>
              </div>
            )}
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#1e293b',
                cursor: 'pointer'
              }}
            >
              <Printer size={15} /> Print / Save
            </button>
            <button className="sal-close-btn" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="sal-modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: '#f1f5f9' }}>
          
          {viewMode === 'pdf' && pdfBlobUrl ? (
            <div style={{ background: '#ffffff', borderRadius: '8px', overflow: 'hidden', height: '620px', border: '1px solid #cbd5e1' }}>
              <iframe src={pdfBlobUrl} title="Uploaded PDF Preview" width="100%" height="100%" style={{ border: 'none' }} />
            </div>
          ) : (
            <div className="payslip-preview-sheet" style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '28px', maxWidth: '750px', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', color: '#0f172a' }}>
              
              {/* Company Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '0.5px' }}>
                    VR PI TECH SOLUTIONS LLP
                  </h1>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#475569' }}>
                    Plot No. 12, Cyber Gateway, HITEC City, Hyderabad, Telangana - 500081
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                    Corporate HRMS Payroll Division • Registered LLP
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-block', padding: '5px 12px', background: '#0f172a', color: '#ffffff', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Payslip
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3b82f6', marginTop: '6px' }}>
                    {monthName.toUpperCase()} {year}
                  </div>
                </div>
              </div>

              {/* Employee & Attendance Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '14px 18px', marginBottom: '20px', fontSize: '0.8rem' }}>
                <div><strong style={{ color: '#475569' }}>Employee Name:</strong> <span style={{ fontWeight: 700, color: '#0f172a' }}>{employee.firstName} {employee.lastName}</span></div>
                <div><strong style={{ color: '#475569' }}>Employee ID:</strong> <span style={{ fontWeight: 700, color: '#0f172a' }}>{employee.employeeCode}</span></div>
                <div><strong style={{ color: '#475569' }}>Department:</strong> <span>{employee.department?.name || 'General'}</span></div>
                <div><strong style={{ color: '#475569' }}>Designation:</strong> <span>{employee.designation?.title || 'Employee'}</span></div>
                <div><strong style={{ color: '#475569' }}>Date of Joining:</strong> <span>{employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-IN') : '—'}</span></div>
                <div><strong style={{ color: '#475569' }}>PAN Number:</strong> <span style={{ fontFamily: 'monospace' }}>{employee.payrollDetails?.panNumber || '—'}</span></div>
                <div><strong style={{ color: '#475569' }}>Bank Name &amp; A/C:</strong> <span>{employee.payrollDetails?.bankName ? `${employee.payrollDetails.bankName} (•••${(employee.payrollDetails.accountNumber || '').slice(-4)})` : 'Direct Transfer'}</span></div>
                <div><strong style={{ color: '#475569' }}>UAN / PF Number:</strong> <span style={{ fontFamily: 'monospace' }}>{employee.payrollDetails?.uanNumber || '—'}</span></div>
              </div>

              {/* Attendance Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 16px', marginBottom: '20px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>Total Days in Month</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e3a8a' }}>{calcData.daysInMonth}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>Payable Days</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>{calcData.payableDays}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>Loss of Pay Days</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: calcData.lossOfPayDays > 0 ? '#dc2626' : '#64748b' }}>{calcData.lossOfPayDays}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700 }}>Per-Day Income</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>₹{calcData.perDayIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>

              {/* Earnings & Deductions Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #0f172a', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
                {/* Earnings */}
                <div style={{ borderRight: '1px solid #0f172a' }}>
                  <div style={{ background: '#0f172a', color: '#ffffff', padding: '8px 14px', fontSize: '0.82rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Earnings</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div style={{ padding: '10px 14px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Basic Salary (50%)</span>
                      <strong style={{ color: '#0f172a' }}>₹{calcData.basicSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>House Rent Allowance (HRA 25%)</span>
                      <strong style={{ color: '#0f172a' }}>₹{calcData.hra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Special / Other Allowances</span>
                      <strong style={{ color: '#0f172a' }}>₹{calcData.allowances.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}>
                      <span>Gross Salary</span>
                      <span>₹{calcData.grossSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <div style={{ background: '#0f172a', color: '#ffffff', padding: '8px 14px', fontSize: '0.82rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Deductions</span>
                    <span>Amount (₹)</span>
                  </div>
                  <div style={{ padding: '10px 14px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Provident Fund (PF)</span>
                      <strong style={{ color: '#dc2626' }}>₹{calcData.pf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                      <span style={{ color: '#475569' }}>Professional Tax (PT)</span>
                      <strong style={{ color: '#dc2626' }}>₹{calcData.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    {calcData.lossOfPayDays > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0' }}>
                        <span style={{ color: '#475569' }}>Loss of Pay ({calcData.lossOfPayDays} days)</span>
                        <strong style={{ color: '#dc2626' }}>₹{Math.round(calcData.lossOfPayDays * calcData.perDayIncome).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', fontSize: '0.85rem', fontWeight: 800, color: '#dc2626' }}>
                      <span>Total Deductions</span>
                      <span>-₹{calcData.deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payable Banner */}
              <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Net Disbursed Salary for the Month
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#15803d', fontStyle: 'italic', marginTop: '4px' }}>
                    ({formatINRWords(calcData.netSalary)})
                  </div>
                </div>
                <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#14532d' }}>
                  ₹{calcData.netSalary.toLocaleString('en-IN')}
                </div>
              </div>

              {/* Footer Note & Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '16px', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
                <div>
                  <p style={{ margin: 0 }}>• Policy Note: Case 1 (Friday leave) &amp; Case 2 (Monday leave) weekend pay protection applied.</p>
                  <p style={{ margin: '2px 0 0' }}>• This is a computer-generated document from VR PI HRMS and does not require a physical signature.</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #94a3b8', width: '130px', margin: '0 auto 4px' }}></div>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Authorized Signatory</span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="sal-modal-footer" style={{ padding: '12px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="sal-btn-cancel" onClick={onClose} style={{ padding: '8px 20px', fontSize: '0.82rem' }}>
            Close Preview
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Upload & Generate Payslip Modal ─────────────────────────────────────────
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

  // Real-Time Attendance Analysis State
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [serverAnalysis, setServerAnalysis] = useState<any>(null)
  const [dayOverrides, setDayOverrides] = useState<Record<number, string>>({})
  const [calcMethod, setCalcMethod] = useState<'working_days' | 'calendar_days'>('working_days')
  const [showDayBreakdown, setShowDayBreakdown] = useState(true)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

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

  // Fetch Real-time Attendance & Leave Analysis whenever employee, month, or year changes
  useEffect(() => {
    if (!employeeId) {
      setServerAnalysis(null)
      setDayOverrides({})
      return
    }

    let isMounted = true
    const fetchAnalysis = async () => {
      setAttendanceLoading(true)
      try {
        const res = await payrollApi.getAttendanceAnalysis(employeeId, month, year)
        if (isMounted) {
          setServerAnalysis(res.data.data)
          setDayOverrides({})
        }
      } catch (err) {
        console.warn('Failed to load real-time attendance analysis:', err)
        if (isMounted) setServerAnalysis(null)
      } finally {
        if (isMounted) setAttendanceLoading(false)
      }
    }

    fetchAnalysis()
    return () => { isMounted = false }
  }, [employeeId, month, year])

  // ── Compute Real-Time Breakdown with Interactive Overrides ──────────────────
  const daysInMonth = serverAnalysis?.daysInMonth || new Date(year, month, 0).getDate()
  
  // Calculate exact weekdays in month if server analysis is not loaded
  let defaultWeekdays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) defaultWeekdays++
  }
  const totalWorkingDays = serverAnalysis?.totalWorkingDays || defaultWeekdays
  const monthlyGross = selectedEmployee ? Math.round((selectedEmployee.salaryGross || 0) / 12) : 0

  // Merge server daily breakdown with any local HR overrides
  const rawDaily = serverAnalysis?.dailyBreakdown || []
  let presentWorkingDays = 0
  let onLeaveWorkingDays = 0
  let fridayLeaveDays = 0
  let mondayLeaveDays = 0
  let unpaidAbsenceDays = 0
  let weekendPaidDays = 0

  const activeDailyBreakdown = []
  for (let d = 1; d <= daysInMonth; d++) {
    const defaultDay = rawDaily.find((item: any) => item.day === d)
    const dateObj = new Date(year, month - 1, d)
    const dayOfWeek = dateObj.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    if (isWeekend) {
      weekendPaidDays++
      activeDailyBreakdown.push(defaultDay || {
        day: d,
        dayOfWeek,
        dayName: dayOfWeek === 6 ? 'Sat' : 'Sun',
        status: 'WEEKEND_PAID',
        label: dayOfWeek === 6 ? 'Saturday (Paid Off)' : 'Sunday (Paid Off)',
        isPaid: true,
        isWorkingDay: false,
        caseApplied: 'WEEKEND_PAID'
      })
    } else {
      // Weekday
      const override = dayOverrides[d]
      let status: string = override || (defaultDay?.status as string) || 'PRESENT'
      let label: string = defaultDay?.label || 'Present'
      let isPaid = true
      let caseApplied = defaultDay?.caseApplied

      if (override) {
        if (override === 'PRESENT') {
          label = 'Present (Manual)'
          isPaid = true
          caseApplied = undefined
        } else if (override === 'PAID_LEAVE') {
          label = dayOfWeek === 5 ? 'Friday Leave (Case 1)' : dayOfWeek === 1 ? 'Monday Paid Leave (Case 2)' : 'Paid Leave'
          isPaid = true
          caseApplied = dayOfWeek === 5 ? 'CASE_1' : dayOfWeek === 1 ? 'CASE_2' : undefined
        } else if (override === 'UNPAID_ABSENT') {
          label = 'Absent / Unpaid LOP'
          isPaid = false
          caseApplied = undefined
        }
      }

      if (status === 'PRESENT' || status === 'HALF_DAY') {
        presentWorkingDays += status === 'HALF_DAY' ? 0.5 : 1
      } else if (status === 'LEAVE_FRIDAY' || (override === 'PAID_LEAVE' && dayOfWeek === 5)) {
        onLeaveWorkingDays++
        fridayLeaveDays++
      } else if (status === 'LEAVE_MONDAY' || (override === 'PAID_LEAVE' && dayOfWeek === 1)) {
        onLeaveWorkingDays++
        mondayLeaveDays++
      } else if (status === 'PAID_LEAVE') {
        onLeaveWorkingDays++
      } else if (status === 'UNPAID_ABSENT') {
        unpaidAbsenceDays++
        isPaid = false
      } else {
        presentWorkingDays++
      }

      activeDailyBreakdown.push({
        day: d,
        dayOfWeek,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
        status,
        label,
        isPaid,
        isWorkingDay: true,
        caseApplied,
        isOverridden: Boolean(override),
      })
    }
  }

  const paidWorkingDays = presentWorkingDays + onLeaveWorkingDays
  const payableDays = Math.max(0, daysInMonth - unpaidAbsenceDays)

  // Per-day rate calculation based on chosen method
  const perDayIncomeWorking = totalWorkingDays > 0 ? Math.round((monthlyGross / totalWorkingDays) * 100) / 100 : 0
  const perDayIncomeCalendar = daysInMonth > 0 ? Math.round((monthlyGross / daysInMonth) * 100) / 100 : 0
  const perDayIncome = calcMethod === 'working_days' ? perDayIncomeWorking : perDayIncomeCalendar

  // Standard deduction -₹2,200 (PF ₹2,000 + PT ₹200) + any Loss of Pay
  const standardDeductions = 2200
  const lopDeduction = Math.round(unpaidAbsenceDays * perDayIncome)
  const totalDeductions = standardDeductions + lopDeduction

  // Net salary calculation in real time
  const calculatedNet = calcMethod === 'working_days'
    ? Math.max(0, Math.round((paidWorkingDays * perDayIncomeWorking) - standardDeductions))
    : Math.max(0, Math.round((payableDays * perDayIncomeCalendar) - standardDeductions))

  // Auto-sync netSalary input whenever calculation changes
  useEffect(() => {
    if (selectedEmployee && calculatedNet > 0) {
      setNetSalary(String(calculatedNet))
    }
  }, [selectedEmployee?.id, month, year, calculatedNet, calcMethod])

  const handleSelectEmployee = (id: string) => {
    setEmployeeId(id)
    setError('')
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

  // Interactive toggle day status on calendar pill click
  const handleToggleDay = (dayNum: number, currentStatus: string, isWeekend: boolean) => {
    if (isWeekend) return // Weekends are protected
    const nextStatus: Record<string, 'PRESENT' | 'PAID_LEAVE' | 'UNPAID_ABSENT'> = {
      PRESENT: 'PAID_LEAVE',
      LEAVE_FRIDAY: 'UNPAID_ABSENT',
      LEAVE_MONDAY: 'UNPAID_ABSENT',
      PAID_LEAVE: 'UNPAID_ABSENT',
      UNPAID_ABSENT: 'PRESENT',
    }
    const target = nextStatus[currentStatus] || 'PRESENT'
    setDayOverrides(prev => ({ ...prev, [dayNum]: target }))
  }

  // Handle Upload or Direct Generation
  const handleSavePayslip = async () => {
    if (!autoDetect && !employeeId) {
      setError('Please select a target employee.')
      return
    }
    if (!month || !year) {
      setError('Please select month and year.')
      return
    }

    setUploading(true)
    setError('')
    setSuccessMsg('')

    try {
      if (file) {
        // Upload custom PDF
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
      } else {
        // Auto-generate from real-time calculation
        await payrollApi.generateSinglePayslip({
          employeeId,
          month: Number(month),
          year: Number(year),
          netSalary: netSalary ? Number(netSalary) : calculatedNet,
          daysPaid: paidWorkingDays,
          lossOfPay: unpaidAbsenceDays,
          deductions: totalDeductions,
        })
        setSuccessMsg('Official payslip generated and synced to employee portal successfully!')
      }

      setTimeout(() => {
        onSaved()
        onClose()
      }, 700)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process salary slip')
    } finally {
      setUploading(false)
    }
  }

  // Preview Data
  const previewCalcData = {
    daysInMonth,
    workingDays: totalWorkingDays,
    grossSalary: monthlyGross,
    perDayIncome,
    deductions: totalDeductions,
    netSalary: netSalary ? Number(netSalary) : calculatedNet,
    payableDays: paidWorkingDays,
    lossOfPayDays: unpaidAbsenceDays,
    basicSalary: Math.round(monthlyGross * 0.5),
    hra: Math.round(monthlyGross * 0.25),
    allowances: Math.round(monthlyGross * 0.25),
    pf: 2000,
    tax: 200,
  }

  return (
    <>
      <div className="sal-overlay">
        <div className="sal-modal sal-modal-md" style={{ maxWidth: '720px', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
          
          <div className="sal-modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Real-Time Employee Attendance &amp; Payroll Generator
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Automated attendance analysis with Case 1 &amp; Case 2 weekend protections, live leave tracking, and instant real-time recalculation.
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

          <div className="sal-modal-body" style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
            <div className="sal-form-grid" style={{ gridTemplateColumns: '1fr', gap: '14px' }}>
              
              {/* 1. Select Target Employee */}
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
                      style={{ fontSize: '0.85rem', height: '40px', fontWeight: 600, background: '#ffffff', border: '1.5px solid #3b82f6', borderRadius: '6px', color: '#0f172a', width: '100%' }}
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
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Gross Monthly CTC</span>
                          <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '0.92rem' }}>
                            ₹{monthlyGross.toLocaleString('en-IN')}
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

              {/* 2 & 3. Month & Year Selection */}
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

              {/* ── Real-Time Monthly Attendance & Policy Analysis Card ── */}
              {selectedEmployee && (
                <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={16} style={{ color: '#3b82f6' }} />
                      <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
                        Live Attendance &amp; Leave Analysis ({MONTHS[month - 1]} {year})
                      </strong>
                    </div>
                    {attendanceLoading ? (
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <RefreshCw size={12} className="animate-spin" /> Fetching real-time records...
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        ● Live Synchronized
                      </span>
                    )}
                  </div>

                  {/* Policy Protections Highlight */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    <div style={{ fontSize: '0.72rem', padding: '3px 8px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', color: '#166534', fontWeight: 600 }}>
                      ✓ Case 1: Friday Leave protects Sat &amp; Sun as Paid Holidays
                    </div>
                    <div style={{ fontSize: '0.72rem', padding: '3px 8px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', color: '#166534', fontWeight: 600 }}>
                      ✓ Case 2: Monday Leave protected as Paid Leave (Sat, Sun, Mon)
                    </div>
                  </div>

                  {/* Real-time Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 8px' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Total Working Days</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{totalWorkingDays} days</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Days Worked</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2563eb' }}>{presentWorkingDays} days</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>On Leave Working Days</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d' }}>
                        {onLeaveWorkingDays} days
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#16a34a' }}>
                        ({fridayLeaveDays + mondayLeaveDays} protected)
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Unpaid LOP Days</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: unpaidAbsenceDays > 0 ? '#dc2626' : '#64748b' }}>
                        {unpaidAbsenceDays} days
                      </div>
                    </div>
                  </div>

                  {/* Interactive Day Breakdown Header */}
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                      Click any weekday pill below to toggle status (Present / Leave / LOP) in real-time.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDayBreakdown(!showDayBreakdown)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {showDayBreakdown ? (
                        <>Hide Calendar <ChevronUp size={14} /></>
                      ) : (
                        <>Show Interactive Day Calendar ({daysInMonth} Days) <ChevronDown size={14} /></>
                      )}
                    </button>
                  </div>

                  {/* Expandable Daily Calendar Pills */}
                  {showDayBreakdown && (
                    <div style={{ marginTop: '8px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', background: '#ffffff' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '6px' }}>
                        {activeDailyBreakdown.map((d: any) => {
                          const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6
                          const isLeave = d.status === 'LEAVE_FRIDAY' || d.status === 'LEAVE_MONDAY' || d.status === 'PAID_LEAVE'
                          const isLop = d.status === 'UNPAID_ABSENT'
                          return (
                            <div
                              key={d.day}
                              onClick={() => handleToggleDay(d.day, d.status, isWeekend)}
                              title={isWeekend ? 'Weekend Paid Day' : 'Click to toggle status'}
                              style={{
                                padding: '6px 4px',
                                borderRadius: '5px',
                                textAlign: 'center',
                                fontSize: '0.7rem',
                                border: d.isOverridden ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                                background: isWeekend ? '#f8fafc' : isLeave ? '#f0fdf4' : isLop ? '#fef2f2' : '#ffffff',
                                cursor: isWeekend ? 'default' : 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ fontWeight: 800, color: '#0f172a' }}>Day {d.day} ({d.dayName})</div>
                              <div style={{
                                fontSize: '0.64rem',
                                fontWeight: 700,
                                marginTop: '2px',
                                color: isWeekend ? '#16a34a' : isLeave ? '#15803d' : isLop ? '#dc2626' : '#2563eb'
                              }}>
                                {d.label}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* ── 6 Core Calculations Dashboard ── */}
              {selectedEmployee && (
                <div style={{ background: '#ffffff', border: '1.5px solid #3b82f6', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 10px rgba(59,130,246,0.08)' }}>
                  
                  {/* Dashboard Header with Method Switcher */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calculator size={16} style={{ color: '#2563eb' }} />
                      <strong style={{ fontSize: '0.85rem', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        CALCULATED PAYROLL METRICS (6 STANDARD FACTORS)
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Calculation Basis Switcher */}
                      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', border: '1px solid #cbd5e1', fontSize: '0.72rem', fontWeight: 700 }}>
                        <button
                          type="button"
                          onClick={() => setCalcMethod('working_days')}
                          style={{
                            padding: '3px 8px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: calcMethod === 'working_days' ? '#3b82f6' : 'transparent',
                            color: calcMethod === 'working_days' ? '#ffffff' : '#64748b',
                            fontWeight: 700
                          }}
                        >
                          By Working Days ({totalWorkingDays})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalcMethod('calendar_days')}
                          style={{
                            padding: '3px 8px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: calcMethod === 'calendar_days' ? '#3b82f6' : 'transparent',
                            color: calcMethod === 'calendar_days' ? '#ffffff' : '#64748b',
                            fontWeight: 700
                          }}
                        >
                          By Calendar Days ({daysInMonth})
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPreviewModal(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(59,130,246,0.3)'
                        }}
                      >
                        <Eye size={13} /> Preview Payslip
                      </button>
                    </div>
                  </div>

                  {/* 6 Grid Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    
                    {/* 1. No. of Days in Month */}
                    <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>1. No. of Days in Month</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        {daysInMonth} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>days</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                        Calendar total for {MONTHS[month - 1]}
                      </div>
                    </div>

                    {/* 2. No. of Working Days */}
                    <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>2. No. of Working Days</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>
                        {totalWorkingDays} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0284c7' }}>({paidWorkingDays} paid)</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#0369a1', marginTop: '2px', fontWeight: 600 }}>
                        {presentWorkingDays} Worked • {onLeaveWorkingDays} on Leave {unpaidAbsenceDays > 0 ? `• ${unpaidAbsenceDays} LOP` : ''}
                      </div>
                    </div>

                    {/* 3. Gross Salary */}
                    <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>3. Gross Salary</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                        ₹{monthlyGross.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#166534', marginTop: '2px' }}>
                        Annual CTC: ₹{(selectedEmployee.salaryGross || 0).toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* 4. Per-Day Income */}
                    <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>4. Per-Day Income</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        ₹{perDayIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '2px' }}>
                        {calcMethod === 'working_days' ? `Formula: Gross ÷ ${totalWorkingDays} work days` : `Formula: Gross ÷ ${daysInMonth} cal days`}
                      </div>
                    </div>

                    {/* 5. Deductions (-2200) */}
                    <div style={{ padding: '10px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '0.7rem', color: '#991b1b', fontWeight: 700 }}>5. Deductions (-2200)</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                        -₹{totalDeductions.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#b91c1c', marginTop: '2px' }}>
                        PF ₹2,000 + PT ₹200 {unpaidAbsenceDays > 0 ? `+ LOP ₹${lopDeduction.toLocaleString('en-IN')}` : ''}
                      </div>
                    </div>

                    {/* 6. Net Salary for Month */}
                    <div style={{ padding: '10px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>6. Net Salary for Month</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>
                        ₹{calculatedNet.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                        ✓ Syncs to Net Disbursed Pay
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* 4. Net Salary Input */}
              <div className="sal-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    4. Net Disbursed Salary (₹)
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                    ✓ Real-time calculated: {paidWorkingDays} Paid Days × ₹{perDayIncome.toFixed(2)} - Deductions
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Auto-calculated net monthly pay"
                    value={netSalary}
                    onChange={e => setNetSalary(e.target.value)}
                    style={{ fontSize: '0.92rem', height: '40px', fontWeight: 800, color: '#15803d', flex: 1 }}
                  />
                  {selectedEmployee && (
                    <button
                      type="button"
                      onClick={() => setShowPreviewModal(true)}
                      style={{
                        padding: '0 16px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        color: '#2563eb',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Eye size={15} /> Preview Payslip
                    </button>
                  )}
                </div>
              </div>

              {/* 5. Payslip PDF Document Upload (Optional if auto-generating) */}
              <div className="sal-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    5. Payslip PDF Document <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>(Optional — System can auto-generate)</span>
                  </label>
                </div>
                <div style={{
                  border: file ? '2px solid #22c55e' : '2px dashed #94a3b8',
                  borderRadius: '10px',
                  padding: '16px',
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
                      <CheckCircle size={26} style={{ color: '#16a34a', margin: '0 auto 4px' }} />
                      <p style={{ margin: '2px 0 0', fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
                        📄 {file.name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                        {(file.size / 1024).toFixed(1)} KB — Click to replace or click "Preview Payslip" to view
                      </p>
                    </div>
                  ) : (
                    <div>
                      <FileText size={26} style={{ color: '#3b82f6', margin: '0 auto 4px' }} />
                      <p style={{ margin: '2px 0 0', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                        Click or Drag &amp; Drop PDF Payslip
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                        Upload external PDF or leave blank to auto-generate official payslip
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Modal Footer */}
          <div className="sal-modal-footer" style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {selectedEmployee && (
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  <Eye size={15} style={{ color: '#2563eb' }} /> Preview Payslip
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="sal-btn-cancel" onClick={onClose} style={{ padding: '8px 18px', fontSize: '0.82rem' }}>
                Cancel
              </button>
              <button 
                className="sal-btn-save sal-btn-success" 
                onClick={handleSavePayslip} 
                disabled={uploading || (!autoDetect && !employeeId)}
                style={{ padding: '8px 24px', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {uploading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Syncing to Portal...
                  </>
                ) : file ? (
                  'Upload & Sync to Portal'
                ) : (
                  'Generate & Sync to Portal'
                )}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Payslip Preview Modal */}
      {showPreviewModal && selectedEmployee && (
        <PayslipPreviewModal
          employee={selectedEmployee}
          month={month}
          year={year}
          calcData={previewCalcData}
          onClose={() => setShowPreviewModal(false)}
          uploadedFile={file}
        />
      )}
    </>
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
