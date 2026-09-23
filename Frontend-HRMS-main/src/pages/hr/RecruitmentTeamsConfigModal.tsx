import React, { useState, useEffect } from 'react';
import {
  Video,
  Link2,
  Key,
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
  Copy,
  Check,
  Calendar,
  Layers
} from 'lucide-react';
import api from '../../api/axios';
import {
  TeamsConfig,
  TeamsMode,
  getTeamsConfig,
  saveTeamsConfig,
  clearTeamsConfig
} from '../../utils/teamsConfig';

interface RecruitmentTeamsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: TeamsConfig | null) => void;
}

export const RecruitmentTeamsConfigModal: React.FC<RecruitmentTeamsConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureUserId, setAzureUserId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Load existing configuration on modal open
  useEffect(() => {
    if (isOpen) {
      const existing = getTeamsConfig();
      if (existing) {
        setAzureTenantId(existing.azureTenantId || '');
        setAzureClientId(existing.azureClientId || '');
        setAzureClientSecret(existing.azureClientSecret || '');
        setAzureUserId(existing.azureUserId || '');
        setEnabled(existing.enabled ?? true);
      } else {
        setAzureTenantId('');
        setAzureClientId('');
        setAzureClientSecret('');
        setAzureUserId('');
        setEnabled(true);
      }
      setTestResult(null);
      setSaveStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (enabled) {
      if (!azureTenantId.trim() || !azureClientId.trim() || !azureClientSecret.trim() || !azureUserId.trim()) {
        setTestResult({
          success: false,
          message: 'Tenant ID, Client ID, Client Secret, and Organizer Email are all required for Azure integration.'
        });
        return;
      }
    }

    const config: TeamsConfig = {
      mode: 'azure',
      customMeetingLink: '',
      azureTenantId: azureTenantId.trim(),
      azureClientId: azureClientId.trim(),
      azureClientSecret: azureClientSecret.trim(),
      azureUserId: azureUserId.trim(),
      enabled
    };

    saveTeamsConfig(config);
    setSaveStatus('Teams Azure configuration saved successfully!');
    if (onConfigSaved) onConfigSaved(config);

    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleRemove = () => {
    if (confirm('Are you sure you want to remove the stored Teams configuration?')) {
      clearTeamsConfig();
      setAzureTenantId('');
      setAzureClientId('');
      setAzureClientSecret('');
      setAzureUserId('');
      setTestResult(null);
      setSaveStatus('Configuration cleared.');
      if (onConfigSaved) onConfigSaved(null);
      setTimeout(() => {
        onClose();
      }, 800);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await api.post('/recruitment/test-teams-connection', {
        mode: 'azure',
        azureTenantId: azureTenantId.trim(),
        azureClientId: azureClientId.trim(),
        azureClientSecret: azureClientSecret.trim(),
        azureUserId: azureUserId.trim()
      });

      if (res.data?.success) {
        setTestResult({
          success: true,
          message: res.data.message || 'Teams configuration verified successfully!'
        });
      } else {
        setTestResult({
          success: false,
          message: res.data?.error || res.data?.message || 'Verification failed.'
        });
      }
    } catch (err: any) {
      const errDetail = err?.response?.data?.error || err?.response?.data?.message || err?.message;
      setTestResult({
        success: false,
        message: errDetail || 'Could not verify Teams connection.'
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
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #4338ca 0%, #4f46e5 50%, #6366f1 100%)',
            padding: '1.4rem 1.75rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {/* Microsoft Teams Icon */}
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M19.5 7.5A2.5 2.5 0 1 0 17 5a2.5 2.5 0 0 0 2.5 2.5z" fill="#ffffff" />
                <path d="M21.5 9h-4a1.5 1.5 0 0 0-1.5 1.5V15h7v-4.5A1.5 1.5 0 0 0 21.5 9z" fill="#ffffff" opacity="0.85" />
                <path d="M12.5 6A3.5 3.5 0 1 0 9 2.5 3.5 3.5 0 0 0 12.5 6z" fill="#ffffff" />
                <path d="M15 8.5H10a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-7.5a2 2 0 0 0-2-2z" fill="#ffffff" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Microsoft Teams Configuration
              </h2>
              <p style={{ fontSize: '0.82rem', margin: '3px 0 0 0', opacity: 0.9, color: '#e0e7ff' }}>
                Stage 3 Virtual Interview Meeting Link Dispatcher
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Active Switch Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.15rem',
              backgroundColor: enabled ? '#f0fdf4' : '#f8fafc',
              border: `1.5px solid ${enabled ? '#bbf7d0' : '#e2e8f0'}`,
              borderRadius: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <ShieldCheck size={20} color={enabled ? '#16a34a' : '#64748b'} />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: enabled ? '#15803d' : '#334155' }}>
                  {enabled ? 'Teams Meeting Automation Active' : 'Teams Meeting Automation Disabled'}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  {enabled
                    ? 'Interviews automatically attach the configured meeting link and send calendar invites'
                    : 'System will use standard dynamic fallback'}
                </div>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#4f46e5' }}
              />
              Enable
            </label>
          </div>

          {/* Azure M365 Integration Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.15rem',
              backgroundColor: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: '0.85rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1d4ed8'
                }}
              >
                <Layers size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e3a8a' }}>
                  Microsoft 365 Azure Graph API Integration
                </div>
                <div style={{ fontSize: '0.74rem', color: '#3b82f6', marginTop: '2px' }}>
                  Enterprise integration for automated Microsoft Teams interview room generation
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '99px', background: '#dbeafe', color: '#1d4ed8' }}>
              Azure Cloud
            </span>
          </div>

          {/* Azure Microsoft 365 Graph API Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                  Azure Tenant ID (Directory ID) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={azureTenantId}
                  onChange={(e) => setAzureTenantId(e.target.value)}
                  placeholder="e.g. 25276fbe-5e50-46cc-b2b0-..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.65rem',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                  Azure Client ID (Application ID) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={azureClientId}
                  onChange={(e) => setAzureClientId(e.target.value)}
                  placeholder="e.g. a82d3e91-..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '0.65rem',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                  Azure Client Secret <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <a
                  href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                >
                  Open Azure Portal <ExternalLink size={12} />
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Key size={15} />
                </div>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={azureClientSecret}
                  onChange={(e) => setAzureClientSecret(e.target.value)}
                  placeholder="Enter client secret value"
                  style={{
                    width: '100%',
                    padding: '0.6rem 2.25rem 0.6rem 2.25rem',
                    borderRadius: '0.65rem',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.3rem' }}>
                Organizer Microsoft 365 User Email / Object ID <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                value={azureUserId}
                onChange={(e) => setAzureUserId(e.target.value)}
                placeholder="e.g. hr@yourcompany.com"
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '0.65rem',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '4px 0 0 0' }}>
                The Microsoft 365 user account under which official Teams meeting rooms will be created.
              </p>
            </div>
          </div>

          {/* Test Status Banner */}
          {testResult && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.85rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: testResult.success ? '#f0fdf4' : '#fef2f2',
                border: `1.5px solid ${testResult.success ? '#86efac' : '#fca5a5'}`
              }}
            >
              {testResult.success ? (
                <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
              )}
              <div style={{ fontSize: '0.8rem', color: testResult.success ? '#15803d' : '#991b1b', lineHeight: 1.45 }}>
                {testResult.message}
              </div>
            </div>
          )}

          {/* Save Status Banner */}
          {saveStatus && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={16} />
              {saveStatus}
            </div>
          )}

          {/* Quick Guide Card */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.85rem',
              padding: '1rem 1.15rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
              <Calendar size={15} color="#4f46e5" />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                How this works during Stage 3 Interviews:
              </span>
            </div>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#475569', lineHeight: 1.6 }}>
              <li>When you click <strong>Schedule Interview</strong> in Stage 3, the meeting link field is auto-populated with this configured Teams link.</li>
              <li>The candidate and interview panel automatically receive the invitation email and an attached <strong>.ics calendar file</strong> containing the link.</li>
              <li>Saved directly in your browser. Zero backend environment files or database changes required.</li>
            </ol>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.75rem',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.95rem',
                borderRadius: '0.65rem',
                border: '1.5px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: isTesting ? 'not-allowed' : 'pointer',
                opacity: isTesting ? 0.7 : 1
              }}
            >
              {isTesting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} color="#4f46e5" />}
              Test Connection
            </button>

            <button
              type="button"
              onClick={handleRemove}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.65rem',
                border: '1px solid #fecaca',
                backgroundColor: '#fff5f5',
                color: '#dc2626',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={14} /> Clear
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '0.65rem',
                border: '1.5px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '0.65rem',
                border: 'none',
                background: 'linear-gradient(135deg, #4338ca 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              <Save size={15} /> Save Teams Config
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecruitmentTeamsConfigModal;
