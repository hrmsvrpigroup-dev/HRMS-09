import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hrApi } from '../../api/hr.api'
import { employeeApi } from '../../api/employee.api'
import { CheckCircle, ChevronRight, UploadCloud, Shield, User, MapPin, Building, CreditCard, Activity, RefreshCw } from 'lucide-react'
import SalaryBreakdown from '../../components/payroll/SalaryBreakdown'

const INITIAL_FORM_DATA = {
  employeeCode: '',
  firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', mobileNumber: '', personalEmail: '', workEmail: '', maritalStatus: 'Single',
  departmentId: '', designationId: '', employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE', branchId: '', shift: 'General Shift', reportingManagerId: '', joiningDate: '',
  salaryStructure: '', basicSalary: '', monthlySalary: '', pfAmount: '', paymentType: 'Bank Transfer', bankName: '', accountNumber: '', ifscCode: '', panNumber: '', uanNumber: '', pfEnabled: 'false', esiEnabled: 'false',
  attendanceType: 'FACIAL', geoFencingEnabled: 'false', twoFactorEnabled: 'false',
  sendActivationEmail: 'true',
  country: '', state: '', city: '', addressLine1: '', addressLine2: '', postalCode: '',
  emergencyContactName: '', emergencyRelationship: '', emergencyMobile: '',
  experienceLevel: 'fresher',
}

const ESSENTIAL_FIELDS: { name: string; label: string; step: number }[] = [
  { name: 'firstName', label: 'First Name', step: 1 },
  { name: 'lastName', label: 'Last Name', step: 1 },
  { name: 'workEmail', label: 'Work Email', step: 1 },
  { name: 'personalEmail', label: 'Personal Email', step: 1 },
  { name: 'mobileNumber', label: 'Mobile Number', step: 1 },
  { name: 'joiningDate', label: 'Joining Date', step: 2 },
]

