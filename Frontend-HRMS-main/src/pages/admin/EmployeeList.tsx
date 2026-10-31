import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react'
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

  // Search & Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortOption, setSortOption] = useState('CODE_ASC')

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

  // Handle Search, Filtering, and Sorting locally (Zero latency & Zero data loss)
  useEffect(() => {
    let result = [...employees]

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim()
      result = result.filter(
        (emp) =>
          emp.firstName?.toLowerCase().includes(term) ||
          emp.lastName?.toLowerCase().includes(term) ||
          emp.email?.toLowerCase().includes(term) ||
          emp.employeeCode?.toLowerCase().includes(term)
      )
    }

    if (deptFilter !== 'ALL') {
      result = result.filter((emp) => emp.department?.name === deptFilter)
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((emp) => emp.status === statusFilter)
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortOption) {
        case 'CODE_ASC':
          return (a.employeeCode || '').localeCompare(b.employeeCode || '', undefined, {
            numeric: true,
            sensitivity: 'base'
          })
        case 'CODE_DESC':
          return (b.employeeCode || '').localeCompare(a.employeeCode || '', undefined, {
            numeric: true,
            sensitivity: 'base'
          })
        case 'NAME_ASC': {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim()
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim()
          return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
        }
        case 'NAME_DESC': {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim()
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim()
          return nameB.localeCompare(nameA, undefined, { sensitivity: 'base' })
        }
        case 'SALARY_DESC':
          return (Number(b.salaryGross) || 0) - (Number(a.salaryGross) || 0)
        case 'SALARY_ASC':
          return (Number(a.salaryGross) || 0) - (Number(b.salaryGross) || 0)
        case 'JOIN_DESC':
          return new Date(b.joiningDate || 0).getTime() - new Date(a.joiningDate || 0).getTime()
        case 'JOIN_ASC':
          return new Date(a.joiningDate || 0).getTime() - new Date(b.joiningDate || 0).getTime()
        case 'DEPT_ASC':
          return (a.department?.name || '').localeCompare(b.department?.name || '', undefined, {
            sensitivity: 'base'
          })
        case 'DEPT_DESC':
          return (b.department?.name || '').localeCompare(a.department?.name || '', undefined, {
            sensitivity: 'base'
          })
        default:
          return 0
      }
    })

    setFilteredEmployees(result)
  }, [searchTerm, deptFilter, statusFilter, sortOption, employees])

  // Extract unique departments for filters
  const uniqueDepts = Array.from(
    new Set(employees.map((emp) => emp.department?.name).filter(Boolean))
  ) as string[]

  const handleHeaderSort = (field: 'code' | 'name' | 'salary' | 'joiningDate' | 'department') => {
    switch (field) {
      case 'code':
        setSortOption((prev) => (prev === 'CODE_ASC' ? 'CODE_DESC' : 'CODE_ASC'))
        break
      case 'name':
        setSortOption((prev) => (prev === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC'))
        break
      case 'salary':
        setSortOption((prev) => (prev === 'SALARY_DESC' ? 'SALARY_ASC' : 'SALARY_DESC'))
        break
      case 'joiningDate':
        setSortOption((prev) => (prev === 'JOIN_DESC' ? 'JOIN_ASC' : 'JOIN_DESC'))
        break
      case 'department':
        setSortOption((prev) => (prev === 'DEPT_ASC' ? 'DEPT_DESC' : 'DEPT_ASC'))
        break
    }
  }

  const renderSortIndicator = (field: 'code' | 'name' | 'salary' | 'joiningDate' | 'department') => {
    const isField =
      (field === 'code' && (sortOption === 'CODE_ASC' || sortOption === 'CODE_DESC')) ||
      (field === 'name' && (sortOption === 'NAME_ASC' || sortOption === 'NAME_DESC')) ||
      (field === 'salary' && (sortOption === 'SALARY_ASC' || sortOption === 'SALARY_DESC')) ||
      (field === 'joiningDate' && (sortOption === 'JOIN_ASC' || sortOption === 'JOIN_DESC')) ||
      (field === 'department' && (sortOption === 'DEPT_ASC' || sortOption === 'DEPT_DESC'))

    if (!isField) {
      return <ArrowUpDown size={13} style={{ opacity: 0.35, marginLeft: '4px', verticalAlign: 'middle' }} />
    }

    const isDesc =
      sortOption === 'CODE_DESC' ||
      sortOption === 'NAME_DESC' ||
      sortOption === 'SALARY_DESC' ||
      sortOption === 'JOIN_DESC' ||
      sortOption === 'DEPT_DESC'

    return isDesc ? (
      <ArrowDown size={13} style={{ color: 'var(--primary)', marginLeft: '4px', verticalAlign: 'middle' }} />
    ) : (
      <ArrowUp size={13} style={{ color: 'var(--primary)', marginLeft: '4px', verticalAlign: 'middle' }} />
    )
  }

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
        <div style={{ flex: 2, minWidth: '220px' }}>
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

        <div style={{ flex: 1, minWidth: '140px' }}>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ width: '100%' }}>
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>

        {/* Sort Filter Dropdown */}
        <div style={{ flex: 1.2, minWidth: '180px' }}>
          <select
            value={sortOption}
            onChange={(event) => setSortOption(event.target.value)}
            style={{ width: '100%', fontWeight: 500 }}
            title="Sort employee records"
          >
            <option value="CODE_ASC">Sort: Code (01 → 99)</option>
            <option value="CODE_DESC">Sort: Code (99 → 01)</option>
            <option value="NAME_ASC">Sort: Name (A → Z)</option>
            <option value="NAME_DESC">Sort: Name (Z → A)</option>
            <option value="SALARY_DESC">Sort: Salary (High → Low)</option>
            <option value="SALARY_ASC">Sort: Salary (Low → High)</option>
            <option value="JOIN_DESC">Sort: Join Date (Newest)</option>
            <option value="JOIN_ASC">Sort: Join Date (Oldest)</option>
            <option value="DEPT_ASC">Sort: Department (A → Z)</option>
            <option value="DEPT_DESC">Sort: Department (Z → A)</option>
          </select>
        </div>

        {/* Reset Filter Button */}
        {(searchTerm || deptFilter !== 'ALL' || statusFilter !== 'ALL' || sortOption !== 'CODE_ASC') && (
          <button
            className="btn-secondary"
            onClick={() => {
              setSearchTerm('')
              setDeptFilter('ALL')
              setStatusFilter('ALL')
              setSortOption('CODE_ASC')
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.85rem' }}
            title="Reset filters and sorting to default"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-0.75rem 0.25rem 0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <span>Showing <strong>{filteredEmployees.length}</strong> of <strong>{employees.length}</strong> employees</span>
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
                <th
                  onClick={() => handleHeaderSort('code')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort by Employee Code"
                >
                  Code {renderSortIndicator('code')}
                </th>
                <th
                  onClick={() => handleHeaderSort('name')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort by Name"
                >
                  Employee Name {renderSortIndicator('name')}
                </th>
                <th>Work Email</th>
                <th>Personal Email</th>
                <th
                  onClick={() => handleHeaderSort('department')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort by Department"
                >
                  Department & Title {renderSortIndicator('department')}
                </th>
                <th>Status</th>
                <th
                  onClick={() => handleHeaderSort('salary')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort by Salary"
                >
                  Base Gross Salary {renderSortIndicator('salary')}
                </th>
                <th
                  onClick={() => handleHeaderSort('joiningDate')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Click to sort by Joining Date"
                >
                  Join Date {renderSortIndicator('joiningDate')}
                </th>
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
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    No matching employee records found in directory.
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
