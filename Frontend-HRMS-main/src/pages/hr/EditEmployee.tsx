import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { employeeApi } from '../../api/employee.api'
import { CheckCircle, ChevronRight, UploadCloud, Shield, User, MapPin, Building, CreditCard, Activity, ArrowLeft } from 'lucide-react'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'

export default function EditEmployee() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  
  const [activeStep, setActiveStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedSuccessfully, setUpdatedSuccessfully] = useState(false)
  const [employeeList, setEmployeeList] = useState<any[]>([])

  const [formData, setFormData] = useState({
    employeeCode: '',
    firstName: '', lastName: '', gender: 'Male', dateOfBirth: '', mobileNumber: '', personalEmail: '', workEmail: '', maritalStatus: 'Single',
    departmentName: '', designationTitle: '', employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE', branchId: '', shift: 'General Shift', reportingManagerId: '', joiningDate: '',
    salaryStructure: '', basicSalary: '', monthlySalary: '', pfAmount: '', paymentType: 'Bank Transfer', bankName: '', accountNumber: '', ifscCode: '', panNumber: '', uanNumber: '', pfEnabled: 'false', esiEnabled: 'false',
    attendanceType: 'FACIAL', geoFencingEnabled: 'false', twoFactorEnabled: 'false',
    sendActivationEmail: 'false',
    country: '', state: '', city: '', addressLine1: '', addressLine2: '', postalCode: '',
    emergencyContactName: '', emergencyRelationship: '', emergencyMobile: '',
    experienceLevel: 'fresher',
  })

  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    aadhaarCard: null, panCard: null, resume: null, offerLetter: null, profilePhoto: null, previousPayslips: null
  })

  const [existingDocs, setExistingDocs] = useState<{ [key: string]: { name: string; url: string } }>({})

  const steps = [
    { id: 1, name: 'Basic Details', icon: User, desc: 'Personal info' },
    { id: 2, name: 'Employment', icon: Building, desc: 'Role details' },
    { id: 3, name: 'Payroll', icon: CreditCard, desc: 'Salary info' },
    { id: 4, name: 'Attendance', icon: Activity, desc: 'Time tracking' },
    { id: 5, name: 'Address', icon: MapPin, desc: 'Residential info' },
    { id: 6, name: 'Emergency', icon: Shield, desc: 'Emergency contacts' },
    { id: 7, name: 'Documents', icon: UploadCloud, desc: 'KYC files' },
  ]

  useEffect(() => {
    const loadEmployeeData = async () => {
      if (!id) return
      try {
        setLoading(true)
        const res = await employeeApi.getById(id)
        const emp = res.data.data

        // Fetch other employees to populate reporting manager select
        try {
          const listRes = await employeeApi.list()
          if (listRes.data && Array.isArray(listRes.data.data)) {
            setEmployeeList(listRes.data.data.filter((e: any) => e.id !== id))
          }
        } catch (listErr) {
          console.error('Failed to load employee list for manager selection', listErr)
        }

        setFormData({
          employeeCode: emp.employeeCode || '',
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          gender: emp.gender || 'Male',
          dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.slice(0, 10) : '',
          mobileNumber: emp.phone || '',
          personalEmail: emp.personalEmail || '', 
          workEmail: emp.email || '',
          maritalStatus: emp.maritalStatus || 'Single',
          
          departmentName: emp.department?.name || '',
          designationTitle: emp.designation?.title || '',
          employmentType: emp.employmentType || 'FULL_TIME',
          employmentStatus: emp.status || 'ACTIVE',
          branchId: emp.branchId || '',
          shift: emp.shift || 'General Shift',
          reportingManagerId: emp.managerId || '',
          joiningDate: emp.joiningDate ? emp.joiningDate.slice(0, 10) : '',

          salaryStructure: emp.payrollDetails?.salaryStructure || '',
          basicSalary: emp.payrollDetails?.basicSalary ? String(emp.payrollDetails.basicSalary) : '',
          monthlySalary: emp.payrollDetails?.monthlySalary ? String(emp.payrollDetails.monthlySalary) : '',
          pfAmount: emp.payrollDetails?.pfAmount ? String(emp.payrollDetails.pfAmount) : '',
          paymentType: emp.payrollDetails?.paymentType || 'Bank Transfer',
          bankName: emp.payrollDetails?.bankName || '',
          accountNumber: emp.payrollDetails?.accountNumber || '',
          ifscCode: emp.payrollDetails?.ifscCode || '',
          panNumber: emp.payrollDetails?.panNumber || '',
          uanNumber: emp.payrollDetails?.uanNumber || '',
          pfEnabled: emp.payrollDetails?.pfEnabled ? 'true' : 'false',
          esiEnabled: emp.payrollDetails?.esiEnabled ? 'true' : 'false',

          attendanceType: emp.attendanceType || 'FACIAL',
          geoFencingEnabled: emp.geoFencing ? 'true' : 'false',
          twoFactorEnabled: emp.twoFactor ? 'true' : 'false',
          sendActivationEmail: 'false',

          country: emp.addressInfo?.country || '',
          state: emp.addressInfo?.state || '',
          city: emp.addressInfo?.city || '',
          addressLine1: emp.addressInfo?.addressLine1 || '',
          addressLine2: emp.addressInfo?.addressLine2 || '',
          postalCode: emp.addressInfo?.postalCode || '',

          emergencyContactName: emp.emergencyContact?.name || '',
          emergencyRelationship: emp.emergencyContact?.relationship || '',
          emergencyMobile: emp.emergencyContact?.mobile || '',
          experienceLevel: emp.experienceLevel || 'fresher',
        })

        const docs: any = {}
        if (emp.onboardingDocs) {
          emp.onboardingDocs.forEach((doc: any) => {
            docs[doc.documentType] = { name: doc.fileName, url: doc.fileUrl }
          })
        }
        setExistingDocs(docs)
      } catch (err: any) {
        setError('Failed to load employee details. Please check the ID and try again.')
      } finally {
        setLoading(false)
      }
    }

    loadEmployeeData()
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [e.target.name]: e.target.files[0] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setIsSubmitting(true)
    setError('')

    // Basic validation before submit
    if (!formData.employeeCode || !formData.firstName || !formData.lastName || !formData.workEmail) {
      setError('Employee ID, first name, last name, and work email are required.')
      setIsSubmitting(false)
      setActiveStep(1)
      return
    }
    if (!formData.joiningDate) {
      setError('Joining date is required.')
      setIsSubmitting(false)
      setActiveStep(2)
      return
    }

    // UAN validation removed

    try {
      const fd = new FormData()
      Object.keys(formData).forEach(key => fd.append(key, formData[key as keyof typeof formData]))
      Object.keys(files).forEach(key => { if (files[key]) fd.append(key, files[key] as File) })

      await employeeApi.update(id, fd)
      setUpdatedSuccessfully(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update employee. Please check all fields and try again.')
      setIsSubmitting(false)
    }
  }

  const renderInput = ({ label, type = 'text', name, required = false, fullWidth = false }: any) => (
    <div className={`onboard-field ${fullWidth ? 'full-width' : ''}`} key={name}>
      <label>{label} {required && <span>*</span>}</label>
      <input required={required} type={type} name={name} value={formData[name as keyof typeof formData]} onChange={handleChange} />
    </div>
  )

  const renderSelect = ({ label, name, options, fullWidth = false }: any) => (
    <div className={`onboard-field ${fullWidth ? 'full-width' : ''}`} key={name}>
      <label>{label}</label>
      <select name={name} value={formData[name as keyof typeof formData]} onChange={handleChange}>
        {options.map((opt: any) => <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>)}
      </select>
    </div>
  )

  if (loading) return <LoadingSpinner />

  // Determine back navigation url based on current URL path
  const isFromAdmin = window.location.pathname.startsWith('/admin')
  const directoryPath = isFromAdmin ? '/admin/employees' : '/hr/employees'

  return (
    <div className="onboard-container">
      {/* ── SUCCESS SCREEN ── */}
      {updatedSuccessfully && (
        <div className="onboard-success-screen">
          <div className="success-icon-wrap">
            <CheckCircle size={64} className="success-icon" />
          </div>
          <h1>Employee Updated Successfully!</h1>
          <p className="success-subtitle">All modifications have been securely saved to the database.</p>

          <div className="success-details-card">
            <div className="success-detail-row">
              <span>Full Name</span>
              <strong>{formData.firstName} {formData.lastName}</strong>
            </div>
            <div className="success-detail-row">
              <span>Work Email</span>
              <strong>{formData.workEmail}</strong>
            </div>
            <div className="success-detail-row">
              <span>Designation</span>
              <strong>{formData.designationTitle || '—'}</strong>
            </div>
            <div className="success-detail-row">
              <span>Department</span>
              <strong>{formData.departmentName || '—'}</strong>
            </div>
          </div>

          <div className="success-actions">
            <button className="btn-next" onClick={() => navigate(directoryPath)}>
              Back to Employee Directory <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {!updatedSuccessfully && (
        <>
          <div className="onboard-header glass-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => navigate(directoryPath)} className="btn-back-arrow" title="Go Back">
                <ArrowLeft size={20} />
              </button>
              <div className="header-text">
                <h1>Edit Employee Profile</h1>
                <p>Modify credentials, role parameters, salary structures, or upload updated KYC documents.</p>
              </div>
            </div>
            <button onClick={() => navigate(directoryPath)} className="btn-cancel">
              Cancel
            </button>
          </div>

          <div className="onboard-layout">
            <div className="onboard-sidebar glass-panel">
              <h3>Edit Modules</h3>
              <div className="stepper-list">
                {steps.map(step => {
                  const Icon = step.icon
                  const isActive = activeStep === step.id
                  const isCompleted = activeStep > step.id
                  return (
                    <div 
                      key={step.id} 
                      onClick={() => setActiveStep(step.id)}
                      className={`stepper-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    >
                      <div className="stepper-icon">
                        {isCompleted ? <CheckCircle size={20} /> : <Icon size={18} />}
                      </div>
                      <div className="stepper-text">
                        <span className="stepper-title">{step.name}</span>
                        <span className="stepper-desc">{step.desc}</span>
                      </div>
                      {isActive && <ChevronRight size={16} className="stepper-arrow" />}
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
                        <strong>Update Error</strong>
                        <p>{error}</p>
                      </div>
                    </div>
                  )}

                  {activeStep === 1 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Personal Information</h2>
                        <p>Modify the core identity details for the employee.</p>
                      </div>
                      <div className="form-grid">
                        {renderInput({ label: "Employee ID", name: "employeeCode", required: true })}
                        {renderInput({ label: "First Name", name: "firstName", required: true })}
                        {renderInput({ label: "Last Name", name: "lastName", required: true })}
                        {renderInput({ label: "Work Email", name: "workEmail", type: "email", required: true })}
                        {renderInput({ label: "Personal Email", name: "personalEmail", type: "email" })}
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
                        <p>Update designation, department, reporting structure, and parameters.</p>
                      </div>
                      <div className="form-grid">
                        {renderInput({ label: "Department", name: "departmentName", required: true })}
                        {renderInput({ label: "Designation", name: "designationTitle", required: true })}
                        {renderSelect({ label: "Employment Type", name: "employmentType", options: [{label: 'Full Time', value: 'FULL_TIME'}, {label: 'Part Time', value: 'PART_TIME'}, {label: 'Contract', value: 'CONTRACT'}] })}
                        {renderSelect({ label: "Current Status", name: "employmentStatus", options: [{label: 'Active', value: 'ACTIVE'}, {label: 'Probation', value: 'PROBATION'}, {label: 'Inactive', value: 'INACTIVE'}, {label: 'On Leave', value: 'ON_LEAVE'}, {label: 'Terminated', value: 'TERMINATED'}] })}
                        {renderSelect({ label: "Experience Level", name: "experienceLevel", options: [{label: 'Fresher', value: 'fresher'}, {label: 'Experienced', value: 'experienced'}] })}
                        {renderInput({ label: "Joining Date", name: "joiningDate", type: "date", required: true })}
                        {renderSelect({ label: "Assigned Shift", name: "shift", options: ['General Shift', 'Morning Shift', 'Afternoon Shift', 'Night Shift'] })}
                        {renderSelect({
                          label: "Reporting Manager",
                          name: "reportingManagerId",
                          options: [{ label: "No Manager Assigned", value: "" }].concat(
                            employeeList.map((emp) => ({
                              label: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})`,
                              value: emp.id,
                            }))
                          ),
                        })}
                      </div>
                    </div>
                  )}

                  {activeStep === 3 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Payroll & Financials</h2>
                        <p>Configure and update salary structures and banking coordinates.</p>
                      </div>
                      <div className="form-grid">
                        {renderInput({ label: "Basic Salary (Annual ₹)", name: "basicSalary", type: "number" })}
                        {renderInput({ label: "Monthly Salary (₹)", name: "monthlySalary", type: "number" })}
                        {renderInput({ label: "PF Amount (₹)", name: "pfAmount", type: "number" })}
                        {renderSelect({ label: "Payment Method", name: "paymentType", options: ['Bank Transfer', 'Cash', 'Cheque'] })}
                        {renderInput({ label: "Bank Name", name: "bankName" })}
                        {renderInput({ label: "Account Number", name: "accountNumber" })}
                        {renderInput({ label: "IFSC Code", name: "ifscCode" })}
                        {renderInput({ label: "PAN Number", name: "panNumber" })}
                        {renderInput({ label: "UAN Number", name: "uanNumber" })}
                        {renderSelect({ label: "PF Enabled", name: "pfEnabled", options: [{label: 'Yes', value: 'true'}, {label: 'No', value: 'false'}] })}
                        {renderSelect({ label: "ESI Enabled", name: "esiEnabled", options: [{label: 'Yes', value: 'true'}, {label: 'No', value: 'false'}] })}
                      </div>
                    </div>
                  )}

                  {activeStep === 4 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Attendance & Access Control</h2>
                        <p>Manage time logging parameters and access rules.</p>
                      </div>
                      <div className="form-grid">
                        {renderSelect({ label: "Attendance Mode", name: "attendanceType", options: [{label:'Facial Attendance', value:'FACIAL'}, {label:'QR Attendance', value:'QR'}, {label:'Both Facial and QR', value:'BOTH'}] })}
                        {renderSelect({ label: "Geo-Fencing Enabled", name: "geoFencingEnabled", options: [{label:'Yes', value:'true'}, {label:'No', value:'false'}] })}
                        {renderSelect({ label: "Two-Factor Verification", name: "twoFactorEnabled", options: [{label:'Yes', value:'true'}, {label:'No', value:'false'}] })}
                      </div>
                    </div>
                  )}

                  {activeStep === 5 && (
                    <div className="step-section fade-in">
                      <div className="section-header">
                        <h2>Residential Address</h2>
                        <p>Update permanent or current residential coordinates.</p>
                      </div>
                      <div className="form-grid">
                        {renderInput({ label: "Address Line 1", name: "addressLine1", fullWidth: true })}
                        {renderInput({ label: "Address Line 2", name: "addressLine2", fullWidth: true })}
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
                        <p>Update primary contact details in case of emergencies.</p>
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
                        <p>Update KYC files (Max 10MB each). Uploading a new file will overwrite the existing document.</p>
                      </div>
                      <div className="form-grid">
                        {/* Profile Photo */}
                        <div className={`file-upload-box ${files.profilePhoto || existingDocs.profilePhoto ? 'file-uploaded' : ''}`}>
                          <label>Profile Photograph</label>
                          <input type="file" name="profilePhoto" onChange={handleFileChange} accept="image/*" />
                          {files.profilePhoto && <div className="file-chosen">New: 🔄 {files.profilePhoto.name}</div>}
                          {existingDocs.profilePhoto && (
                            <div className="existing-file-link">
                              📄 Current: <a href={existingDocs.profilePhoto.url} target="_blank" rel="noreferrer">{existingDocs.profilePhoto.name}</a>
                            </div>
                          )}
                          {!files.profilePhoto && !existingDocs.profilePhoto && <div className="file-hint">JPG, PNG — Max 10MB</div>}
                        </div>

                        {/* Aadhaar Card */}
                        <div className={`file-upload-box ${files.aadhaarCard || existingDocs.aadhaarCard ? 'file-uploaded' : ''}`}>
                          <label>Aadhaar Card</label>
                          <input type="file" name="aadhaarCard" onChange={handleFileChange} accept=".pdf,.jpg,.png" />
                          {files.aadhaarCard && <div className="file-chosen">New: 🔄 {files.aadhaarCard.name}</div>}
                          {existingDocs.aadhaarCard && (
                            <div className="existing-file-link">
                              📄 Current: <a href={existingDocs.aadhaarCard.url} target="_blank" rel="noreferrer">{existingDocs.aadhaarCard.name}</a>
                            </div>
                          )}
                          {!files.aadhaarCard && !existingDocs.aadhaarCard && <div className="file-hint">PDF, JPG, PNG — Max 10MB</div>}
                        </div>

                        {/* PAN Card */}
                        <div className={`file-upload-box ${files.panCard || existingDocs.panCard ? 'file-uploaded' : ''}`}>
                          <label>PAN Card</label>
                          <input type="file" name="panCard" onChange={handleFileChange} accept=".pdf,.jpg,.png" />
                          {files.panCard && <div className="file-chosen">New: 🔄 {files.panCard.name}</div>}
                          {existingDocs.panCard && (
                            <div className="existing-file-link">
                              📄 Current: <a href={existingDocs.panCard.url} target="_blank" rel="noreferrer">{existingDocs.panCard.name}</a>
                            </div>
                          )}
                          {!files.panCard && !existingDocs.panCard && <div className="file-hint">PDF, JPG, PNG — Max 10MB</div>}
                        </div>

                        {/* Resume */}
                        <div className={`file-upload-box ${files.resume || existingDocs.resume ? 'file-uploaded' : ''}`}>
                          <label>Latest Resume</label>
                          <input type="file" name="resume" onChange={handleFileChange} accept=".pdf,.doc,.docx" />
                          {files.resume && <div className="file-chosen">New: 🔄 {files.resume.name}</div>}
                          {existingDocs.resume && (
                            <div className="existing-file-link">
                              📄 Current: <a href={existingDocs.resume.url} target="_blank" rel="noreferrer">{existingDocs.resume.name}</a>
                            </div>
                          )}
                          {!files.resume && !existingDocs.resume && <div className="file-hint">PDF, DOC, DOCX — Max 10MB</div>}
                        </div>

                        {/* Previous Payslips */}
                        <div className={`file-upload-box ${files.previousPayslips || existingDocs.previousPayslips ? 'file-uploaded' : ''}`}>
                          <label>Previous Payslips</label>
                          <input type="file" name="previousPayslips" onChange={handleFileChange} accept=".pdf,.jpg,.png" />
                          {files.previousPayslips && <div className="file-chosen">New: 🔄 {files.previousPayslips.name}</div>}
                          {existingDocs.previousPayslips && (
                            <div className="existing-file-link">
                              📄 Current: <a href={existingDocs.previousPayslips.url} target="_blank" rel="noreferrer">{existingDocs.previousPayslips.name}</a>
                            </div>
                          )}
                          {!files.previousPayslips && !existingDocs.previousPayslips && <div className="file-hint">PDF, JPG, PNG — Max 10MB</div>}
                        </div>
                      </div>

                      <div className="submit-summary">
                        <div className="submit-summary-title">📋 Ready to Update Employee</div>
                        <div className="submit-summary-grid">
                          <div><span>Name</span><strong>{formData.firstName} {formData.lastName}</strong></div>
                          <div><span>Work Email</span><strong>{formData.workEmail || '—'}</strong></div>
                          <div><span>Join Date</span><strong>{formData.joiningDate || '—'}</strong></div>
                          <div><span>Basic Salary</span><strong>{formData.basicSalary ? `₹${Number(formData.basicSalary).toLocaleString('en-IN')}` : '—'}</strong></div>
                          <div><span>Employment</span><strong>{formData.employmentType.replace('_', ' ')}</strong></div>
                          <div><span>New Files</span><strong>{Object.values(files).filter(Boolean).length} file(s) attached</strong></div>
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
                      Continue <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="btn-submit"
                    >
                      {isSubmitting
                        ? <><span className="spinner" /> Saving Changes…</>
                        : <>✓ Save Changes</>
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

        .btn-back-arrow {
          background: transparent;
          border: none;
          cursor: pointer;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s;
        }
        .btn-back-arrow:hover {
          background: #f1f5f9;
          color: #0f172a;
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
        .existing-file-link {
          margin-top: 8px; font-size: 0.78rem; color: #4f46e5; font-weight: 600;
        }
        .existing-file-link a {
          color: #4f46e5; text-decoration: underline;
        }
        .existing-file-link a:hover {
          color: #3730a3;
        }
        .file-hint {
          margin-top: 6px; font-size: 0.75rem; color: #94a3b8; font-weight: 500;
        }

        .submit-summary {
          grid-column: span 2;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          margin-top: 32px;
        }
        .submit-summary-title {
          font-weight: 800; font-size: 1rem; color: #0f172a; margin-bottom: 16px;
        }
        .submit-summary-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px;
        }
        .submit-summary-grid div { display: flex; flex-direction: column; gap: 4px; }
        .submit-summary-grid span { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
        .submit-summary-grid strong { font-size: 0.95rem; color: #334155; }

        .form-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 40px;
          border-top: 1px solid #f1f5f9;
          background: #fafafa;
        }
        .btn-back {
          padding: 12px 24px; border-radius: 10px; border: 2px solid #e2e8f0; background: white; color: #475569; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .btn-back.hidden { visibility: hidden; }
        .btn-back:hover { background: #f8fafc; border-color: #cbd5e1; }
        
        .btn-next, .btn-submit {
          display: flex; align-items: center; gap: 8px; padding: 12px 28px; border-radius: 10px; border: none; font-weight: 700; cursor: pointer; transition: all 0.2s;
        }
        .btn-next { background: #4f46e5; color: white; }
        .btn-next:hover { background: #4338ca; }
        .btn-submit { background: #10b981; color: white; }
        .btn-submit:hover { background: #059669; }

        .spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .error-banner {
          background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; color: #991b1b; display: flex; gap: 14px; margin-bottom: 28px;
        }
        .error-banner strong { font-size: 0.95rem; }
        .error-banner p { font-size: 0.85rem; margin: 4px 0 0 0; }

        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
