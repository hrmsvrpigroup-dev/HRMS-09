import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { employeeApi, Employee } from '../../api/employee.api'
import { AddEmployeeModal } from '../../components/onboarding/AddEmployeeModal'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'
import { downloadEmployeeExcel } from '../../utils/excelExport'

export default function EmployeeList() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddEmployee, setShowAddEmployee] = useState(false)

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const res = await employeeApi.list()
      const nextEmployees = Array.isArray(res.data.data) ? res.data.data : []
      setEmployees(nextEmployees)
      setFilteredEmployees(nextEmployees)
      setError('')
    } catch (err) {
      console.error('Failed to load employee directory', err)
      setEmployees([])
      setFilteredEmployees([])
      setError('')
    } finally {
      setLoading(false)
    }
  }

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return
    setDeletingId(id)
    try {
      await employeeApi.delete(id)
      setEmployees((prev) => prev.filter((e) => e.id !== id))
      setFilteredEmployees((prev) => prev.filter((e) => e.id !== id))
      await fetchEmployees()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete employee')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    fetchEmployees()
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
          <p>Complete workspace active directory roster and organization division audits.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={() => downloadEmployeeExcel(filteredEmployees, 'admin_employees_directory')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            title="Download Employee Names, Work Mails, and Personal Mails as Excel Spreadsheet"
          >
            <Download size={16} />
            Download Excel
          </button>
          <button className="btn-secondary" onClick={() => navigate('/admin/onboarding')}>
            Onboarding Panel
          </button>
          <button className="btn-primary" onClick={() => setShowAddEmployee(true)}>
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
            <option value="ALL">All Statuses</option>
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
                <th>HR Representative</th>
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
                      className={`badge ${
                        emp.status === 'ACTIVE'
                          ? 'badge-success'
                          : emp.status === 'ON_LEAVE'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
                      {emp.status}
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
                        onClick={() => navigate(`/admin/employees/edit/${emp.id}`)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-danger"
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                          opacity: deletingId === emp.id ? 0.6 : 1,
                          cursor: deletingId === emp.id ? 'not-allowed' : 'pointer'
                        }}
                        disabled={deletingId === emp.id}
                        onClick={() => handleDelete(emp.id)}
                      >
                        {deletingId === emp.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    No matching employee records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AddEmployeeModal
        open={showAddEmployee}
        onClose={() => setShowAddEmployee(false)}
        creatorLabel="Admin"
        reviewPath="/admin/onboarding"
      />
    </div>
  )
}
