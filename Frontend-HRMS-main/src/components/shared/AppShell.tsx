import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { History, Bell, Mail } from 'lucide-react'

import { useAuthStore } from '../../store/auth.store'

type NavItem = {
  to: string
  label: string
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
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState<any | null>(null)
  
  const [notifications, setNotifications] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])

  const unreadNotifCount = notifications.filter(n => !n.read).length
  const unreadMsgCount = messages.filter(m => m.unread).length

  // Load notifications from localStorage
  const loadNotifications = () => {
    try {
      const raw = localStorage.getItem('hrms_hr_notifications')
      if (raw) {
        let allNotifs = JSON.parse(raw)
        
        // Super Admin should only see credit-related notifications
        if (user?.role === 'SUPER_ADMIN') {
          allNotifs = allNotifs.filter((n: any) => {
            const text = n.text.toLowerCase()
            return text.includes('credit') || text.includes('paid') || text.includes('payment')
          })
        }
        
        setNotifications(allNotifs)
      } else {
        setNotifications([])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleMarkAllNotificationsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    // NOTE: This will only mark the visible ones as read for Super Admin, which is fine.
    // If they were to save back, they'd overwrite the main list if not careful.
    // To be safe, we fetch the raw list, update only the matched IDs, and save back.
    try {
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
    setNotifications([])
    try {
      const raw = localStorage.getItem('hrms_hr_notifications')
      if (raw) {
        let allNotifs = JSON.parse(raw)
        const currentIds = new Set(notifications.map(n => n.id))
        allNotifs = allNotifs.filter((n: any) => !currentIds.has(n.id))
        localStorage.setItem('hrms_hr_notifications', JSON.stringify(allNotifs))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleMarkAllMessagesRead = () => {
    setMessages(messages.map(m => ({ ...m, unread: false })))
  }

  // Load and listen to storage
  useEffect(() => {
    loadNotifications()
    window.addEventListener('storage', loadNotifications)
    const interval = setInterval(loadNotifications, 3000)
    return () => {
      window.removeEventListener('storage', loadNotifications)
      clearInterval(interval)
    }
  }, [])

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
    <div className="app-shell">
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

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <span>{title}</span>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
              end
            >
              {item.label}
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
            Logout
          </button>
        </div>
      </aside>
      <main className="content" style={{ position: 'relative' }}>
        {/* Desktop Topbar */}
        <div className="shell-topbar">
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
                            localStorage.setItem('hrms_hr_notifications', JSON.stringify(updated))
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
            justify-content: flex-end;
            margin-bottom: 1.5rem;
            position: relative;
            z-index: 100;
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
          }
        `}</style>
      </main>
    </div>
  )
}


