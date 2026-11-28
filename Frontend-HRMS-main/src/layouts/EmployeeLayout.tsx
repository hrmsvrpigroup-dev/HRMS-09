import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { useEmployeeMonitor } from '../hooks/useEmployeeMonitor'
import { alertApi, EmployeeActiveAlertItem } from '../api/alert.api'
import {
  Menu, Search, History, Bell, Mail, Home, Calendar, Edit3,
  Clock, FileText, FileBadge, CheckSquare, FilePlus, User, Settings,
  Headphones, Building2, X, ChevronRight, MessageSquare, Check, HelpCircle, LogOut
} from 'lucide-react'

export default function EmployeeLayout() {
  const { isMonitoring, monitorError, startMonitoring } = useEmployeeMonitor()
  const logout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const location = useLocation()

  // State controls
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [ticketCategory, setTicketCategory] = useState('PAYROLL')
  const [ticketDesc, setTicketDesc] = useState('')
  const [ticketSuccess, setTicketSuccess] = useState(false)

  // Notifications State (No dummy data)
  const [notifications, setNotifications] = useState<any[]>([])

  // Messages State (No dummy data)
  const [messages, setMessages] = useState<any[]>([])
  const [activePopupAlerts, setActivePopupAlerts] = useState<EmployeeActiveAlertItem[]>([])
  const [confirmAckAlertId, setConfirmAckAlertId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchPopupAlerts = () => {
      alertApi.getMyActive()
        .then((res) => {
          if (mounted) setActivePopupAlerts(res.data?.data || [])
        })
        .catch(() => {})
    }
    fetchPopupAlerts()
    const timer = setInterval(fetchPopupAlerts, 30000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [user?.id])

  const handleAcknowledgePopup = async (alertId: string) => {
    setConfirmAckAlertId(null)
    setActivePopupAlerts((prev) => prev.filter((a) => a.id !== alertId))
    await alertApi.acknowledge(alertId).catch(() => {})
  }

  const searchPages = [
    { label: 'Dashboard', to: '/employee' },
    { label: 'My Attendance Calendar', to: '/employee/attendance' },
    { label: 'Company Holidays & Calendar', to: '/employee/calendar' },
    { label: 'Apply Leave Request', to: '/employee/leave' },
    { label: 'Attendance History Table', to: '/employee/history' },
    { label: 'Download Payslips', to: '/employee/payslips' },
    { label: 'My Onboarding Documents', to: '/employee/documents' },
    { label: 'My Tasks Board', to: '/employee/tasks' },
    { label: 'My Operational Requests', to: '/employee/requests' },
    { label: 'My Profile Details', to: '/employee/profile' },
    { label: 'Account Settings & Password', to: '/employee/settings' }
  ]

  const navItems = [
    { to: '/employee', label: 'Dashboard', icon: Home, end: true },
    { to: '/employee/attendance', label: 'My Attendance', icon: Calendar },
    { to: '/employee/calendar', label: 'Calendar', icon: Calendar },
    { to: '/employee/leave', label: 'Apply Leave', icon: Edit3 },
    { to: '/employee/history', label: 'Attendance History', icon: Clock },
    { to: '/employee/payslips', label: 'Payslips', icon: FileText },
    { to: '/employee/documents', label: 'My Documents', icon: FileBadge },
    { to: '/employee/tasks', label: 'My Tasks', icon: CheckSquare },
    { to: '/employee/requests', label: 'My Requests', icon: FilePlus },
    { to: '/employee/profile', label: 'Profile', icon: User },
    { to: '/employee/settings', label: 'Settings', icon: Settings },
  ]

  const unreadNotifCount = notifications.filter(n => !n.read).length
  const unreadMsgCount = messages.filter(m => m.unread).length

  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : 'RP'
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Rakesh Prasad'
  const emailVal = user?.email || 'rakesh.prasad@company.com'
  const idVal = user?.id ? `EMP-${user.id.slice(0, 4).toUpperCase()}` : 'EMP-1001'
  const usernameVal = user ? `${user.firstName.toLowerCase()}.${user.lastName.toLowerCase()}` : 'rakesh.prasad'
  const roleName = user?.role?.replace('_', ' ') || 'Employee'

  const filteredSearch = searchQuery.trim()
    ? searchPages.filter(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  const handleMarkAllNotificationsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const handleMarkAllMessagesRead = () => {
    setMessages(messages.map(m => ({ ...m, unread: false })))
  }

  const handleHelpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticketDesc.trim()) return
    setTicketSuccess(true)
    setTicketDesc('')
    setTimeout(() => {
      setTicketSuccess(false)
      setShowHelpModal(false)
    }, 2000)
  }

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

  // Close mobile menu on route changes
  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className={`emp-layout-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Optional Screen Monitoring Banners */}
      {monitorError && (
        <div className="monitor-banner error">
          <span>⚠️ {monitorError}</span>
          <button onClick={startMonitoring}>Grant Screen Permission</button>
        </div>
      )}
      {isMonitoring && (
        <div className="monitor-banner success">
          🟢 Shift Active: Live Screen & Cursor Monitoring In Progress
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="emp-topbar">
        <div className="emp-logo-area" onClick={() => navigate('/employee')} style={{ cursor: 'pointer', gap: '10px', background: 'transparent' }}>
          <img
            src="/vrpi-logo.png?v=2"
            alt="VR Pi"
            style={{
              height: '32px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              flexShrink: 0,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span className="logo-text" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>HRMS Platform</span>
            <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Employee Portal</span>
          </div>
        </div>
        <div className="emp-topbar-content">
          <div className="topbar-left">
            <button className="menu-btn" onClick={(e) => {
              e.stopPropagation()
              if (window.innerWidth <= 900) {
                setIsMobileOpen(!isMobileOpen)
              } else {
                setSidebarCollapsed(!sidebarCollapsed)
              }
            }}>
              <Menu size={20} />
            </button>

            {/* Search Input with Dynamic Filtering */}
            <div className="search-bar" onClick={(e) => e.stopPropagation()}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search portal sections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {filteredSearch.length > 0 && (
                <div className="search-dropdown-overlay">
                  {filteredSearch.map(item => (
                    <button
                      key={item.to}
                      className="search-result-item"
                      onClick={() => {
                        navigate(item.to)
                        setSearchQuery('')
                      }}
                    >
                      <ChevronRight size={14} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="topbar-right">
            {/* History Shortcut */}
            <button className="icon-btn" onClick={() => navigate('/employee/history')} title="Attendance History">
              <History size={20} />
            </button>

            {/* Notifications Bell */}
            <div className="dropdown-container" onClick={(e) => e.stopPropagation()}>
              <button
                className={`icon-btn ${unreadNotifCount > 0 ? 'has-badge' : ''}`}
                onClick={() => {
                  setShowNotifications(!showNotifications)
                  setShowMessages(false)
                  setShowProfileMenu(false)
                }}
              >
                <Bell size={20} />
                {unreadNotifCount > 0 && <span className="badge red-badge">{unreadNotifCount}</span>}
              </button>

              {showNotifications && (
                <div className="topbar-dropdown-tray">
                  <div className="tray-header">
                    <h4>Notifications</h4>
                    {unreadNotifCount > 0 && (
                      <button onClick={handleMarkAllNotificationsRead}>Mark all read</button>
                    )}
                  </div>
                  <div className="tray-list">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div key={n.id} className={`tray-item ${!n.read ? 'unread' : ''}`}>
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



            {/* User Dropdown */}
            <div className="dropdown-container" onClick={(e) => e.stopPropagation()}>
              <div
                className="topbar-profile"
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu)
                  setShowNotifications(false)
                  setShowMessages(false)
                }}
              >
                <img src={`https://ui-avatars.com/api/?name=${fullName}&background=3b82f6&color=fff`} alt="User" className="topbar-avatar" />
                <div className="topbar-user-info">
                  <span className="topbar-name">{fullName}</span>
                  <span className="topbar-role">{roleName}</span>
                </div>
              </div>

              {showProfileMenu && (
                <div className="profile-dropdown-tray">
                  <button onClick={() => navigate('/employee/profile')}>
                    <User size={16} />
                    <span>My Profile</span>
                  </button>
                  <button onClick={() => navigate('/employee/settings')}>
                    <Settings size={16} />
                    <span>Account Settings</span>
                  </button>
                  <div className="tray-divider"></div>
                  <button className="logout" onClick={() => { logout(); navigate('/login'); }}>
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Overlay */}
      <div
        className={`emp-mobile-overlay ${isMobileOpen ? 'active' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      ></div>

      <div className="emp-main-container">
        {/* Left Sidebar */}
        <aside className="emp-sidebar">
          <div className="sidebar-section-title">Employee</div>
          <nav className="emp-nav">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `emp-nav-item ${isActive ? 'active' : ''}`}
                  title={sidebarCollapsed ? item.label : ''}
                >
                  <span className="emp-nav-icon-box">
                    <Icon size={17} className="nav-icon" />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-profile-card">
              <div className="profile-card-top" style={{ cursor: 'pointer' }} onClick={() => navigate('/employee/profile')}>
                <div className="profile-initials">{initials}</div>
                <div className="profile-details">
                  <span className="profile-card-name">@{usernameVal}</span>
                  <span className="profile-card-id">{idVal}</span>
                </div>
              </div>
              <button className="btn-logout" onClick={() => { logout(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>

            <div className="sidebar-help" onClick={() => setShowHelpModal(true)}>
              <div className="help-icon"><Headphones size={20} /></div>
              <div className="help-text">
                <span className="help-title">Need Help?</span>
                <span className="help-subtitle">Contact HR Support</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="emp-content-area">
          <Outlet />
        </main>
      </div>

      {/* HR Portal Popup Alert Modal (Pilot Test / HR Broadcast) */}
      {activePopupAlerts.length > 0 && (() => {
        const current = activePopupAlerts[0]
        const accentMap: Record<string, { bar: string; badgeBg: string; badgeText: string; label: string }> = {
          URGENT: { bar: '#dc2626', badgeBg: '#fef2f2', badgeText: '#b91c1c', label: 'Emergency Alert' },
          WARNING: { bar: '#d97706', badgeBg: '#fffbeb', badgeText: '#b45309', label: 'Important Notice' },
          IMPORTANT: { bar: '#4f46e5', badgeBg: '#eef2ff', badgeText: '#4338ca', label: 'HR Announcement' },
          INFO: { bar: '#0284c7', badgeBg: '#f0f9ff', badgeText: '#0369a1', label: 'Information' },
        }
        const catMap: Record<string, string> = {
          HOLIDAY: 'Holiday Notice',
          IMPORTANT_NEWS: 'Important News',
          URGENT_ALERT: 'Urgent Alert',
          GENERAL: 'General Notice',
        }
        const style = accentMap[current.priority] || accentMap.IMPORTANT

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="HR Alert Message"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.62)',
              backdropFilter: 'blur(4px)',
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div style={{
              background: '#ffffff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 480,
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(15, 23, 42, 0.3)',
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ height: 6, background: style.bar }} />
              <div style={{ padding: '22px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, background: style.badgeBg, color: style.badgeText, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {catMap[current.category] || style.label}
                    </span>
                    {activePopupAlerts.length > 1 && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>
                        1 of {activePopupAlerts.length}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                    {new Date(current.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 8px', fontSize: 18.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                  {current.title}
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: 13.5, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {current.message}
                </p>

                {confirmAckAlertId === current.id ? (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400e', lineHeight: 1.45 }}>
                      ⚠️ Please read this notice carefully once again before closing. Once acknowledged, this popup will not appear again.
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setConfirmAckAlertId(null)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Read Again
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcknowledgePopup(current.id)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: style.bar,
                          color: '#ffffff',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Confirm &amp; Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      From: {current.createdByName || 'HR Team'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmAckAlertId(current.id)}
                      style={{
                        padding: '9px 18px',
                        borderRadius: 10,
                        border: 'none',
                        background: style.bar,
                        color: '#ffffff',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Acknowledge &amp; Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Help Ticket Modal */}
      {showHelpModal && (
        <div className="modal-backdrop">
          <div className="help-modal-card">
            <div className="modal-header">
              <div className="modal-title-area">
                <HelpCircle className="text-blue-500" size={20} />
                <h3>HR Operations Support</h3>
              </div>
              <button className="close-btn" onClick={() => setShowHelpModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleHelpSubmit}>
              <div className="modal-body">
                {ticketSuccess ? (
                  <div className="help-success-pane">
                    <Check className="text-green success-circle" size={48} />
                    <h4>Ticket Logged Successfully</h4>
                    <p>HR team has been notified. We will get back to you within 24 hours.</p>
                  </div>
                ) : (
                  <>
                    <div className="hr-contact-info">
                      <strong>HR Direct Lines:</strong>
                      <p>Email: hr.support@company.com &bull; Phone: +1 (555) 019-9000</p>
                    </div>

                    <div className="form-group">
                      <label>Request Category</label>
                      <select value={ticketCategory} onChange={(e) => setTicketCategory(e.target.value)}>
                        <option value="PAYROLL">Payroll / Payslip Query</option>
                        <option value="LEAVE">Leave Balance Dispute</option>
                        <option value="ATTENDANCE">Attendance Punch Regularization</option>
                        <option value="HARDWARE">IT Hardware Allocation</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Briefly describe your issue</label>
                      <textarea
                        required
                        rows={4}
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        placeholder="Explain what help you need..."
                      ></textarea>
                    </div>
                  </>
                )}
              </div>

              {!ticketSuccess && (
                <div className="modal-footer">
                  <button type="button" className="btn-outline" onClick={() => setShowHelpModal(false)}>Close</button>
                  <button type="submit" className="btn-primary">Submit Support Ticket</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <style>{`
        /* Reset & Base */
        .emp-layout-wrapper {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: #f8fafc;
          font-family: 'Inter', system-ui, sans-serif;
          overflow: hidden;
        }

        .monitor-banner {
          padding: 10px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
          font-weight: 600;
          z-index: 100;
        }
        .monitor-banner.error { background: #fee2e2; color: #b91c1c; border-bottom: 1px solid #f87171; }
        .monitor-banner.error button { background: transparent; border: 1px solid #b91c1c; color: #b91c1c; padding: 4px 12px; border-radius: 4px; cursor: pointer; }
        .monitor-banner.success { background: #dcfce3; color: #15803d; justify-content: center; border-bottom: 1px solid #86efac; }

        /* Top Bar */
        .emp-topbar {
          height: 70px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          flex-shrink: 0;
          z-index: 50;
        }

        .emp-logo-area {
          width: 260px;
          padding: 0 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-right: 1px solid #e2e8f0;
          height: 100%;
          transition: width 0.2s ease-in-out;
        }

        .sidebar-collapsed .emp-logo-area {
          width: 76px;
          padding: 0;
          justify-content: center;
        }

        .sidebar-collapsed .logo-text {
          display: none;
        }

        .logo-icon {
          color: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .emp-topbar-content {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 32px 0 24px;
          height: 100%;
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 24px;
          flex: 1;
        }

        .menu-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
        }

        .search-bar {
          position: relative;
          width: 100%;
          max-width: 500px;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-bar input {
          width: 100%;
          padding: 10px 16px 10px 44px;
          background: #f1f5f9;
          border: 1px solid transparent;
          border-radius: 8px;
          font-size: 0.9rem;
          color: #334155;
          transition: all 0.2s;
          outline: none;
        }

        .search-bar input:focus {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        /* Search Dropdown Overlay */
        .search-dropdown-overlay {
          position: absolute;
          top: calc(100% + 8px);
          left: 0; right: 0;
          background: rgba(255,255,255,0.9);
          backdrop-filter: blur(10px);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08);
          max-height: 250px;
          overflow-y: auto;
          z-index: 200;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .search-result-item {
          width: 100%;
          background: none;
          border: none;
          padding: 10px 12px;
          border-radius: 8px;
          text-align: left;
          font-size: 0.85rem;
          color: #334155;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .search-result-item:hover {
          background: #eff6ff;
          color: #2563eb;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 20px;
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

        /* Dropdowns */
        .dropdown-container {
          position: relative;
        }

        .topbar-dropdown-tray {
          position: absolute;
          top: calc(100% + 14px);
          right: -10px;
          width: 320px;
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
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .tray-header {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tray-header h4 { margin: 0; font-size: 0.88rem; font-weight: 800; color: #0f172a; }
        .tray-header button { background: none; border: none; color: #3b82f6; font-size: 0.75rem; font-weight: 700; cursor: pointer; }
        .tray-header button:hover { text-decoration: underline; }

        .tray-list { max-height: 280px; overflow-y: auto; }

        .tray-item {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
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
        .tray-item-content strong { font-size: 0.8rem; color: #0f172a; font-weight: 700; }
        .tray-item-content p { margin: 0; font-size: 0.78rem; color: #475569; line-height: 1.4; }
        .tray-item-content span { font-size: 0.7rem; color: #94a3b8; font-weight: 500; }

        /* Profile Dropdown */
        .profile-dropdown-tray {
          position: absolute;
          top: calc(100% + 14px);
          right: 0;
          width: 200px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.08);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 200;
          animation: dropFade 0.2s ease-out;
        }

        .profile-dropdown-tray button {
          width: 100%;
          background: none;
          border: none;
          padding: 10px 12px;
          border-radius: 6px;
          text-align: left;
          font-size: 0.85rem;
          color: #475569;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .profile-dropdown-tray button:hover { background: #f1f5f9; color: #0f172a; }
        .profile-dropdown-tray button.logout { color: #ef4444; }
        .profile-dropdown-tray button.logout:hover { background: #fef2f2; color: #ef4444; }
        .tray-divider { height: 1px; background: #e2e8f0; margin: 4px 0; }

        .topbar-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: 12px;
          cursor: pointer;
        }

        .topbar-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
        }

        .topbar-user-info {
          display: flex;
          flex-direction: column;
        }

        .topbar-name { font-size: 0.85rem; font-weight: 700; color: #0f172a; }
        .topbar-role { font-size: 0.75rem; color: #64748b; }

        /* Layout Container */
        .emp-main-container {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        /* Sidebar */
        .emp-sidebar {
          width: 260px;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          height: 100%;
          transition: width 0.2s ease-in-out;
        }

        .sidebar-collapsed .emp-sidebar {
          width: 76px;
        }

        .sidebar-section-title {
          padding: 24px 24px 12px;
          font-size: 0.85rem;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          transition: opacity 0.2s;
        }

        .sidebar-collapsed .sidebar-section-title {
          opacity: 0;
          padding: 12px 0;
          height: 0;
          overflow: hidden;
        }

        .emp-nav {
          flex: 1;
          padding: 0 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          overflow-y: auto;
          transition: padding 0.2s;
        }

        .sidebar-collapsed .emp-nav {
          padding: 0 10px;
        }

        .emp-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          text-decoration: none;
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .sidebar-collapsed .emp-nav-item {
          padding: 12px;
          justify-content: center;
        }

        .emp-nav-item:hover {
          color: #0f172a;
          background: #f8fafc;
        }

        .emp-nav-item.active {
          background: #eef2ff;
          color: #4f46e5;
          font-weight: 600;
        }

        .nav-icon { color: inherit; flex-shrink: 0; }

        .nav-label {
          transition: opacity 0.2s;
        }

        .sidebar-collapsed .nav-label {
          display: none;
        }

        .sidebar-footer {
          padding: 20px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          gap: 16px;
          transition: padding 0.2s;
        }

        .sidebar-collapsed .sidebar-footer {
          padding: 10px;
          align-items: center;
        }

        .sidebar-profile-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          background: #ffffff;
          transition: padding 0.2s;
        }

        .sidebar-collapsed .sidebar-profile-card {
          border: none;
          padding: 0;
          background: transparent;
        }

        .profile-card-top {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .sidebar-collapsed .profile-card-top {
          margin-bottom: 0;
        }

        .profile-initials {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #3b82f6;
          color: white;
          font-weight: 700;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .profile-details {
          display: flex;
          flex-direction: column;
        }

        .sidebar-collapsed .profile-details {
          display: none;
        }

        .profile-card-name { font-size: 0.85rem; font-weight: 700; color: #0f172a; }
        .profile-card-id { font-size: 0.75rem; color: #64748b; }

        .btn-logout {
          width: 100%;
          padding: 8px;
          background: #fef2f2;
          color: #ef4444;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .sidebar-collapsed .btn-logout {
          display: none;
        }

        .btn-logout:hover { background: #fee2e2; }

        .sidebar-help {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 12px;
          cursor: pointer;
          transition: padding 0.2s;
        }

        .sidebar-collapsed .sidebar-help {
          padding: 10px;
          border-radius: 50%;
          background: #f1f5f9;
        }

        .help-icon { color: #64748b; display: flex; align-items: center; justify-content: center; }

        .help-text { display: flex; flex-direction: column; }
        
        .sidebar-collapsed .help-text {
          display: none;
        }

        .help-title { font-size: 0.85rem; font-weight: 700; color: #0f172a; }
        .help-subtitle { font-size: 0.75rem; color: #64748b; }

        /* Main Content */
        .emp-content-area {
          flex: 1;
          overflow-y: auto;
          position: relative;
        }

        /* Help ticket modal specific */
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .help-modal-card {
          background: white; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 20px 25px rgba(0,0,0,0.15); overflow: hidden;
        }

        .modal-header { padding: 18px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .modal-title-area { display: flex; align-items: center; gap: 10px; }
        .modal-title-area h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; }
        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; display: flex; }
        .close-btn:hover { color: #0f172a; }

        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }

        .hr-contact-info {
          background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; font-size: 0.8rem; color: #1e40af;
        }
        .hr-contact-info strong { display: block; margin-bottom: 4px; }
        .hr-contact-info p { margin: 0; }

        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
        .form-group select, .form-group textarea {
          width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; font-size: 0.85rem; outline: none;
        }
        .form-group select:focus, .form-group textarea:focus { border-color: #3b82f6; background: white; }

        .help-success-pane {
          display: flex; flex-direction: column; align-items: center; text-align: center; padding: 16px;
        }
        .success-circle {
          color: #22c55e; margin-bottom: 16px; background: #dcfce3; padding: 10px; border-radius: 50%;
        }
        .help-success-pane h4 { margin: 0 0 8px 0; font-size: 1.05rem; font-weight: 800; color: #14532d; }
        .help-success-pane p { margin: 0; font-size: 0.85rem; color: #15803d; }

        .modal-footer { padding: 16px 24px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 12px; }
        .btn-outline { background: white; border: 1px solid #cbd5e1; color: #334155; padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
        .btn-outline:hover { background: #f8fafc; }
        .btn-primary { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
        .btn-primary:hover { background: #2563eb; }

        /* ═══════════════════════════════════════════════════
           MOBILE RESPONSIVE STYLES FOR EMPLOYEE LAYOUT
           ═══════════════════════════════════════════════════ */

        @media (max-width: 900px) {
          .emp-topbar {
            height: 60px;
          }

          .emp-logo-area {
            width: auto;
            padding: 0 16px;
            border-right: none;
          }

          .logo-text {
            font-size: 1.1rem;
          }

          .emp-topbar-content {
            padding: 0 16px;
          }

          .topbar-left {
            gap: 12px;
          }

          .search-bar {
            max-width: 300px;
          }

          .topbar-right {
            gap: 12px;
          }

          .topbar-user-info {
            display: none;
          }

          .emp-sidebar {
            position: fixed;
            left: -100%;
            top: 70px;
            width: 280px;
            height: calc(100vh - 70px);
            z-index: 100;
            transition: left 0.3s ease;
            box-shadow: 2px 0 20px rgba(0, 0, 0, 0.1);
          }

          .mobile-open .emp-sidebar {
            left: 0;
            width: 280px;
          }

          .emp-content-area {
            width: 100%;
          }

          .topbar-dropdown-tray {
            width: 280px;
            right: -20px;
          }

          .search-dropdown-overlay {
            width: calc(100vw - 32px);
            left: 50%;
            transform: translateX(-50%);
          }
        }

        @media (max-width: 640px) {
          .emp-topbar {
            height: 56px;
          }

          .emp-logo-area {
            padding: 0 12px;
          }

          .logo-text {
            font-size: 1rem;
          }

          .logo-icon svg {
            width: 20px;
            height: 20px;
          }

          .emp-topbar-content {
            padding: 0 12px;
          }

          .topbar-left {
            gap: 8px;
            flex: 1;
          }

          .search-bar {
            max-width: 100%;
          }

          .search-bar input {
            padding: 8px 12px 8px 38px;
            font-size: 0.85rem;
          }

          .search-icon {
            left: 12px;
          }

          .topbar-right {
            gap: 8px;
          }

          .icon-btn {
            padding: 4px;
          }

          .icon-btn svg {
            width: 18px;
            height: 18px;
          }

          .topbar-avatar {
            width: 32px;
            height: 32px;
          }

          .emp-sidebar {
            top: 56px;
            width: 260px;
            height: calc(100vh - 56px);
          }

          .mobile-open .emp-sidebar {
            width: 260px;
            left: 0;
          }

          .sidebar-section-title {
            padding: 16px 16px 8px;
            font-size: 0.75rem;
          }

          .emp-nav {
            padding: 0 12px;
          }

          .emp-nav-item {
            padding: 10px 14px;
            font-size: 0.85rem;
          }

          .nav-icon svg {
            width: 16px;
            height: 16px;
          }

          .sidebar-footer {
            padding: 16px;
          }

          .sidebar-profile-card {
            padding: 12px;
          }

          .profile-initials {
            width: 36px;
            height: 36px;
            font-size: 0.9rem;
          }

          .profile-card-name {
            font-size: 0.8rem;
          }

          .profile-card-id {
            font-size: 0.7rem;
          }

          .btn-logout {
            padding: 8px 12px;
            font-size: 0.8rem;
          }

          .sidebar-help {
            padding: 10px;
          }

          .help-icon svg {
            width: 18px;
            height: 18px;
          }

          .help-title {
            font-size: 0.8rem;
          }

          .help-subtitle {
            font-size: 0.7rem;
          }

          .topbar-dropdown-tray {
            width: calc(100vw - 24px);
            right: 12px;
            left: 12px;
          }

          .profile-dropdown-tray {
            width: 180px;
          }

          .help-modal-card {
            max-width: calc(100vw - 32px);
            margin: 16px;
          }

          .modal-header {
            padding: 14px 16px;
          }

          .modal-title-area h3 {
            font-size: 0.95rem;
          }

          .modal-body {
            padding: 16px;
          }

          .form-group label {
            font-size: 0.7rem;
          }

          .form-group select,
          .form-group textarea {
            padding: 8px 10px;
            font-size: 0.8rem;
          }

          .modal-footer {
            padding: 12px 16px;
            flex-direction: column;
          }

          .modal-footer button {
            width: 100%;
          }

          .hr-contact-info {
            padding: 10px;
            font-size: 0.75rem;
          }
        }

        @media (max-width: 375px) {
          .emp-logo-area {
            padding: 0 8px;
          }

          .logo-text {
            font-size: 0.9rem;
          }

          .emp-topbar-content {
            padding: 0 8px;
          }

          .search-bar input {
            font-size: 0.8rem;
          }

          .emp-sidebar {
            width: 240px;
          }

          .mobile-open .emp-sidebar {
            width: 240px;
            left: 0;
          }
        }

        /* Mobile Overlay */
        .emp-mobile-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          z-index: 99;
        }

        .emp-mobile-overlay.active {
          opacity: 1;
          pointer-events: all;
        }

        /* Premium Employee Sidebar & Nav UI (All items visible without scrolling) */
        .emp-sidebar {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
          border-right: 1px solid #e2e8f0 !important;
          box-shadow: 4px 0 24px rgba(15, 23, 42, 0.04) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }
        .emp-sidebar .sidebar-section-title {
          font-size: 0.65rem !important;
          font-weight: 800 !important;
          letter-spacing: 0.08em !important;
          color: #64748b !important;
          padding: 8px 16px 4px !important;
        }
        .emp-sidebar .emp-nav {
          flex: 1 !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          padding: 2px 10px 6px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 2px !important;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .emp-sidebar .emp-nav::-webkit-scrollbar {
          width: 4px;
        }
        .emp-sidebar .emp-nav::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .emp-sidebar .emp-nav-item {
          display: flex !important;
          align-items: center !important;
          gap: 9px !important;
          padding: 5px 10px !important;
          border-radius: 9px !important;
          font-size: 0.82rem !important;
          font-weight: 600 !important;
          color: #475569 !important;
          transition: all 0.16s ease !important;
          text-decoration: none !important;
          line-height: 1.2 !important;
        }
        .emp-sidebar .emp-nav-icon-box {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          background: #f1f5f9;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.16s ease;
        }
        .emp-sidebar .emp-nav-item:hover:not(.active) {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          transform: translateX(2px);
        }
        .emp-sidebar .emp-nav-item:hover:not(.active) .emp-nav-icon-box {
          background: #e2e8f0;
          color: #334155;
        }
        .emp-sidebar .emp-nav-item.active {
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 6px 14px -4px rgba(79, 70, 229, 0.45) !important;
        }
        .emp-sidebar .emp-nav-item.active .emp-nav-icon-box {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }
        .emp-sidebar .sidebar-footer {
          flex-shrink: 0 !important;
          background: #ffffff !important;
          border-top: 1px solid #e2e8f0 !important;
          padding: 8px 10px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 6px !important;
        }
        .emp-sidebar .sidebar-profile-card {
          padding: 8px 10px !important;
          margin-bottom: 0 !important;
          gap: 6px !important;
        }
        .emp-sidebar .profile-initials {
          width: 32px !important;
          height: 32px !important;
          font-size: 0.78rem !important;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%) !important;
          color: #ffffff !important;
          font-weight: 800 !important;
        }
        .emp-sidebar .btn-logout {
          padding: 5px 8px !important;
          font-size: 0.8rem !important;
        }
        .emp-sidebar .sidebar-help {
          padding: 8px 10px !important;
          gap: 8px !important;
        }
      `}</style>
    </div>
  )
}
