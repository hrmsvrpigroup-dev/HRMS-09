import { FormEvent, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Leaf, User, Lock, Mail, HelpCircle, LogIn, ArrowRight, Search, Facebook, Twitter, Instagram, MessageCircle, Linkedin, Send } from 'lucide-react'
import { cn } from '../../lib/utils'

import api from '../../api/axios'
import { useAuthStore } from '../../store/auth.store'
import { getSubdomain } from '../../utils/subdomain'
import './sunset.css'

type LoginResponse = {
  success: boolean
  message: string
  data: {
    user: {
      id: string
      tenantId: string | null
      tenantSubdomain: string | null
      email: string
      role: 'SUPER_ADMIN' | 'ADMIN' | 'HR' | 'EMPLOYEE'
      firstName: string
      lastName: string
    }
    mustResetPassword?: boolean
    resetToken?: string | null
    accessToken: string | null
    refreshToken: string | null
  }
}


const getLandingRoute = (role: string) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/superadmin'
    case 'ADMIN':
      return '/admin'
    case 'HR':
      return '/hr'
    default:
      return '/employee'
  }
}

export default function Login() {
  const setAuth = useAuthStore((state) => state.setAuth)
  const logout = useAuthStore((state) => state.logout)
  const { isAuthenticated, user } = useAuthStore()
  const navigate = useNavigate()
  
  const currentSubdomain = getSubdomain(window.location.host)
  const isSuperAdminPortal = false // Removed as per user request to use generic portal
  
  // Lower tabs navigation state (Sign In, Enquire, Recovery)
  const [authMode, setAuthMode] = useState<'signin' | 'register' | 'recover'>('signin')
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Registration states
  const [hasRegistered, setHasRegistered] = useState(false)
  const [regName, setRegName] = useState('')
  const [regSubdomain, setRegSubdomain] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regFullName, setRegFullName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regWebsite, setRegWebsite] = useState('')
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  // Forgot Password states
  const [forgotEmailOrUsername, setForgotEmailOrUsername] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [forgotError, setForgotError] = useState('')

  useEffect(() => {
    // Force signin mode if on a subdomain (either superadmin or tenant)
    if (isSuperAdminPortal || currentSubdomain !== '') {
      setAuthMode('signin')
    }
  }, [isSuperAdminPortal, currentSubdomain])

  useEffect(() => {
    const fetchIpStatus = async () => {
      try {
        const response = await api.get<{ data: { hasRegistered: boolean } }>('/auth/check-ip')
        setHasRegistered(response.data.data.hasRegistered)
      } catch (err) {
        console.error('Failed to check IP registration status', err)
      }
    }
    fetchIpStatus()
  }, [])

  // Clear authentication state when visiting the login page
  // This forces the user to enter credentials.
  useEffect(() => {
    logout()
  }, [logout])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await api.post<LoginResponse>('/auth/login', { email: email.trim(), password, subdomain: currentSubdomain })
      
      if (!response.data || response.data.success === false) {
        setError((response.data as any)?.message || 'Invalid credentials. Please try again.')
        return
      }

      const payload = response.data.data

      if (payload.mustResetPassword && payload.resetToken) {
        navigate(`/reset-password?token=${payload.resetToken}`, { replace: true })
        return
      }

      setAuth(payload.user, payload.accessToken as string, payload.refreshToken as string)
      navigate(getLandingRoute(payload.user.role), { replace: true })
    } catch (err: any) {
      if (!err.response) {
        setError('Server is waking up from idle. Please wait 5 seconds and click Log In again.')
      } else {
        const msg = err.response?.data?.message || 'Invalid credentials. Please try again.'
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const onRegisterSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setRegLoading(true)
    setRegError('')
    setRegSuccess('')

    try {
      const nameParts = regFullName.trim().split(/\s+/)
      const adminFirstName = nameParts[0] || 'Admin'
      const adminLastName = nameParts.slice(1).join(' ') || 'User'

      await api.post('/auth/register', {
        name: regName,
        subdomain: regSubdomain,
        adminEmail: regEmail,
        adminUsername: regEmail,
        adminFirstName,
        adminLastName,
        phone: regPhone,
        websiteUrl: regWebsite || undefined,
        registrationDocs: [],
      })

      setRegSuccess('Thank you! We will contact you within 2-3 business hours.')
      setHasRegistered(true)
      
      // Clean up fields
      setRegName('')
      setRegSubdomain('')
      setRegEmail('')
      setRegFullName('')
      setRegPhone('')
      setRegWebsite('')

      // Switch back to signin after 3 seconds
      setTimeout(() => {
        setAuthMode('signin')
        setRegSuccess('')
      }, 3000)
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.'
      setRegError(msg)
    } finally {
      setRegLoading(false)
    }
  }

  const onForgotSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotError('')
    setForgotSuccess('')

    try {
      await api.post('/auth/forgot-password', { emailOrUsername: forgotEmailOrUsername })
      setForgotSuccess('If that account exists, a reset link has been sent to the registered email.')
      setForgotEmailOrUsername('')
      setTimeout(() => {
        setAuthMode('signin')
        setForgotSuccess('')
      }, 5000)
    } catch (err: any) {
      setForgotError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className={cn("sunset-auth-screen", isSuperAdminPortal && "superadmin-auth-screen")}>


      {/* Main Glass Container */}
      <div className={`sunset-glass-container ${authMode === 'register' ? 'is-flipped' : ''}`}>
        
        {/* Left Side: Brand, Slogan & Socials */}
        <div className="sunset-glass-left">
          {isSuperAdminPortal ? (
            <>
              <div className="sunset-brand-header">
                <span>HRMS Admin Portal</span>
              </div>
              
              <h1 className="sunset-heading">
                Platform<br />
                Management
              </h1>
              
              <p className="sunset-subtitle-text">
                Control, provision, and monitor the multi-tenant SaaS platform.<br />
                Secure, automated, and centralized administration portal.
              </p>
            </>
          ) : (
            <>
              <div className="sunset-brand-header">
                <span>HRMS</span>
              </div>
              
              <h1 className="sunset-heading">
                Welcome !<br />
                To Our Channel
              </h1>
              
              <p className="sunset-subtitle-text">
                Inspire. Learn. Create.<br />
                Let's build something amazing together.
              </p>
            </>
          )}

          <div className="sunset-socials">
            <a href="#" className="sunset-social-icon"><Facebook /></a>
            <a href="#" className="sunset-social-icon"><Send /></a>
            <a href="https://wa.me/918790946714" target="_blank" rel="noopener noreferrer" className="sunset-social-icon"><MessageCircle /></a>
            <a href="https://www.instagram.com/vrpigroup/" target="_blank" rel="noopener noreferrer" className="sunset-social-icon"><Instagram /></a>
            <a href="#" className="sunset-social-icon"><Twitter /></a>
            <a href="https://www.linkedin.com/company/vr-pi-tech-solutions-llp-in/?viewAsMember=true" target="_blank" rel="noopener noreferrer" className="sunset-social-icon"><Linkedin /></a>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="sunset-glass-right">
          <div className="sunset-right-welcome">
            <h2 className="welcome-title">
              {isSuperAdminPortal ? 'Super Admin Portal' : currentSubdomain ? `${currentSubdomain.toUpperCase()} Portal` : 'Sign In'}
            </h2>
          </div>

          {!isSuperAdminPortal && currentSubdomain === '' && (
            <div className="sunset-mid-capsules">
              <button 
                type="button" 
                onClick={() => { setError(''); setRegError(''); setForgotError(''); setAuthMode('signin'); }}
                className={cn('sunset-capsule-btn', authMode === 'signin' && 'sunset-capsule-btn--active')}
              >
                Sign In
              </button>
              <button 
                type="button" 
                onClick={() => { setError(''); setRegError(''); setForgotError(''); setAuthMode('register'); }}
                className={cn('sunset-capsule-btn', authMode === 'register' && 'sunset-capsule-btn--active')}
              >
                Enquire
              </button>
            </div>
          )}

          <div className="sunset-form-content">
            {/* SIGN IN FORM */}
            {authMode === 'signin' && (
              <form onSubmit={onSubmit} autoComplete="off">
                <div className="sunset-label">
                  Email
                  <div className="sunset-input-wrap">
                    <input 
                      type="text" 
                      placeholder="Email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                    <Mail className="sunset-input-icon h-4 w-4" />
                  </div>
                </div>

                <div className="sunset-label">
                  Password
                  <div className="sunset-input-wrap">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required 
                    />
                    <button 
                      type="button" 
                      className="sunset-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="sunset-options-row">
                  <label className="sunset-checkbox-container">
                    <input type="checkbox" defaultChecked />
                    <span>Remember Me</span>
                  </label>
                  <button type="button" onClick={() => setAuthMode('recover')} className="sunset-forgot-link">
                    Forgot Password
                  </button>
                </div>

                {error && <p className="sunset-error-text">{error}</p>}

                <button type="submit" disabled={loading} className="sunset-btn-primary">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Log In'}
                </button>

                {!isSuperAdminPortal && currentSubdomain === '' && (
                  <div className="sunset-signup-prompt">
                    Create A New Account? <a onClick={() => setAuthMode('register')}>Sign Up</a>
                  </div>
                )}
              </form>
            )}

            {/* ENQUIRE (REGISTER) FORM */}
            {authMode === 'register' && (
              <form onSubmit={onRegisterSubmit} className="sunset-register-form">
                <div className="sunset-form-grid">
                  <div className="sunset-label">
                    Company Name
                    <div className="sunset-input-wrap">
                      <input 
                        type="text" 
                        value={regName} 
                        onChange={e => {
                          const val = e.target.value;
                          setRegName(val);
                          setRegSubdomain(val.toLowerCase().replace(/[^a-z0-9]/g, ''));
                        }} 
                        required 
                      />
                    </div>
                  </div>
                  <div className="sunset-label">
                    Contact Name
                    <div className="sunset-input-wrap">
                      <input type="text" value={regFullName} onChange={e => setRegFullName(e.target.value)} required />
                    </div>
                  </div>
                </div>

                <div className="sunset-form-grid">
                  <div className="sunset-label">
                    Email ID
                    <div className="sunset-input-wrap">
                      <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                    </div>
                  </div>
                  <div className="sunset-label">
                    Contact Number
                    <div className="sunset-input-wrap">
                      <input type="text" value={regPhone} onChange={e => setRegPhone(e.target.value)} required />
                    </div>
                  </div>
                </div>

                <div className="sunset-label" style={{ marginTop: '1.5rem' }}>
                  Website URL (Optional)
                  <div className="sunset-input-wrap">
                    <input type="text" value={regWebsite} onChange={e => setRegWebsite(e.target.value)} />
                  </div>
                </div>

                {regError && <p className="sunset-error-text">{regError}</p>}
                {regSuccess && <p className="sunset-success-text">{regSuccess}</p>}

                <button type="submit" disabled={regLoading} className="sunset-btn-primary" style={{ marginTop: '2rem' }}>
                  {regLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enquire'}
                </button>
              </form>
            )}

            {/* RECOVERY PASSWORD FORM */}
            {authMode === 'recover' && (
              <form onSubmit={onForgotSubmit}>
                <div className="sunset-label">
                  Email or Username
                  <div className="sunset-input-wrap">
                    <input 
                      type="text" 
                      value={forgotEmailOrUsername}
                      onChange={(e) => setForgotEmailOrUsername(e.target.value)}
                      required 
                    />
                    <Mail className="sunset-input-icon h-4 w-4" />
                  </div>
                </div>

                {forgotError && <p className="sunset-error-text">{forgotError}</p>}
                {forgotSuccess && <p className="sunset-success-text">{forgotSuccess}</p>}

                <button type="submit" disabled={forgotLoading} className="sunset-btn-primary" style={{ marginTop: '2rem' }}>
                  {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Reset Link'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