export default function AddEmployee() {
  const navigate = useNavigate()

  const [activeStep, setActiveStep] = useState<number>(() => {
    const saved = localStorage.getItem('onboard_active_step')
    return saved ? parseInt(saved, 10) : 1
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [created, setCreated] = useState<{ employeeCode: string; name: string; email: string } | null>(null)
  const [autoCode, setAutoCode] = useState<string>('')
  const [loadingCode, setLoadingCode] = useState(false)

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('onboard_form_data')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return { ...INITIAL_FORM_DATA, ...parsed }
      } catch (e) {
        return INITIAL_FORM_DATA
      }
    }
    return INITIAL_FORM_DATA
  })

  // Auto-generate next employee code (VRPITS00236...) while keeping custom editable
  useEffect(() => {
    let active = true
    const fetchNextCode = async () => {
      try {
        setLoadingCode(true)
        const res = await employeeApi.getNextCode()
        if (active && res.data?.data?.nextCode) {
          const next = res.data.data.nextCode
          setAutoCode(next)
          setFormData((prev: typeof INITIAL_FORM_DATA) => {
            if (!prev.employeeCode || prev.employeeCode.startsWith('EMP-')) {
              return { ...prev, employeeCode: next }
            }
            return prev
          })
        }
      } catch (err) {
        console.error('Failed to fetch next employee code:', err)
      } finally {
        if (active) setLoadingCode(false)
      }
    }
    fetchNextCode()
    return () => { active = false }
  }, [])

  useEffect(() => {
    localStorage.setItem('onboard_active_step', activeStep.toString())
  }, [activeStep])

  useEffect(() => {
    localStorage.setItem('onboard_form_data', JSON.stringify(formData))
  }, [formData])

  const clearOnboardingDraft = () => {
    localStorage.removeItem('onboard_active_step')
    localStorage.removeItem('onboard_form_data')
  }

  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    aadhaarCard: null, panCard: null, resume: null, offerLetter: null, profilePhoto: null, previousPayslips: null
  })

  const steps = [
    { id: 1, name: 'Basic Details', icon: User, desc: 'Personal info' },
    { id: 2, name: 'Employment', icon: Building, desc: 'Role details' },
    { id: 3, name: 'Payroll', icon: CreditCard, desc: 'Salary info' },
    { id: 4, name: 'Attendance', icon: Activity, desc: 'Time tracking' },
    { id: 5, name: 'Address', icon: MapPin, desc: 'Residential info' },
    { id: 6, name: 'Emergency', icon: Shield, desc: 'Emergency contacts' },
    { id: 7, name: 'Documents', icon: UploadCloud, desc: 'KYC files' },
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'basicSalary') {
      const annual = Number(value) || 0
      const monthly = annual > 0 ? Math.round(annual / 12) : 0
      const epfMonthly = annual > 0 ? Math.round((annual * 0.12) / 12) : 0
      setFormData((prev: typeof INITIAL_FORM_DATA) => ({
        ...prev,
        basicSalary: value,
        monthlySalary: monthly > 0 ? String(monthly) : '',
        pfAmount: epfMonthly > 0 ? String(epfMonthly) : prev.pfAmount,
      }))
    } else if (name === 'monthlySalary') {
      const monthly = Number(value) || 0
      const annual = monthly > 0 ? Math.round(monthly * 12) : 0
      const epfMonthly = annual > 0 ? Math.round((annual * 0.12) / 12) : 0
      setFormData((prev: typeof INITIAL_FORM_DATA) => ({
        ...prev,
        monthlySalary: value,
        basicSalary: annual > 0 ? String(annual) : '',
        pfAmount: epfMonthly > 0 ? String(epfMonthly) : prev.pfAmount,
      }))
    } else {
      setFormData((prev: typeof INITIAL_FORM_DATA) => ({ ...prev, [name]: value }))
    }
    if (value.trim() && fieldErrors.includes(name)) {
      setFieldErrors((prev: string[]) => prev.filter(f => f !== name))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [e.target.name]: e.target.files[0] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setFieldErrors([])

    // Validate all essential required fields before submit
    const missing = ESSENTIAL_FIELDS.filter(field => !formData[field.name as keyof typeof formData]?.trim())

    if (missing.length > 0) {
      const missingKeys = missing.map(m => m.name)
      const missingLabels = missing.map(m => m.label)
      setFieldErrors(missingKeys)

      const firstMissing = missing[0]
      setActiveStep(firstMissing.step)
      setError(`Missing essential employee information: Please fill in standard column(s): ${missingLabels.join(', ')}`)
      setIsSubmitting(false)
      return
    }

    try {
      const fd = new FormData()
      Object.keys(formData).forEach(key => fd.append(key, formData[key as keyof typeof formData]))
      Object.keys(files).forEach(key => { if (files[key]) fd.append(key, files[key] as File) })

      const res = await hrApi.onboardEmployee(fd)
      const data = res.data?.data
      setCreated({
        employeeCode: data?.employeeCode || 'N/A',
        name: data?.name || `${formData.firstName} ${formData.lastName}`,
        email: data?.email || formData.workEmail,
      })
      clearOnboardingDraft()
    } catch (err: any) {
      let serverMsg = err.response?.data?.message || 'Failed to create employee. Please check all fields and try again.'

      if (serverMsg.includes('Unique constraint failed on the fields: (`email`)')) {
        serverMsg = `An employee account with work email "${formData.workEmail}" already exists in the system.`
      }

      setError(serverMsg)
      setIsSubmitting(false)

      const detectedMissing: string[] = []
      if (serverMsg.toLowerCase().includes('email')) {
        detectedMissing.push('workEmail')
      }
      ESSENTIAL_FIELDS.forEach(field => {
        if (!formData[field.name as keyof typeof formData]?.trim() || serverMsg.toLowerCase().includes(field.label.toLowerCase())) {
          if (!detectedMissing.includes(field.name)) {
            detectedMissing.push(field.name)
          }
        }
      })

      if (detectedMissing.length > 0) {
        setFieldErrors(detectedMissing)
        const firstField = ESSENTIAL_FIELDS.find(f => detectedMissing.includes(f.name))
        if (firstField) setActiveStep(firstField.step)
      }
    }
  }

  const renderInput = ({ label, type = 'text', name, required = false, fullWidth = false, placeholder = '', autoComplete = 'off' }: any) => {
    const isMissing = fieldErrors.includes(name)
    return (
      <div className={`onboard-field ${fullWidth ? 'full-width' : ''} ${isMissing ? 'has-field-error' : ''}`} key={name}>
        <label>
          {label} {required && <span>*</span>}
          {isMissing && <span className="field-required-badge">⚠️ Column Required</span>}
        </label>
        <input
          required={required}
          type={type}
          name={name}
          placeholder={placeholder}
          value={formData[name as keyof typeof formData] || ''}
          onChange={handleChange}
          autoComplete={autoComplete}
          autoCorrect="off"
          spellCheck={false}
          className={isMissing ? 'input-error-highlight' : ''}
        />
        {isMissing && <div className="field-error-subtext">Please fill in this column (your other data is safely preserved).</div>}
      </div>
    )
  }

  const renderSelect = ({ label, name, options, fullWidth = false }: any) => {
    const isMissing = fieldErrors.includes(name)
    return (
      <div className={`onboard-field ${fullWidth ? 'full-width' : ''} ${isMissing ? 'has-field-error' : ''}`} key={name}>
        <label>
          {label}
          {isMissing && <span className="field-required-badge">⚠️ Column Required</span>}
        </label>
        <select
          name={name}
          value={formData[name as keyof typeof formData]}
          onChange={handleChange}
          className={isMissing ? 'input-error-highlight' : ''}
        >
          {options.map((opt: any) => <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>)}
        </select>
        {isMissing && <div className="field-error-subtext">Please select an option.</div>}
      </div>
    )
  }

  return (
    <div className="onboard-container">
      {/* ── SUCCESS SCREEN ── */}
      {created && (
        <div className="onboard-success-screen">
          <div className="success-icon-wrap">
            <CheckCircle size={64} className="success-icon" />
          </div>
          <h1>Employee Created Successfully!</h1>
          <p className="success-subtitle">The employee account has been provisioned and queued for HR verification.</p>

          <div className="success-details-card">
            <div className="success-detail-row">
              <span>Employee ID</span>
              <strong>{created.employeeCode}</strong>
            </div>
            <div className="success-detail-row">
              <span>Full Name</span>
              <strong>{created.name}</strong>
            </div>
            <div className="success-detail-row">
              <span>Work Email</span>
              <strong>{created.email}</strong>
            </div>
            <div className="success-detail-row">
              <span>Status</span>
              <strong className="success-status">Pending Verification</strong>
            </div>
          </div>

          <p className="success-note">
            📧 An activation email has been dispatched to the employee's work email with login credentials.
          </p>

          <div className="success-actions">
            <button className="btn-next" onClick={() => navigate('/hr/verifications')}>
              View Verification Queue <ChevronRight size={18} />
            </button>
            <button
              className="btn-back"
              style={{ visibility: 'visible' }}
              onClick={() => {
                setCreated(null)
                setActiveStep(1)
                setFormData(INITIAL_FORM_DATA)
                setFiles({ aadhaarCard: null, panCard: null, resume: null, offerLetter: null, profilePhoto: null })
                clearOnboardingDraft()
              }}
            >
              Add Another Employee
            </button>
          </div>
        </div>
      )}

      {!created && (
        <>
          <div className="onboard-header glass-panel">
            <div className="header-text">
              <h1>Onboard New Employee</h1>
              <p>Complete the secure multi-step verification process.</p>
            </div>
            <button onClick={() => navigate('/hr/employees')} className="btn-cancel">
              Cancel Process
            </button>
          </div>

          <div className="onboard-layout">
            <div className="onboard-sidebar glass-panel">
              <h3>Workflow Progress</h3>
              <div className="stepper-list">
                {steps.map(step => {
                  const Icon = step.icon
                  const isActive = activeStep === step.id
                  const isCompleted = activeStep > step.id
                  const missingInStep = ESSENTIAL_FIELDS.filter(f => f.step === step.id && fieldErrors.includes(f.name)).length
                  return (
                    <div
                      key={step.id}
                      onClick={() => setActiveStep(step.id)}
                      className={`stepper-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${missingInStep > 0 ? 'step-has-error' : ''}`}
                    >
                      <div className="stepper-icon">
                        {isCompleted ? <CheckCircle size={20} /> : <Icon size={18} />}
                      </div>
                      <div className="stepper-text">
                        <span className="stepper-title">{step.name}</span>
                        <span className="stepper-desc">{step.desc}</span>
                      </div>
                      {missingInStep > 0 && <span className="step-error-badge">{missingInStep} required</span>}
                      {isActive && missingInStep === 0 && <ChevronRight size={16} className="stepper-arrow" />}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="onboard-main glass-panel">
              <form onSubmit={handleSubmit}>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${(activeStep / steps.length) * 100}%` }}></div>
                </div>

                <div className="form-content">
                  {error && (
                    <div className="error-banner">
                      <Shield size={20} />
                      <div>
                        <strong>Submission Error</strong>
                        <p>{error}</p>
                      </div>
                    </div>
                  )}

                  {activeStep === 1 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Personal Information</h2>
                        <p>Enter the core identity details for the new employee.</p>
                      </div>
                      <div className="form-grid">
                        <div className="onboard-field" key="employeeCode">
                          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              Employee ID
                              {autoCode && formData.employeeCode === autoCode ? (
                                <span style={{ fontSize: '0.72rem', color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                  Auto-Generated
                                </span>
                              ) : formData.employeeCode ? (
                                <span style={{ fontSize: '0.72rem', color: '#1e40af', background: '#dbeafe', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                  Custom ID (Editable)
                                </span>
                              ) : null}
                            </span>
                            {autoCode && formData.employeeCode !== autoCode && (
                              <button
                                type="button"
                                onClick={() => setFormData((prev: any) => ({ ...prev, employeeCode: autoCode }))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#4f46e5',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: 0
                                }}
                                title="Reset to auto-generated sequence ID"
                              >
                                <RefreshCw size={12} /> Reset to {autoCode}
                              </button>
                            )}
                          </label>
                          <input
                            type="text"
                            name="employeeCode"
                            placeholder={autoCode || "e.g., VRPITS00236"}
                            value={formData.employeeCode || ''}
                            onChange={handleChange}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            style={{ fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.04em' }}
                          />
                        </div>
                        {renderInput({ label: "First Name", name: "firstName", required: true })}
                        {renderInput({ label: "Last Name", name: "lastName", required: true })}
                        {renderInput({ label: "Work Email", name: "workEmail", type: "email", required: true, autoComplete: "off" })}
                        {renderInput({ label: "Personal Email", name: "personalEmail", type: "email", required: true, autoComplete: "new-password" })}
                        {renderInput({ label: "Mobile Number", name: "mobileNumber", required: true })}
                        {renderInput({ label: "Date of Birth", name: "dateOfBirth", type: "date" })}
                        {renderSelect({ label: "Gender", name: "gender", options: ['Male', 'Female', 'Other'] })}
                        {renderSelect({ label: "Marital Status", name: "maritalStatus", options: ['Single', 'Married'] })}
                      </div>
                    </div>
                  )}

                  {activeStep === 2 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Employment Profile</h2>
                        <p>Define the role, type, and timeline of employment.</p>
                      </div>
                      <div className="form-grid">
                        {renderSelect({ label: "Employment Type", name: "employmentType", options: [{ label: 'Full Time', value: 'FULL_TIME' }, { label: 'Part Time', value: 'PART_TIME' }, { label: 'Contract', value: 'CONTRACT' }] })}
                        {renderSelect({ label: "Current Status", name: "employmentStatus", options: [{ label: 'Active', value: 'ACTIVE' }, { label: 'Probation', value: 'PROBATION' }] })}
                        {renderSelect({ label: "Experience Level", name: "experienceLevel", options: [{ label: 'Fresher', value: 'fresher' }, { label: 'Experienced', value: 'experienced' }] })}
                        {renderInput({ label: "Joining Date", name: "joiningDate", type: "date", required: true })}
                        {renderSelect({ label: "Assigned Shift", name: "shift", options: ['General Shift', 'Morning Shift', 'Afternoon Shift', 'Night Shift'] })}
                      </div>
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Payroll & Financials</h2>
                        <p>Configure compensation and banking coordinates.</p>
                      </div>
                      <div className="form-grid">
                        {renderInput({ label: "Basic Salary (Annual ₹)", name: "basicSalary", type: "number" })}
                        {renderInput({ label: "Monthly Salary (₹)", name: "monthlySalary", type: "number" })}
                        {renderSelect({ label: "Payment Method", name: "paymentType", options: ['Bank Transfer', 'Cash', 'Cheque'] })}
                        {renderInput({ label: "Bank Name", name: "bankName" })}
                        {renderInput({ label: "Account Number", name: "accountNumber" })}
                        {renderInput({ label: "IFSC Code", name: "ifscCode" })}
                        {renderInput({ label: "PAN Number", name: "panNumber" })}
                        {renderInput({ label: "UAN Number", name: "uanNumber" })}
                      </div>

                      {/* Salary Particulars & Statutory Deductions Breakdown (Offer Letter Style) */}
                      <SalaryBreakdown
                        annualSalary={formData.basicSalary}
                        monthlySalary={formData.monthlySalary}
                        onSalaryChange={(annual, monthly, epfMonthly) => {
                          setFormData((prev: typeof INITIAL_FORM_DATA) => ({
                            ...prev,
                            basicSalary: String(annual),
                            monthlySalary: String(monthly),
                            pfAmount: String(epfMonthly),
                          }))
                        }}
                      />
                    </div>
                  )}

                  {activeStep === 4 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Attendance & Access Control</h2>
                        <p>Setup time tracking and security authentications.</p>
                      </div>
                      <div className="form-grid">
                        {renderSelect({ label: "Attendance Mode", name: "attendanceType", options: [{ label: 'Facial Attendance', value: 'FACIAL' }, { label: 'QR Attendance', value: 'QR' }, { label: 'Both Facial and QR', value: 'BOTH' }] })}
                      </div>

                      <div className="toggle-box mt-4">
                        <input type="checkbox" id="sendActivationEmail" checked={formData.sendActivationEmail === 'true'} onChange={(e) => setFormData({ ...formData, sendActivationEmail: e.target.checked ? 'true' : 'false' })} />
                        <div>
                          <label htmlFor="sendActivationEmail">Dispatch Activation Sequence</label>
                          <p>Automatically sends a cryptographically secure login link to the employee's work email.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeStep === 5 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Residential Address</h2>
                        <p>Permanent or current living address for records.</p>
                      </div>
                      <div className="form-grid">
                        {renderInput({ label: "Address Line 1", name: "addressLine1", fullWidth: true })}
                        {renderInput({ label: "City", name: "city" })}
                        {renderInput({ label: "State / Province", name: "state" })}
                        {renderInput({ label: "Postal / ZIP Code", name: "postalCode" })}
                        {renderInput({ label: "Country", name: "country" })}
                      </div>
                    </div>
                  )}

                  {activeStep === 6 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Emergency Contacts</h2>
                        <p>Who should we contact in an emergency?</p>
                      </div>
                      <div className="form-grid">
                        {renderInput({ label: "Primary Contact Name", name: "emergencyContactName" })}
                        {renderInput({ label: "Relationship (e.g., Spouse)", name: "emergencyRelationship" })}
                        {renderInput({ label: "Emergency Mobile Number", name: "emergencyMobile" })}
                      </div>
                    </div>
                  )}

                  {activeStep === 7 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Document Uploads</h2>
                        <p>Attach KYC and professional credentials (Max 10MB each). Upload documents and click <strong>Create Employee</strong> to complete onboarding.</p>
                      </div>
                      <div className="form-grid">
                        <div className={`file-upload-box ${files.profilePhoto ? 'file-uploaded' : ''}`}>
                          <label>Profile Photograph</label>
                          <input type="file" name="profilePhoto" onChange={handleFileChange} accept="image/*" />
                          {files.profilePhoto
                            ? <div className="file-chosen">✅ {files.profilePhoto.name}</div>
                            : <div className="file-hint">JPG, PNG — Max 10MB</div>}
                        </div>
                        <div className={`file-upload-box ${files.aadhaarCard ? 'file-uploaded' : ''}`}>
                          <label>Aadhaar Card</label>
                          <input type="file" name="aadhaarCard" onChange={handleFileChange} accept=".pdf,.jpg,.png" />
                          {files.aadhaarCard
                            ? <div className="file-chosen">✅ {files.aadhaarCard.name}</div>
                            : <div className="file-hint">PDF, JPG, PNG — Max 10MB</div>}
                        </div>
                        <div className={`file-upload-box ${files.panCard ? 'file-uploaded' : ''}`}>
                          <label>PAN Card</label>
                          <input type="file" name="panCard" onChange={handleFileChange} accept=".pdf,.jpg,.png" />
                          {files.panCard
                            ? <div className="file-chosen">✅ {files.panCard.name}</div>
                            : <div className="file-hint">PDF, JPG, PNG — Max 10MB</div>}
                        </div>
                        <div className={`file-upload-box ${files.resume ? 'file-uploaded' : ''}`}>
                          <label>Latest Resume</label>
                          <input type="file" name="resume" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
                          {files.resume
                            ? <div className="file-chosen">✅ {files.resume.name}</div>
                            : <div className="file-hint">PDF, DOC, DOCX — Max 10MB</div>}
                        </div>
                        <div className={`file-upload-box ${files.previousPayslips ? 'file-uploaded' : ''}`}>
                          <label>Previous Payslips</label>
                          <input type="file" name="previousPayslips" onChange={handleFileChange} accept=".pdf,.jpg,.png" />
                          {files.previousPayslips
                            ? <div className="file-chosen">✅ {files.previousPayslips.name}</div>
                            : <div className="file-hint">PDF, JPG, PNG — Max 10MB</div>}
                        </div>
                      </div>

                      {/* Upload progress indicator */}
                      <div className="doc-upload-status">
                        <div className="doc-upload-bar-wrap">
                          <div
                            className="doc-upload-bar-fill"
                            style={{ width: `${(Object.values(files).filter(Boolean).length / Object.keys(files).length) * 100}%` }}
                          />
                        </div>
                        <span className="doc-upload-count">
                          {Object.values(files).filter(Boolean).length} of {Object.keys(files).length} documents uploaded
                        </span>
                      </div>

                      <div className="submit-summary">
                        <div className="submit-summary-title">📋 Ready to Create Employee</div>
                        <div className="submit-summary-grid">
                          <div><span>Name</span><strong>{formData.firstName} {formData.lastName}</strong></div>
                          <div><span>Work Email</span><strong>{formData.workEmail || '—'}</strong></div>
                          <div><span>Join Date</span><strong>{formData.joiningDate || '—'}</strong></div>
                          <div><span>Basic Salary</span><strong>{formData.basicSalary ? `₹${Number(formData.basicSalary).toLocaleString('en-IN')}` : '—'}</strong></div>
                          <div><span>Employment</span><strong>{formData.employmentType.replace('_', ' ')}</strong></div>
                          <div><span>Documents</span><strong>{Object.values(files).filter(Boolean).length} file(s) attached</strong></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-footer">
                  <button
                    type="button"
                    onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
                    className={`btn-back ${activeStep === 1 ? 'hidden' : ''}`}
                  >
                    Go Back
                  </button>

                  {activeStep < steps.length ? (
                    <button
                      type="button"
                      onClick={() => setActiveStep(prev => Math.min(steps.length, prev + 1))}
                      className="btn-next"
                    >
                      Continue to Next Step <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-submit"
                    >
                      {isSubmitting
                        ? <><span className="spinner" /> Creating Employee…</>
                        : <>✓ Create Employee ({Object.values(files).filter(Boolean).length} doc{Object.values(files).filter(Boolean).length !== 1 ? 's' : ''} attached)</>
                      }
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      <style>{`
        .onboard-container {
          max-width: 1200px;
          margin: 0 auto;
          font-family: 'Inter', system-ui, sans-serif;
          color: #1e293b;
        }

        .onboard-success-screen {
          max-width: 560px;
          margin: 60px auto;
          text-align: center;
          animation: fadeIn 0.5s ease-out;
        }
        .success-icon-wrap {
          width: 100px; height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px;
          box-shadow: 0 8px 30px rgba(16,185,129,0.25);
        }
        .success-icon { color: #059669; }
        .onboard-success-screen h1 {
          font-size: 1.8rem; font-weight: 800; color: #0f172a;
          margin: 0 0 8px; letter-spacing: -0.02em;
        }
        .success-subtitle { color: #64748b; font-size: 1rem; margin: 0 0 32px; }

        .success-details-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          padding: 8px 0;
          margin-bottom: 24px;
          text-align: left;
        }
        .success-detail-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 24px;
          border-bottom: 1px solid #f8fafc;
          font-size: 0.9rem;
        }
        .success-detail-row:last-child { border-bottom: none; }
        .success-detail-row span { color: #94a3b8; font-weight: 600; }
        .success-detail-row strong { color: #0f172a; font-weight: 700; }
        .success-status { color: #f59e0b !important; }

        .success-note {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 0.88rem;
          color: #1d4ed8;
          margin-bottom: 28px;
        }
        .success-actions {
          display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
        }

        .glass-panel {
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
          border: 1px solid #f1f5f9;
        }

        .onboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 32px;
          margin-bottom: 32px;
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

        .btn-cancel {
          padding: 10px 20px;
          border-radius: 10px;
          border: 2px solid #e2e8f0;
          background: transparent;
          color: #475569;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .onboard-layout {
          display: flex;
          gap: 32px;
          align-items: flex-start;
        }

        .onboard-sidebar {
          width: 280px;
          padding: 24px;
          flex-shrink: 0;
        }

        .onboard-sidebar h3 {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #4f46e5;
          font-weight: 800;
          margin-top: 0;
          margin-bottom: 20px;
        }

        .stepper-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stepper-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .stepper-item:hover {
          background: #f8fafc;
        }

        .stepper-item.active {
          background: #eef2ff;
          transform: scale(1.02);
        }

        .stepper-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          border: 2px solid #e2e8f0;
          color: #94a3b8;
          transition: all 0.3s;
          z-index: 2;
        }

        .stepper-item.active .stepper-icon {
          background: #4f46e5;
          border-color: #4f46e5;
          color: white;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }

        .stepper-item.completed .stepper-icon {
          background: #10b981;
          border-color: #10b981;
          color: white;
        }

        .stepper-text {
          display: flex;
          flex-direction: column;
        }

        .stepper-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: #64748b;
        }

        .stepper-item.active .stepper-title { color: #312e81; }
        .stepper-item.completed .stepper-title { color: #0f172a; }

        .stepper-desc {
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .stepper-arrow {
          position: absolute;
          right: 16px;
          color: #818cf8;
        }

        .onboard-main {
          flex-grow: 1;
          overflow: hidden;
        }

        .progress-bar-bg {
          height: 6px;
          background: #f1f5f9;
          width: 100%;
        }

        .progress-bar-fill {
          height: 100%;
          background: #4f46e5;
          transition: width 0.4s ease-out;
        }

        .form-content {
          padding: 40px;
          min-height: 500px;
        }

        .section-header h2 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .section-header p {
          color: #64748b;
          margin: 6px 0 32px 0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .onboard-field.full-width {
          grid-column: span 2;
        }

        .onboard-field label {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 8px;
        }

        .onboard-field label span { color: #ef4444; }

        .onboard-field input, .onboard-field select {
          display: block;
          width: 100%;
          height: 50px;
          padding: 0 16px;
          line-height: 48px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 0.95rem;
          color: #0f172a;
          transition: all 0.2s;
          box-sizing: border-box;
          font-family: inherit;
        }

        .onboard-field input:focus, .onboard-field select:focus {
          outline: none;
          background: #ffffff;
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        .file-upload-box {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 20px;
          background: #f8fafc;
          transition: all 0.2s;
        }
        .file-upload-box:hover {
          border-color: #818cf8;
          background: #eef2ff;
        }
        .file-upload-box.file-uploaded {
          border-color: #10b981;
          background: #f0fdf4;
        }
        .file-upload-box label {
          display: block;
          font-weight: 700;
          color: #475569;
          margin-bottom: 12px;
        }
        .file-chosen {
          margin-top: 8px; font-size: 0.78rem; color: #059669; font-weight: 600;
        }
        .file-hint {
          margin-top: 6px; font-size: 0.75rem; color: #94a3b8; font-weight: 500;
        }

        /* Document upload progress bar */
        .doc-upload-status {
          grid-column: span 2;
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .doc-upload-bar-wrap {
          flex: 1;
          height: 8px;
          background: #e2e8f0;
          border-radius: 99px;
          overflow: hidden;
        }
        .doc-upload-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #059669);
          border-radius: 99px;
          transition: width 0.4s ease;
        }
        .doc-upload-count {
          font-size: 0.78rem;
          font-weight: 700;
          color: #64748b;
          white-space: nowrap;
        }

        /* Submit button spinner */
        .spinner {
          display: inline-block;
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .submit-summary {
          grid-column: span 2;
          margin-top: 24px;
          background: linear-gradient(135deg, #eef2ff, #f0fdf4);
          border: 1px solid #c7d2fe;
          border-radius: 14px;
          padding: 20px 24px;
        }
        .submit-summary-title {
          font-weight: 800; color: #3730a3; margin-bottom: 16px; font-size: 0.95rem;
        }
        .submit-summary-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        }
        .submit-summary-grid div {
          display: flex; flex-direction: column; gap: 2px;
        }
        .submit-summary-grid span { font-size: 0.72rem; color: #6366f1; font-weight: 700; text-transform: uppercase; }
        .submit-summary-grid strong { font-size: 0.88rem; color: #1e293b; font-weight: 700; }

        .toggle-box {
          grid-column: span 2;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          border-radius: 12px;
        }

        .toggle-box input[type="checkbox"] {
          width: 24px;
          height: 24px;
          cursor: pointer;
          accent-color: #4f46e5;
          margin-top: 2px;
        }

        .toggle-box label {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e3a8a;
          display: block;
          cursor: pointer;
        }

        .toggle-box p {
          margin: 4px 0 0 0;
          color: #4f46e5;
          font-size: 0.9rem;
        }

        .form-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 40px;
          background: #f8fafc;
          border-top: 1px solid #f1f5f9;
        }

        .btn-back {
          padding: 12px 24px;
          border-radius: 12px;
          background: white;
          border: 2px solid #e2e8f0;
          color: #475569;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-back:hover { background: #f1f5f9; }
        .btn-back.hidden { visibility: hidden; }

        .btn-next {
          padding: 12px 28px;
          border-radius: 12px;
          background: #4f46e5;
          color: white;
          font-weight: 700;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
          transition: all 0.2s;
        }

        .btn-next:hover {
          background: #4338ca;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(79, 70, 229, 0.5);
        }

        .btn-submit {
          padding: 14px 36px;
          border-radius: 12px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-weight: 800;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          letter-spacing: 0.01em;
        }

        .btn-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(16, 185, 129, 0.5);
        }

        .btn-submit:disabled {
          opacity: 0.75;
          cursor: not-allowed;
          transform: none;
        }

        .has-field-error label {
          color: #dc2626 !important;
        }

        .input-error-highlight {
          border-color: #ef4444 !important;
          background-color: #fef2f2 !important;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15) !important;
        }

        .field-required-badge {
          color: #dc2626;
          font-size: 0.72rem;
          font-weight: 700;
          margin-left: 8px;
          background: #fee2e2;
          padding: 2px 8px;
          border-radius: 6px;
          text-transform: none;
          display: inline-block;
        }

        .field-error-subtext {
          color: #dc2626;
          font-size: 0.78rem;
          margin-top: 6px;
          font-weight: 600;
        }

        .step-has-error {
          border: 1px solid #fca5a5 !important;
          background: #fff5f5 !important;
        }

        .step-error-badge {
          background: #ef4444;
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          margin-left: auto;
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 16px;
          border-radius: 12px;
          color: #b91c1c;
          margin-bottom: 24px;
        }

        .error-banner p { margin: 4px 0 0 0; }

        .fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .onboard-layout { flex-direction: column; }
          .onboard-sidebar { width: 100%; padding: 20px; }
          .form-grid { grid-template-columns: 1fr; }
          .onboard-field.full-width { grid-column: auto; }
          .toggle-box { grid-column: auto; }
          .submit-summary { grid-column: auto; }
          .submit-summary-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
