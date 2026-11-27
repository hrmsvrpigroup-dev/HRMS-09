import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  History,
  Bell,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Users,
  Clock,
  CalendarCheck,
  UserCheck,
  CalendarDays,
  FileBarChart2,
  ClipboardCheck,
  Briefcase,
  CheckSquare,
  GraduationCap,
  Banknote,
  FileText,
  Wallet,
  UserCircle,
  Building2,
  Settings,
  ShieldCheck,
  LogOut,
  Sparkles,
} from 'lucide-react'

import { useAuthStore } from '../../store/auth.store'
import { leaveApi } from '../../api/leave.api'

type NavItem = {
  to: string
  label: string
}

const getNavIcon = (to: string, label: string) => {
  const key = `${to} ${label}`.toLowerCase()
  if (key.includes('dashboard') || to === '/hr' || to === '/admin' || to === '/superadmin') return <LayoutDashboard size={17} />
  if (key.includes('shift')) return <Clock size={17} />
  if (key.includes('manual')) return <UserCheck size={17} />
  if (key.includes('attendance')) return <CalendarCheck size={17} />
  if (key.includes('calendar')) return <CalendarDays size={17} />
  if (key.includes('monthly') || key.includes('report') || key.includes('analytics')) return <FileBarChart2 size={17} />
  if (key.includes('leave')) return <ClipboardCheck size={17} />
  if (key.includes('recruit')) return <Briefcase size={17} />
  if (key.includes('task')) return <CheckSquare size={17} />
  if (key.includes('train')) return <GraduationCap size={17} />
  if (key.includes('salary') || key.includes('payroll')) return <Banknote size={17} />
  if (key.includes('document')) return <FileText size={17} />
  if (key.includes('wallet') || key.includes('credit')) return <Wallet size={17} />
  if (key.includes('profile')) return <UserCircle size={17} />
  if (key.includes('compan') || key.includes('department')) return <Building2 size={17} />
  if (key.includes('setting')) return <Settings size={17} />
  if (key.includes('employee') || key.includes('hr')) return <Users size={17} />
  return <ShieldCheck size={17} />
}

type Props = {
  title: string
  navItems: NavItem[]
}

