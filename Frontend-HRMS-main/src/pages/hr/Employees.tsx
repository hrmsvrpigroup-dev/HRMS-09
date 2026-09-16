import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { employeeApi, Employee } from '../../api/employee.api'
import { AddEmployeeModal } from '../../components/onboarding/AddEmployeeModal'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'
import { downloadEmployeeExcel } from '../../utils/excelExport'

export default function Employees() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const cached = sessionStorage.getItem('hrms_cached_employees')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>(() => {
    try {
      const cached = sessionStorage.getItem('hrms_cached_employees')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('hrms_cached_employees')
    } catch {
      return true
    }
  })
  const [error, setError] = useState('')
  const [showAddEmployee, setShowAddEmployee] = useState(false)

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const fetchEmployees = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await employeeApi.list()
      const data = res.data.data || []
      setEmployees(data)
      setFilteredEmployees(data)
      try {
        sessionStorage.setItem('hrms_cached_employees', JSON.stringify(data))
      } catch {}
    } catch {
      setError('Could not retrieve workspace employee rosters.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return
    try {
      await employeeApi.delete(id)
      await fetchEmployees()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete employee')
    }
  }

  useEffect(() => {
    fetchEmployees(employees.length > 0)
  }, [])

  // Handle Search and Filtering locally
  useEffect(() => {
    let result = [...employees]

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (emp) =>
          emp.firstName.toLowerCase().includes(term) ||
          emp.lastName.toLowerCase().includes(term) ||
          emp.email.toLowerCase().includes(term) ||
          emp.employeeCode.toLowerCase().includes(term)
      )
    }

    if (deptFilter !== 'ALL') {
      result = result.filter((emp) => emp.department?.name === deptFilter)
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((emp) => emp.status === statusFilter)
    }

    setFilteredEmployees(result)
  }, [searchTerm, deptFilter, statusFilter, employees])

  // Extract unique departments for filters
  const uniqueDepts = Array.from(
    new Set(employees.map((emp) => emp.department?.name).filter(Boolean))
  ) as string[]

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="page-header">
        <div className="page-header-title">
          <h1>Employee Directory</h1>
          <p>Onboard and audit active directory employee records and divisions.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '8px' }}>
          <button
            className="btn-secondary"
            onClick={() => downloadEmployeeExcel(filteredEmployees, 'hr_employees_directory')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            title="Download Employee Names, Work Mails, and Personal Mails as Excel Spreadsheet"
          >
            <Download size={16} />
            Download Excel
          </button>
          <button className="btn-secondary" onClick={() => navigate('/hr/verifications')}>
            Onboarding Panel
          </button>
          <button className="btn-primary" onClick={() => navigate('/hr/employees/add')}>
            + Add Employee
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div style={{ flex: 2, minWidth: '250px' }}>
          <input
            type="text"
            placeholder="Search by name, email, or employee code..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <select value={deptFilter} onChange={(event) => setDeptFilter(event.target.value)} style={{ width: '100%' }}>
            <option value="ALL">All Departments</option>
            {uniqueDepts.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ width: '100%' }}>
            <option value="ALL">ALL Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--error)' }}>
          {error}
        </div>
      ) : (
        <div className="card table-container" style={{ marginTop: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee Name</th>
                <th>Work Email</th>
                <th>Personal Email</th>
                <th>Department & Title</th>
                <th>Status</th>
                <th>Base Gross Salary</th>
                <th>Join Date</th>
                <th>Advising HR</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{emp.employeeCode}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {emp.firstName} {emp.lastName}
                  </td>
                  <td>{emp.email}</td>
                  <td>{emp.personalEmail || '-'}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {emp.designation?.title || 'Team Member'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {emp.department?.name || 'Operations'}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        ...(emp.status === 'ACTIVE'
                          ? { background: '#dcfce3', color: '#166534' }
                          : emp.status === 'ON_LEAVE'
                          ? { background: '#fef3c7', color: '#92400e' }
                          : { background: '#fee2e2', color: '#991b1b' })
                      }}
                    >
                      {emp.status || 'UNKNOWN'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    ₹{emp.salaryGross.toLocaleString()}/mo
                  </td>
                  <td>{new Date(emp.joiningDate).toLocaleDateString()}</td>
                  <td>
                    {emp.hrUser ? (
                      <span style={{ fontSize: '0.88rem' }}>
                        {emp.hrUser.firstName} {emp.hrUser.lastName}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Auto assigned</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => navigate(`/hr/employees/edit/${emp.id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-danger"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => handleDelete(emp.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    No matching employee records found in directory.
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
