import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hrApi, HRDashboardData } from '../../api/hr.api'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'
import {
  ClipboardList, CheckCircle2, XCircle, Play,
  Clock, CheckCheck, Users, RefreshCw, ArrowRight
} from 'lucide-react'

/* ─── Task types (mirrors Tasks.tsx / TaskAssignment.tsx) ─── */
interface AssignedTask {
  id: string
  employeeId: string
  employeeName: string
  employeeCode: string
  title: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'TODO' | 'ACCEPTED' | 'PROGRESS' | 'COMPLETED' | 'REJECTED'
  dueDate: string
  assignedDate: string
  assignedBy: string
}

const TASK_KEY = 'hrms_hr_assigned_tasks'

function loadAllTasks(): AssignedTask[] {
  try {
    const raw = localStorage.getItem(TASK_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/* ─── Status config ─── */
const STATUS_CFG: Record<string, {
  label: string; bg: string; color: string; border: string;
  icon: React.ReactNode; dot: string
}> = {
  TODO:      { label: 'Pending Review', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: <ClipboardList size={13} />, dot: '#3b82f6' },
  ACCEPTED:  { label: 'Accepted',       bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', icon: <CheckCircle2  size={13} />, dot: '#f97316' },
  PROGRESS:  { label: 'In Progress',    bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff', icon: <Play          size={13} />, dot: '#8b5cf6' },
  COMPLETED: { label: 'Completed',      bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: <CheckCheck    size={13} />, dot: '#10b981' },
  REJECTED:  { label: 'Rejected',       bg: '#fff1f2', color: '#be123c', border: '#fecdd3', icon: <XCircle       size={13} />, dot: '#ef4444' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<HRDashboardData | null>(() => {
    try {
      const cached = sessionStorage.getItem('hrms_cached_hr_dashboard')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('hrms_cached_hr_dashboard')
    } catch {
      return true
    }
  })
  const [error, setError] = useState('')
  const [tasks, setTasks] = useState<AssignedTask[]>([])
  const [taskFilter, setTaskFilter] = useState<string>('ALL')

  const fetchDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError('')
      const res = await hrApi.getDashboard()
      setData(res)
      setError('')
      try {
        sessionStorage.setItem('hrms_cached_hr_dashboard', JSON.stringify(res))
      } catch {}
    } catch {
      if (!data) {
        setError('Could not retrieve HR operational metrics.')
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshTasks = () => setTasks(loadAllTasks())

  useEffect(() => {
    fetchDashboard(!!data)
    refreshTasks()
    const iv = setInterval(refreshTasks, 5000)
    return () => clearInterval(iv)
  }, [])

  if (loading && !data) return <LoadingSpinner />

  if (error && !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ color: 'var(--error)', marginBottom: '1rem' }}>HR Portal Synchronization Error</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <button onClick={() => fetchDashboard()} className="btn-primary" style={{ marginTop: '1.5rem', display: 'inline-flex' }}>
          Retry Synchronizing
        </button>
      </div>
    )
  }

  /* Task stats */
  const taskStats = {
    total:     tasks.length,
    todo:      tasks.filter(t => t.status === 'TODO').length,
    accepted:  tasks.filter(t => t.status === 'ACCEPTED').length,
    progress:  tasks.filter(t => t.status === 'PROGRESS').length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length,
    rejected:  tasks.filter(t => t.status === 'REJECTED').length,
  }

  const filteredTasks = taskFilter === 'ALL'
    ? tasks
    : tasks.filter(t => t.status === taskFilter)

  /* Recent activity = non-TODO tasks sorted by newest first */
  const recentActivity = [...tasks]
    .filter(t => t.status !== 'TODO')
    .slice(0, 5)

  return (
    <div className="hr-dash-root">

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-header-title">
          <h1>{data?.companyName || 'Workspace'} HR Command Center</h1>
          <p>Supervise personnel profiles, task activity, leave queues, and resource balances.</p>
        </div>
      </div>

      {/* ── Top stat cards ── */}
      <div className="stat-grid">
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-label">My Managed Employees</span>
            <span className="stat-value">{data?.assignedEmployeeCount ?? 0}</span>
          </div>
          <div className="stat-icon" style={{ color: 'var(--primary)' }}>👥</div>
        </div>
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-label">Total Company Headcount</span>
            <span className="stat-value">{data?.totalEmployees ?? 0}</span>
          </div>
          <div className="stat-icon" style={{ color: 'var(--secondary)' }}>🌐</div>
        </div>
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-label">Pending Leave Requests</span>
            <span className="stat-value" style={{ color: (data?.pendingLeavesCount ?? 0) > 0 ? 'var(--warning)' : 'inherit' }}>
              {data?.pendingLeavesCount ?? 0}
            </span>
          </div>
          <div className="stat-icon" style={{ color: 'var(--warning)' }}>📝</div>
        </div>
        <div className="card stat-card">
          <div className="stat-info">
            <span className="stat-label">Portal Resource Credits</span>
            <span className="stat-value">🪙 {(data?.creditsBalance ?? 0).toLocaleString()}</span>
          </div>
          <div className="stat-icon" style={{ color: 'var(--success)' }}>🪙</div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* TASK ACTIVITY SECTION */}
      {/* ══════════════════════════════════════════════ */}
      <div className="task-section-header">
        <div>
          <h2 className="task-section-title">
            <ClipboardList size={20} className="task-icon-purple" />
            Task Assignment Activity
          </h2>
          <p className="task-section-sub">Live status updates from employees on their assigned tasks.</p>
        </div>
        <div className="task-section-actions">
          <button className="btn-icon-refresh" onClick={refreshTasks} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button className="btn-goto-tasks" onClick={() => navigate('/hr/tasks')}>
            Manage Tasks
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Task stat pills */}
      <div className="task-stat-pills">
        {[
          { label: 'Total Assigned', value: taskStats.total,     color: '#4f46e5' },
          { label: 'Pending',        value: taskStats.todo,      color: '#3b82f6' },
          { label: 'Accepted',       value: taskStats.accepted,  color: '#f97316' },
          { label: 'In Progress',    value: taskStats.progress,  color: '#8b5cf6' },
          { label: 'Completed',      value: taskStats.completed, color: '#10b981' },
          { label: 'Rejected',       value: taskStats.rejected,  color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="task-stat-pill" style={{ borderTopColor: s.color }}>
            <strong style={{ color: s.color }}>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Two-col layout: task list + activity feed */}
      <div className="task-two-col">

        {/* Left: Full Task List with filter */}
        <div className="task-list-card">
          <div className="tlc-header">
            <h3>All Assigned Tasks</h3>
            <select
              value={taskFilter}
              onChange={e => setTaskFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {tasks.length === 0 ? (
            <div className="tlc-empty">
              <ClipboardList size={36} className="tlc-empty-icon" />
              <p>No tasks assigned yet.</p>
              <button className="btn-goto-tasks-sm" onClick={() => navigate('/hr/tasks')}>
                + Assign First Task
              </button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="tlc-empty">
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No tasks match this filter.</p>
            </div>
          ) : (
            <div className="tlc-list">
              {filteredTasks.map(task => {
                const cfg = STATUS_CFG[task.status]
                const isOverdue = task.status !== 'COMPLETED' && task.status !== 'REJECTED'
                  && new Date(task.dueDate) < new Date()
                return (
                  <div key={task.id} className="tlc-row">
                    <div
                      className="tlc-dot"
                      style={{ background: cfg.dot }}
                    />
                    <div className="tlc-main">
                      <div className="tlc-top">
                        <span className="tlc-title">{task.title}</span>
                        <span
                          className="tlc-status-chip"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </div>
                      <div className="tlc-meta">
                        <span className="tlc-emp">
                          <Users size={11} />
                          {task.employeeName} · {task.employeeCode}
                        </span>
                        <span className="tlc-due" style={{ color: isOverdue ? '#ef4444' : '#94a3b8' }}>
                          <Clock size={11} />
                          Due {task.dueDate} {isOverdue ? '⚠ Overdue' : ''}
                        </span>
                        <span className="tlc-priority-badge" data-p={task.priority.toLowerCase()}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Recent Activity Feed + Quick Actions */}
        <div className="right-col">
          {/* Activity feed */}
          <div className="activity-card">
            <h3 className="ac-title">Recent Employee Responses</h3>
            {recentActivity.length === 0 ? (
              <div className="ac-empty">
                <p>No responses yet. Tasks appear here once employees interact with them.</p>
              </div>
            ) : (
              <div className="ac-list">
                {recentActivity.map(task => {
                  const cfg = STATUS_CFG[task.status]
                  const verbs: Record<string, string> = {
                    ACCEPTED:  'accepted the task',
                    PROGRESS:  'started working on',
                    COMPLETED: 'completed the task',
                    REJECTED:  'rejected the task',
                  }
                  return (
                    <div key={task.id} className="ac-item">
                      <div className="ac-avatar">
                        {task.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="ac-body">
                        <p className="ac-text">
                          <strong>{task.employeeName}</strong>{' '}
                          <span style={{ color: cfg.color }}>{verbs[task.status]}</span>
                        </p>
                        <p className="ac-task-name">📋 {task.title}</p>
                        <p className="ac-time">{task.assignedDate}</p>
                      </div>
                      <div
                        className="ac-status-dot"
                        style={{ background: cfg.dot }}
                        title={cfg.label}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Quick Actions</h3>
            <button className="btn-primary" style={{ width: '100%' }} onClick={() => navigate('/hr/tasks')}>
              <ClipboardList size={15} style={{ marginRight: 6 }} />
              Assign New Task
            </button>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/hr/employees/add')}>
              Onboard New Employee
            </button>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/hr/leaves')}>
              Approve Leave Requests
            </button>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/hr/attendance')}>
              Attendance Logs
            </button>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        .hr-dash-root { font-family: 'Inter', system-ui, sans-serif; }

        /* ── Task section header ── */
        .task-section-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin: 28px 0 14px; flex-wrap: wrap; gap: 12px;
        }
        .task-section-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0 0 4px;
        }
        .task-icon-purple { color: #7c3aed; }
        .task-section-sub { font-size: 0.85rem; color: #64748b; margin: 0; }
        .task-section-actions { display: flex; gap: 8px; align-items: center; }
        .btn-icon-refresh {
          background: white; border: 1px solid #e2e8f0;
          color: #64748b; border-radius: 8px; padding: 8px;
          cursor: pointer; display: flex; transition: all 0.2s;
        }
        .btn-icon-refresh:hover { border-color: #7c3aed; color: #7c3aed; background: #faf5ff; }
        .btn-goto-tasks {
          display: flex; align-items: center; gap: 6px;
          background: #7c3aed; color: white; border: none;
          padding: 9px 16px; border-radius: 8px;
          font-size: 0.82rem; font-weight: 700; cursor: pointer;
          box-shadow: 0 4px 12px rgba(124,58,237,0.25); transition: all 0.2s;
        }
        .btn-goto-tasks:hover { background: #6d28d9; transform: translateY(-1px); }

        /* ── Task stat pills row ── */
        .task-stat-pills {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          margin-bottom: 22px;
        }
        .task-stat-pill {
          background: white;
          border: 1px solid #f1f5f9;
          border-top: 3px solid transparent;
          border-radius: 10px;
          padding: 14px 16px;
          display: flex; flex-direction: column; gap: 3px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .task-stat-pill strong { font-size: 1.5rem; font-weight: 800; line-height: 1; }
        .task-stat-pill span   { font-size: 0.72rem; color: #64748b; font-weight: 600; }

        /* ── Two-col ── */
        .task-two-col {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
          align-items: start;
        }

        /* ── Task list card ── */
        .task-list-card {
          background: white; border: 1px solid #f1f5f9;
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .tlc-header {
          padding: 16px 20px; border-bottom: 1px solid #f1f5f9;
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px;
        }
        .tlc-header h3 { margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a; }
        .filter-select {
          padding: 7px 12px; border: 1px solid #e2e8f0;
          border-radius: 7px; font-size: 0.8rem; color: #334155;
          background: #f8fafc; outline: none; cursor: pointer;
        }
        .filter-select:focus { border-color: #7c3aed; }

        .tlc-empty {
          padding: 48px; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .tlc-empty-icon { color: #cbd5e1; }
        .tlc-empty p { color: #94a3b8; font-size: 0.88rem; margin: 0; }
        .btn-goto-tasks-sm {
          background: #7c3aed; color: white; border: none;
          padding: 8px 16px; border-radius: 7px;
          font-size: 0.8rem; font-weight: 700; cursor: pointer;
        }

        .tlc-list { display: flex; flex-direction: column; }

        .tlc-row {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 14px 20px;
          border-bottom: 1px solid #f8fafc;
          transition: background 0.15s;
        }
        .tlc-row:last-child { border-bottom: none; }
        .tlc-row:hover { background: #fafbff; }

        .tlc-dot {
          width: 10px; height: 10px; border-radius: 50%;
          flex-shrink: 0; margin-top: 5px;
        }
        .tlc-main { flex: 1; min-width: 0; }
        .tlc-top {
          display: flex; justify-content: space-between;
          align-items: flex-start; gap: 10px; margin-bottom: 6px;
        }
        .tlc-title {
          font-size: 0.88rem; font-weight: 700; color: #0f172a;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 300px;
        }
        .tlc-status-chip {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 9px; border-radius: 5px;
          font-size: 0.68rem; font-weight: 700;
          white-space: nowrap; flex-shrink: 0;
        }
        .tlc-meta {
          display: flex; align-items: center; gap: 12px;
          flex-wrap: wrap;
        }
        .tlc-emp, .tlc-due {
          display: flex; align-items: center; gap: 4px;
          font-size: 0.72rem; color: #94a3b8;
        }
        .tlc-priority-badge {
          font-size: 0.63rem; font-weight: 800;
          padding: 2px 6px; border-radius: 4px;
          text-transform: uppercase;
        }
        [data-p="low"]    { background: #f1f5f9; color: #475569; }
        [data-p="medium"] { background: #eff6ff; color: #1d4ed8; }
        [data-p="high"]   { background: #fff1f2; color: #be123c; }

        /* ── Right col ── */
        .right-col { display: flex; flex-direction: column; gap: 16px; }

        /* ── Activity card ── */
        .activity-card {
          background: white; border: 1px solid #f1f5f9;
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .ac-title {
          padding: 16px 18px; border-bottom: 1px solid #f1f5f9;
          font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;
        }
        .ac-empty {
          padding: 28px 18px; text-align: center;
        }
        .ac-empty p { font-size: 0.8rem; color: #94a3b8; margin: 0; line-height: 1.5; }
        .ac-list { display: flex; flex-direction: column; }
        .ac-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 18px; border-bottom: 1px solid #f8fafc;
          position: relative;
        }
        .ac-item:last-child { border-bottom: none; }
        .ac-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: #e0e7ff; color: #4f46e5;
          font-size: 0.7rem; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ac-body { flex: 1; min-width: 0; }
        .ac-text {
          font-size: 0.8rem; color: #334155;
          margin: 0 0 2px; line-height: 1.4;
        }
        .ac-task-name {
          font-size: 0.72rem; color: #64748b;
          margin: 0 0 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ac-time { font-size: 0.68rem; color: #94a3b8; margin: 0; }
        .ac-status-dot {
          width: 8px; height: 8px; border-radius: 50%;
          flex-shrink: 0; margin-top: 6px;
        }

        /* Responsive */
        @media (max-width: 900px) {
          .task-stat-pills { grid-template-columns: repeat(3, 1fr); }
          .task-two-col { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .task-stat-pills { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  )
}