export default function AppShell({ title, navItems }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : 'U'

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('hrms_sidebar_open')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev
      try {
        localStorage.setItem('hrms_sidebar_open', String(next))
      } catch { }
      return next
    })
  }
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null)

  const [notifications, setNotifications] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])

  const unreadNotifCount = notifications.filter(n => !n.read).length
  const unreadMsgCount = messages.filter(m => m.unread).length

  const [serverLeaveNotifs, setServerLeaveNotifs] = useState<any[]>([])

  const isLoginOrLogoutNotif = (text: string) => {
    const t = text.toLowerCase()
    return t.includes('clocked in') || t.includes('clocked out') || t.includes('logged in') || t.includes('logged out') || t.includes('login') || t.includes('logout')
  }

  const getReadSet = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem('hrms_hr_notif_read_ids') || '[]')) } catch { return new Set() }
  }
  const getClearedSet = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem('hrms_hr_notif_cleared_ids') || '[]')) } catch { return new Set() }
  }

  // Load notifications from localStorage + all-employee leave requests from backend
  const loadNotifications = (overrideServerLeaves?: any[]) => {
    try {
      const readIds = getReadSet()
      const clearedIds = getClearedSet()
      const raw = localStorage.getItem('hrms_hr_notifications')
      let localNotifs: any[] = raw ? JSON.parse(raw) : []

      if (user?.role === 'SUPER_ADMIN') {
        localNotifs = localNotifs.filter((n: any) => {
          const text = String(n.text || '').toLowerCase()
          return text.includes('credit') || text.includes('paid') || text.includes('payment')
        })
        setNotifications(localNotifs)
        return
      }

      // Exclude login/logout/clock-in/clock-out notifications; keep emergency & leave requests
      localNotifs = localNotifs.filter((n: any) => !isLoginOrLogoutNotif(String(n.text || '')))

      const leaveSource = overrideServerLeaves ?? serverLeaveNotifs
      const mappedLeaves = leaveSource
        .filter((l: any) => !clearedIds.has(`leave-${l.id}`))
        .map((l: any) => {
          const empName = l.employee ? `${l.employee.firstName || ''} ${l.employee.lastName || ''}`.trim() : 'Employee'
          const isEmergency = l.type === 'SICK'
          const typeLabel = isEmergency ? 'Emergency / Sick Leave' : l.type === 'CASUAL' ? 'Casual Leave' : l.type === 'MATERNITY' ? 'Maternity Leave' : l.type
          const fromStr = new Date(l.fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          const toStr = new Date(l.toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          const dateRange = fromStr === toStr ? fromStr : `${fromStr} - ${toStr}`
          const id = `leave-${l.id}`
          return {
            id,
            text: `${isEmergency ? '🚨 Emergency Leave' : 'Leave Request'} (${typeLabel}): ${empName} (${dateRange}) — ${l.reason}`,
            time: new Date(l.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            read: readIds.has(id),
            createdAt: l.createdAt,
            details: {
              employeeName: empName,
              action: `${typeLabel} Request (${l.days} day${l.days > 1 ? 's' : ''})`,
              timestamp: l.createdAt,
              changes: [
                `Employee: ${empName}${l.employee?.employeeCode ? ` (${l.employee.employeeCode})` : ''}`,
                `Leave Type: ${typeLabel}`,
                `Dates: ${dateRange}`,
                `Reason: ${l.reason}`,
                `Status: ${l.status}`,
              ],
            },
          }
        })

      // Avoid duplicating localStorage leave notif if same employee+reason already came from server
      const serverLeaveTexts = new Set(mappedLeaves.map((m) => m.text.toLowerCase()))
      const filteredLocal = localNotifs.filter((n: any) => {
        const t = String(n.text || '').toLowerCase()
        if (t.includes('applied for leave') && serverLeaveTexts.size > 0) return false
        return !clearedIds.has(n.id)
      })

      const combined = [...mappedLeaves, ...filteredLocal].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )
      setNotifications(combined)
    } catch (e) {
      console.error(e)
    }
  }

  const handleMarkAllNotificationsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    try {
      const readIds = getReadSet()
      updated.forEach(n => readIds.add(n.id))
      localStorage.setItem('hrms_hr_notif_read_ids', JSON.stringify(Array.from(readIds)))

      const raw = localStorage.getItem('hrms_hr_notifications')
      if (raw) {
        let allNotifs = JSON.parse(raw)
        const updatedIds = new Set(updated.map(n => n.id))
        allNotifs = allNotifs.map((n: any) => updatedIds.has(n.id) ? { ...n, read: true } : n)
        localStorage.setItem('hrms_hr_notifications', JSON.stringify(allNotifs))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleClearAllNotifications = () => {
    const currentIds = notifications.map(n => n.id)
    setNotifications([])
    try {
      const clearedIds = getClearedSet()
      currentIds.forEach(id => clearedIds.add(id))
      localStorage.setItem('hrms_hr_notif_cleared_ids', JSON.stringify(Array.from(clearedIds)))

      const raw = localStorage.getItem('hrms_hr_notifications')
      if (raw) {
        let allNotifs = JSON.parse(raw)
        const idSet = new Set(currentIds)
        allNotifs = allNotifs.filter((n: any) => !idSet.has(n.id))
        localStorage.setItem('hrms_hr_notifications', JSON.stringify(allNotifs))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleMarkAllMessagesRead = () => {
    setMessages(messages.map(m => ({ ...m, unread: false })))
  }

  // Load and listen to storage + poll all-employee leave requests for HR/ADMIN
  useEffect(() => {
    loadNotifications()
    const onStorage = () => loadNotifications()
    window.addEventListener('storage', onStorage)
    const interval = setInterval(() => loadNotifications(), 3000)

    let leaveInterval: ReturnType<typeof setInterval> | undefined
    if (user?.role === 'HR' || user?.role === 'ADMIN') {
      const fetchServerLeaves = () => {
        leaveApi.getNotifications()
          .then((res) => {
            const list = res.data?.data || []
            setServerLeaveNotifs(list)
            loadNotifications(list)
          })
          .catch(() => { })
      }
      fetchServerLeaves()
      leaveInterval = setInterval(fetchServerLeaves, 20000)
    }

    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(interval)
      if (leaveInterval) clearInterval(leaveInterval)
    }
  }, [user?.role])

  // Close dropdowns on outside clicks
  useEffect(() => {
    const closeAll = () => {
      setShowNotifications(false)
      setShowMessages(false)
      setShowProfileMenu(false)
    }
    window.addEventListener('click', closeAll)
    return () => window.removeEventListener('click', closeAll)
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <div className={`app-shell ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button
          className={`mobile-hamburger ${isMobileMenuOpen ? 'active' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className="mobile-logo">{title}</div>
        <div style={{ width: '40px' }}></div> {/* Spacer for centering */}
      </div>

      {/* Mobile Overlay */}
      <div
        className={`mobile-overlay ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={closeMobileMenu}
      ></div>

      {/* Premium Sidebar Scoped Overrides */}
      <style>{`
        .app-shell .sidebar {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
          border-right: 1px solid #e2e8f0 !important;
          box-shadow: 4px 0 24px rgba(15, 23, 42, 0.04) !important;
        }
        .app-shell .sidebar-logo {
          padding: 18px 16px 14px !important;
          border-bottom: 1px solid #f1f5f9 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
        }
        .app-shell .sidebar-brand-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .app-shell .sidebar-brand-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 14px -3px rgba(79, 70, 229, 0.4);
          flex-shrink: 0;
        }
        .app-shell .sidebar-brand-title {
          font-size: 1.02rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .app-shell .sidebar-brand-sub {
          font-size: 0.68rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .app-shell .sidebar nav {
          padding: 12px 12px 16px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .app-shell .sidebar nav::-webkit-scrollbar {
          width: 4px;
        }
        .app-shell .sidebar nav::-webkit-scrollbar-track {
          background: transparent;
        }
        .app-shell .sidebar nav::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .app-shell .sidebar nav a {
          display: flex !important;
          align-items: center !important;
          gap: 11px !important;
          padding: 9px 12px !important;
          border-radius: 11px !important;
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          color: #475569 !important;
          border: 1px solid transparent !important;
          transition: all 0.16s ease !important;
          position: relative;
          text-decoration: none !important;
        }
        .app-shell .sidebar nav a .nav-icon-box {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.16s ease;
          flex-shrink: 0;
        }
        .app-shell .sidebar nav a:hover:not(.active) {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          transform: translateX(2px);
        }
        .app-shell .sidebar nav a:hover:not(.active) .nav-icon-box {
          background: #e2e8f0;
          color: #334155;
        }
        .app-shell .sidebar nav a.active {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 8px 18px -5px rgba(79, 70, 229, 0.45) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
        }
        .app-shell .sidebar nav a.active .nav-icon-box {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }
        .app-shell .sidebar-footer {
          padding: 12px !important;
          border-top: 1px solid #e2e8f0 !important;
          background: #ffffff !important;
        }
        .app-shell .sidebar-profile {
          padding: 9px 10px !important;
          border-radius: 12px !important;
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          margin-bottom: 8px !important;
          transition: all 0.15s ease;
        }
        .app-shell .sidebar-profile:hover {
          border-color: #c7d2fe !important;
          background: #eef2ff !important;
        }
        .app-shell .sidebar-avatar {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
          color: #ffffff !important;
          font-weight: 800 !important;
        }
        .app-shell .logout-btn {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          border-radius: 10px !important;
          font-weight: 700 !important;
          border: 1px solid #fecaca !important;
          background: #fef2f2 !important;
          color: #dc2626 !important;
          transition: all 0.15s ease !important;
        }
        .app-shell .logout-btn:hover {
          background: #fee2e2 !important;
          border-color: #fca5a5 !important;
        }
      `}</style>

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-brand-wrap">
            <div className="sidebar-brand-icon">
              <Sparkles size={17} />
            </div>
            <div>
              <div className="sidebar-brand-title">{title}</div>
              <div className="sidebar-brand-sub">Workspace</div>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={toggleSidebar}
            title="Close Nav Bar"
            aria-label="Close Nav Bar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
              end
            >
              <span className="nav-icon-box">{getNavIcon(item.to, item.label)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div
            className="sidebar-profile"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(title === 'HR' ? '/hr/profile' : title === 'Employee' ? '/employee/profile' : '')}
            title="View Profile"
          >
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="sidebar-user-role">{user?.role?.replace('_', ' ')}</span>
            </div>
          </div>
          <button
            className="logout-btn"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <main className="content" style={{ position: 'relative' }}>
        {/* Floating Quick Open Button when sidebar is collapsed */}
        {!isSidebarOpen && (
          <button
            type="button"
            className="floating-nav-open-btn"
            onClick={toggleSidebar}
            title="Open Navigation Bar"
            aria-label="Open Navigation Bar"
          >
            <PanelLeftOpen size={18} />
            <span>Open Nav</span>
          </button>
        )}

        {/* Desktop Topbar */}
        <div className="shell-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className={`nav-toggle-btn ${!isSidebarOpen ? 'nav-collapsed-btn' : ''}`}
              onClick={toggleSidebar}
              title={isSidebarOpen ? "Close Nav Bar" : "Open Nav Bar"}
              aria-label={isSidebarOpen ? "Close Nav Bar" : "Open Nav Bar"}
            >
              {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              <span>{isSidebarOpen ? "Close Nav" : "Open Nav Bar"}</span>
            </button>
          </div>
          <div className="topbar-right">
            {/* History Shortcut */}
            <button className="icon-btn" onClick={() => navigate(title === 'HR' ? '/hr/attendance' : title === 'Admin' ? '/admin/employees' : '/superadmin')} title="History / Logs">
              <History size={20} />
            </button>

            {/* Notifications Bell */}
            <div className="dropdown-container" onClick={(e) => e.stopPropagation()}>
              <button
                className={`icon-btn ${unreadNotifCount > 0 ? 'has-badge' : ''}`}
                onClick={() => {
                  setShowNotifications(!showNotifications)
                  setShowMessages(false)
                }}
              >
                <Bell size={20} />
                {unreadNotifCount > 0 && <span className="badge red-badge">{unreadNotifCount}</span>}
              </button>

              {showNotifications && (
                <div className="topbar-dropdown-tray">
                  <div className="tray-header">
                    <h4>Notifications</h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {unreadNotifCount > 0 && (
                        <button onClick={handleMarkAllNotificationsRead}>Mark all read</button>
                      )}
                      {notifications.length > 0 && (
                        <button className="clear-btn" onClick={handleClearAllNotifications}>Clear all</button>
                      )}
                    </div>
                  </div>
                  <div className="tray-list">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`tray-item ${!n.read ? 'unread' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            // Mark as read
                            const updated = notifications.map(notif => notif.id === n.id ? { ...notif, read: true } : notif)
                            setNotifications(updated)
                            try {
                              const readIds = getReadSet()
                              readIds.add(n.id)
                              localStorage.setItem('hrms_hr_notif_read_ids', JSON.stringify(Array.from(readIds)))
                              const raw = localStorage.getItem('hrms_hr_notifications')
                              if (raw) {
                                const parsed = JSON.parse(raw).map((notif: any) => notif.id === n.id ? { ...notif, read: true } : notif)
                                localStorage.setItem('hrms_hr_notifications', JSON.stringify(parsed))
                              }
                            } catch { }
                            // Open details modal
                            setSelectedNotif(n)
                            setShowNotifications(false)
                          }}
                        >
                          <div className="tray-dot"></div>
                          <div className="tray-item-content">
                            <p>{n.text}</p>
                            <span>{n.time}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
                        No new notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>


            {/* User Profile */}
            <div className="dropdown-container" onClick={(e) => e.stopPropagation()} style={{ marginLeft: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingLeft: '16px',
                borderLeft: '1px solid rgba(0,0,0,0.1)',
                cursor: 'pointer'
              }} onClick={() => {
                setShowProfileMenu(!showProfileMenu)
                setShowNotifications(false)
                setShowMessages(false)
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#4f46e5',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}>
                  {initials}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{user?.firstName} {user?.lastName}</span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user?.role?.replace('_', ' ')}</span>
                </div>
              </div>

              {showProfileMenu && (
                <div className="topbar-dropdown-tray" style={{ width: '200px' }}>
                  <div className="tray-list">
                    <div
                      className="tray-item"
                      style={{ cursor: 'pointer', padding: '12px 16px' }}
                      onClick={() => {
                        setShowProfileMenu(false)
                        navigate(title === 'HR' ? '/hr/profile' : title === 'Employee' ? '/employee/profile' : title === 'Admin' ? '/admin/settings' : '/superadmin/settings')
                      }}
                    >
                      <div className="tray-item-content">
                        <strong>My Profile</strong>
                      </div>
                    </div>
                    <div
                      className="tray-item"
                      style={{ cursor: 'pointer', padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}
                      onClick={() => {
                        setShowProfileMenu(false)
                        navigate(title === 'Admin' ? '/admin/settings' : title === 'HR' ? '/hr/settings' : '/employee/settings')
                      }}
                    >
                      <div className="tray-item-content">
                        <strong>Settings</strong>
                      </div>
                    </div>
                    <div
                      className="tray-item"
                      style={{ cursor: 'pointer', padding: '12px 16px', borderTop: '1px solid #f1f5f9', color: '#ef4444' }}
                      onClick={() => {
                        logout()
                        navigate('/login')
                      }}
                    >
                      <div className="tray-item-content">
                        <strong style={{ color: '#ef4444' }}>Logout</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Outlet />

        {/* Notification details modal */}
        {selectedNotif && (
          <div className="notif-details-overlay" onClick={() => setSelectedNotif(null)}>
            <div className="notif-details-modal" onClick={e => e.stopPropagation()}>
              <div className="notif-details-header">
                <h3>Notification Audit Details</h3>
                <button className="notif-close-btn" onClick={() => setSelectedNotif(null)}>&times;</button>
              </div>
              <div className="notif-details-body">
                <div className="notif-meta-row">
                  <strong>Activity:</strong> <span>{selectedNotif.details?.action || 'Employee Event'}</span>
                </div>
                <div className="notif-meta-row">
                  <strong>Actor:</strong> <span>{selectedNotif.details?.employeeName || 'System'}</span>
                </div>
                <div className="notif-meta-row">
                  <strong>Recorded:</strong> <span>{selectedNotif.details?.timestamp ? new Date(selectedNotif.details.timestamp).toLocaleString('en-IN') : 'Just now'}</span>
                </div>

                <div className="notif-changes-box">
                  <h4>System Logs / Exact Changes:</h4>
                  {selectedNotif.details?.changes && selectedNotif.details.changes.length > 0 ? (
                    <ul>
                      {selectedNotif.details.changes.map((change: string, idx: number) => (
                        <li key={idx} className="notif-change-item">✓ {change}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                      {selectedNotif.text}
                    </p>
                  )}
                </div>
              </div>
              <div className="notif-details-footer">
                <button className="notif-close-action-btn" onClick={() => setSelectedNotif(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          .shell-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
            position: relative;
            z-index: 100;
          }

          .topbar-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .nav-toggle-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            border-radius: 100px;
            border: 1px solid rgba(226, 232, 240, 0.9);
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(8px);
            color: #475569;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .nav-toggle-btn:hover {
            color: #2563eb;
            background: #ffffff;
            border-color: #93c5fd;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.12);
            transform: translateY(-1px);
          }

          .nav-toggle-btn.nav-collapsed-btn {
            background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
            color: #ffffff;
            border-color: transparent;
            box-shadow: 0 4px 15px rgba(37, 99, 235, 0.25);
          }

          .nav-toggle-btn.nav-collapsed-btn:hover {
            background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%);
            box-shadow: 0 6px 18px rgba(37, 99, 235, 0.35);
          }

          .sidebar-close-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            border: 1px solid rgba(226, 232, 240, 0.9);
            background: rgba(255, 255, 255, 0.8);
            color: #64748b;
            -webkit-text-fill-color: initial !important;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .sidebar-close-btn:hover {
            background: #ffffff;
            color: #2563eb;
            border-color: #cbd5e1;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            transform: scale(1.06);
          }

          .floating-nav-open-btn {
            position: fixed;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            z-index: 990;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 10px 14px 10px 10px;
            background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
            color: #ffffff;
            border: none;
            border-radius: 0 12px 12px 0;
            box-shadow: 0 4px 20px rgba(37, 99, 235, 0.35);
            font-size: 0.82rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .floating-nav-open-btn:hover {
            padding-left: 14px;
            background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%);
            box-shadow: 0 6px 24px rgba(37, 99, 235, 0.5);
          }

          .topbar-right {
            display: flex;
            align-items: center;
            gap: 16px;
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(8px);
            padding: 8px 16px;
            border-radius: 100px;
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 4px 15px -3px rgba(0, 0, 0, 0.05);
          }

          .icon-btn {
            background: none;
            border: none;
            color: #475569;
            cursor: pointer;
            position: relative;
            padding: 6px;
            display: flex;
            align-items: center;
            transition: color 0.2s;
          }
          
          .icon-btn:hover { color: #0f172a; }

          .has-badge { position: relative; }

          .badge {
            position: absolute;
            top: -2px;
            right: -2px;
            font-size: 0.65rem;
            font-weight: 800;
            color: white;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            border: 2px solid #ffffff;
          }

          .red-badge { background-color: #ef4444; }
          .blue-badge { background-color: #3b82f6; }

          .dropdown-container {
            position: relative;
          }

          .topbar-dropdown-tray {
            position: absolute;
            top: calc(100% + 8px);
            right: -10px;
            width: 300px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
            overflow: hidden;
            z-index: 200;
            animation: dropFade 0.2s ease-out;
          }

          @keyframes dropFade {
            from { transform: translateY(8px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }

          .tray-header {
            padding: 10px 14px;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .tray-header h4 { margin: 0; font-size: 0.85rem; font-weight: 800; color: #0f172a; }
          .tray-header button { background: none; border: none; color: #3b82f6; font-size: 0.72rem; font-weight: 700; cursor: pointer; }
          .tray-header button:hover { text-decoration: underline; }
          .tray-header button.clear-btn { color: #ef4444; }
          .tray-header button.clear-btn:hover { color: #dc2626; text-decoration: underline; }

          .tray-list { max-height: 240px; overflow-y: auto; }

          .tray-item {
            display: flex;
            gap: 10px;
            padding: 10px 14px;
            border-bottom: 1px solid #f8fafc;
            transition: background 0.2s;
          }

          .tray-item:last-child { border-bottom: none; }
          .tray-item:hover { background: #f8fafc; }
          .tray-item.unread { background: #eff6ff; }

          .tray-dot { width: 6px; height: 6px; border-radius: 50%; background: transparent; flex-shrink: 0; margin-top: 6px; }
          .tray-item.unread .tray-dot { background: #ef4444; }
          .tray-item.unread .tray-dot.blue { background: #3b82f6; }

          .tray-item-content { display: flex; flex-direction: column; gap: 2px; }
          .tray-item-content p { margin: 0; font-size: 0.75rem; color: #475569; line-height: 1.4; }
          .tray-item-content span { font-size: 0.68rem; color: #94a3b8; font-weight: 500; }

          .notif-details-overlay {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .notif-details-modal {
            background: white;
            border-radius: 12px;
            width: 100%;
            max-width: 480px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
            overflow: hidden;
            animation: modalSlide 0.25s ease-out;
            border: 1px solid #e2e8f0;
          }

          .notif-details-header {
            padding: 16px 20px;
            border-bottom: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .notif-details-header h3 {
            margin: 0;
            font-size: 1rem;
            font-weight: 800;
            color: #0f172a;
          }

          .notif-close-btn {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 1.5rem;
            cursor: pointer;
            line-height: 1;
            padding: 0;
          }

          .notif-close-btn:hover {
            color: #0f172a;
          }

          .notif-details-body {
            padding: 20px;
          }

          .notif-meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 0.85rem;
            margin-bottom: 10px;
            color: #334155;
            border-bottom: 1px dashed #f1f5f9;
            padding-bottom: 6px;
          }

          .notif-meta-row strong {
            color: #475569;
          }

          .notif-changes-box {
            margin-top: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
          }

          .notif-changes-box h4 {
            margin: 0 0 10px 0;
            font-size: 0.82rem;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .notif-changes-box ul {
            margin: 0;
            padding: 0;
            list-style: none;
          }

          .notif-change-item {
            font-size: 0.8rem;
            color: #0f172a;
            margin-bottom: 6px;
            line-height: 1.4;
          }

          .notif-change-item:last-child {
            margin-bottom: 0;
          }

          .notif-details-footer {
            padding: 12px 20px;
            border-top: 1px solid #f1f5f9;
            display: flex;
            justify-content: flex-end;
          }

          .notif-close-action-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 0.82rem;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
          }

          .notif-close-action-btn:hover {
            background: #2563eb;
          }

          @media (max-width: 900px) {
            .shell-topbar {
              display: none;
            }
            .sidebar-close-btn {
              display: none;
            }
            .floating-nav-open-btn {
              display: none !important;
            }
          }
        `}</style>
      </main>
    </div>
  )
}


