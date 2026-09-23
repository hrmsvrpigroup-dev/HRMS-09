import React, { useState, useEffect } from 'react';
import {
  Mail,
  Key,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Save,
  Trash2,
  X,
  Sparkles,
  Loader2,
  Check,
  Send,
  Calendar,
  FolderOpen,
  MailCheck,
  Award
} from 'lucide-react';
import api from '../../api/axios';
import {
  GoogleMailConfig,
  getGoogleMailConfig,
  saveGoogleMailConfig,
  clearGoogleMailConfig
} from '../../utils/googleMailConfig';

interface RecruitmentGoogleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: GoogleMailConfig | null) => void;
}

export const RecruitmentGoogleConfigModal: React.FC<RecruitmentGoogleConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [senderName, setSenderName] = useState('VR PI TECH SOLUTIONS HR');
  const [enabled, setEnabled] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Load existing config on modal open
  useEffect(() => {
    if (isOpen) {
      const existing = getGoogleMailConfig();
      if (existing) {
        setEmail(existing.email || '');
        setAppPassword(existing.appPassword || '');
        setSenderName(existing.senderName || 'VR PI TECH SOLUTIONS HR');
        setEnabled(existing.enabled ?? true);
      } else {
        setEmail('');
        setAppPassword('');
        setSenderName('VR PI TECH SOLUTIONS HR');
        setEnabled(true);
      }
      setTestResult(null);
      setSaveStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid Gmail address.');
      return;
    }
    const cleanPassword = appPassword.replace(/\s+/g, '');
    if (!cleanPassword) {
      alert('Please enter your 16-character Google App Password.');
      return;
    }

    const config: GoogleMailConfig = {
      email: email.trim().toLowerCase(),
      appPassword: cleanPassword,
      senderName: senderName.trim() || 'HR Recruitment Team',
      enabled,
      interviewAutoEmail: true,
      documentsAutoEmail: true,
      callLetterAutoEmail: true,
      offerLetterAutoEmail: true
    };

    saveGoogleMailConfig(config);
    setSaveStatus('Credentials saved successfully in this browser!');
    if (onConfigSaved) onConfigSaved(config);

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleRemove = () => {
    if (confirm('Are you sure you want to remove the stored Gmail credentials? The system will revert to default server mailing.')) {
      clearGoogleMailConfig();
      setEmail('');
      setAppPassword('');
      setSenderName('VR PI TECH SOLUTIONS HR');
      setTestResult(null);
      setSaveStatus('Credentials removed.');
      if (onConfigSaved) onConfigSaved(null);
      setTimeout(() => {
        onClose();
      }, 800);
    }
  };

  const handleTestConnection = async () => {
    if (!email || !email.includes('@')) {
      setTestResult({ success: false, message: 'Please enter a valid Gmail address first.' });
      return;
    }
    const cleanPassword = appPassword.replace(/\s+/g, '');
    if (!cleanPassword || cleanPassword.length < 8) {
      setTestResult({ success: false, message: 'Please enter a valid 16-character Google App Password.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await api.post('/recruitment/test-gmail-connection', {
        email: email.trim(),
        appPassword: cleanPassword,
        senderName: senderName.trim()
      });

      if (res.data?.success) {
        setTestResult({
          success: true,
          message: res.data.message || `SMTP handshake successful with ${email}! Default templates ready to send.`
        });
      } else {
        setTestResult({
          success: false,
          message: res.data?.error || res.data?.message || 'Verification failed. Please verify your App Password.'
        });
      }
    } catch (err: any) {
      console.warn('Test connection API response:', err);
      // If backend test route isn't available or network error, validate format
      const errDetail = err?.response?.data?.error || err?.response?.data?.message || err?.message;
      setTestResult({
        success: false,
        message: errDetail || 'Could not verify connection. Check your 16-character App Password and internet connection.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '1.25rem',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          position: 'relative'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem 1.75rem',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
            color: '#ffffff',
            borderTopLeftRadius: '1.25rem',
            borderTopRightRadius: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.25)'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                Google Gmail Credentials
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#c7d2fe', margin: '4px 0 0 0' }}>
                Automated Recruitment Email Dispatcher
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem 1.75rem' }}>
          {/* Active Status Banner */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.75rem',
              background: email && appPassword && enabled ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${email && appPassword && enabled ? '#bbf7d0' : '#e2e8f0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {email && appPassword && enabled ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-slate-400" />
              )}
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                  {email && appPassword && enabled ? 'Automated Gmail Sender Active' : 'Gmail Sender Not Configured'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {email && appPassword && enabled
                    ? `Emails send automatically as "${senderName}" <${email}>`
                    : 'System defaults will be used until Google credentials are saved.'}
                </div>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
              Enable
            </label>
          </div>

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* Sender Email */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                Sender Gmail Address <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    color: '#94a3b8'
                  }}
                />
                <input
                  type="email"
                  placeholder="e.g. hr@vrpigroup.co.in or yourname@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.5rem',
                    borderRadius: '0.625rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Google App Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                  Google App Password (16 Letters) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.75rem',
                    color: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    textDecoration: 'none',
                    fontWeight: 600
                  }}
                >
                  Generate on Google <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <Key
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    color: '#94a3b8'
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="abcd efgh ijkl mnop (16 letters)"
                  value={appPassword}
                  onChange={e => setAppPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 2.6rem 0.65rem 2.5rem',
                    borderRadius: '0.625rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    fontFamily: showPassword ? 'inherit' : 'monospace',
                    letterSpacing: showPassword ? '0.05em' : '0.2em',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sender Display Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.35rem' }}>
                Sender Display Name
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    color: '#94a3b8'
                  }}
                />
                <input
                  type="text"
                  placeholder="e.g. VR PI TECH SOLUTIONS HR"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.5rem',
                    borderRadius: '0.625rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Test & Save Status Alerts */}
          {testResult && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.625rem',
                background: testResult.success ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${testResult.success ? '#a7f3d0' : '#fecaca'}`,
                color: testResult.success ? '#065f46' : '#991b1b',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {saveStatus && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.625rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}
            >
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{saveStatus}</span>
            </div>
          )}

          {/* 4 Automated Stages Handled */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>
              Connected Recruitment Stages (Default Templates Auto-Sent)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.625rem',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem'
                }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#1e293b' }}>3. Interviews</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Teams link + .ics invite</div>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.625rem',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem'
                }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#1e293b' }}>4. Documents</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Upload link & checklist</div>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.625rem',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem'
                }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }}>
                  <MailCheck className="w-4 h-4" />
                </div>
                <div>
                  <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#1e293b' }}>6. Call Letter</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Letter of Intent + PDF</div>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.625rem',
                  padding: '0.6rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem'
                }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div style={{ fontSize: '0.775rem', fontWeight: 700, color: '#1e293b' }}>8. Offer Letter</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Formal Offer + CTC</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Help Guide */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '0.625rem',
              padding: '0.75rem 0.9rem',
              fontSize: '0.75rem',
              color: '#475569',
              lineHeight: 1.5,
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ fontWeight: 700, color: '#334155', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              How to get your 16-character Google App Password:
            </div>
            <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
              <li>Go to your <strong>Google Account</strong> → <strong>Security</strong>.</li>
              <li>Ensure <strong>2-Step Verification</strong> is enabled.</li>
              <li>Search for <strong>"App Passwords"</strong> (or visit <code>myaccount.google.com/apppasswords</code>).</li>
              <li>Name it <code>HRMS Recruitment</code>, click <strong>Create</strong>, and paste the 16 letters above.</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
            <div>
              {email && appPassword && (
                <button
                  type="button"
                  onClick={handleRemove}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    color: '#e11d48',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Remove saved credentials"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !email || !appPassword}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '0.55rem 0.95rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: isTesting || !email || !appPassword ? 'not-allowed' : 'pointer',
                  opacity: isTesting || !email || !appPassword ? 0.6 : 1
                }}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Test Connection
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
                }}
              >
                <Save className="w-4 h-4" />
                Save Credentials
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default RecruitmentGoogleConfigModal;
