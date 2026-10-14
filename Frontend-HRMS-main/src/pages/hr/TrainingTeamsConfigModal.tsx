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
  Save,
  Trash2,
  X,
  Sparkles,
  Loader2,
  ExternalLink,
  User,
  Mail,
  Lock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  BookOpen
} from 'lucide-react';
import api from '../../api/axios';
import {
  TrainingTeamsConfig,
  TrainingTeamsMode,
  getTrainingTeamsConfig,
  saveTrainingTeamsConfig,
  clearTrainingTeamsConfig
} from '../../utils/trainingTeamsConfig';

interface TrainingTeamsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: TrainingTeamsConfig | null) => void;
}

export const TrainingTeamsConfigModal: React.FC<TrainingTeamsConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [mode, setMode] = useState<TrainingTeamsMode>('azure');
  const [customMeetingLink, setCustomMeetingLink] = useState('');
  const [defaultTrainerName, setDefaultTrainerName] = useState('HR Training Team');
  const [defaultSenderName, setDefaultSenderName] = useState('VR PI Training Academy');
  const [defaultMeetingId, setDefaultMeetingId] = useState('');
  const [defaultPasscode, setDefaultPasscode] = useState('');
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [azureUserId, setAzureUserId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [showAzureGuide, setShowAzureGuide] = useState(false);
  const [copiedPermission, setCopiedPermission] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleCopyPermission = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPermission(text);
    setTimeout(() => setCopiedPermission(null), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      const existing = getTrainingTeamsConfig();
      if (existing) {
        setMode('azure');
        setCustomMeetingLink(existing.customMeetingLink || '');
        setDefaultTrainerName(existing.defaultTrainerName || 'HR Training Team');
        setDefaultSenderName(existing.defaultSenderName || 'VR PI Training Academy');
        setDefaultMeetingId(existing.defaultMeetingId || '');
        setDefaultPasscode(existing.defaultPasscode || '');
        setAzureTenantId(existing.azureTenantId || '');
        setAzureClientId(existing.azureClientId || '');
        setAzureClientSecret(existing.azureClientSecret || '');
        setAzureUserId(existing.azureUserId || '');
        setEnabled(existing.enabled ?? true);
      } else {
        setMode('azure');
        setCustomMeetingLink('');
        setDefaultTrainerName('HR Training Team');
        setDefaultSenderName('VR PI Training Academy');
        setDefaultMeetingId('');
        setDefaultPasscode('');
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
          message: 'Tenant ID, Client ID, Client Secret, and Organizer Email are all required for Azure M365 integration.'
        });
        return;
      }
    }

    const config: TrainingTeamsConfig = {
      mode: 'azure',
      customMeetingLink: '',
      defaultTrainerName: defaultTrainerName.trim() || 'HR Training Team',
      defaultSenderName: defaultSenderName.trim() || 'VR PI Training Academy',
      defaultMeetingId: defaultMeetingId.trim(),
      defaultPasscode: defaultPasscode.trim(),
      azureTenantId: azureTenantId.trim(),
      azureClientId: azureClientId.trim(),
      azureClientSecret: azureClientSecret.trim(),
      azureUserId: azureUserId.trim(),
      enabled
    };

    saveTrainingTeamsConfig(config);
    setSaveStatus('Microsoft Teams Training configuration saved successfully!');
    if (onConfigSaved) onConfigSaved(config);

    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const handleRemove = () => {
    if (confirm('Are you sure you want to remove the stored Microsoft Teams configuration?')) {
      clearTrainingTeamsConfig();
      setCustomMeetingLink('');
      setDefaultTrainerName('HR Training Team');
      setDefaultSenderName('VR PI Training Academy');
      setDefaultMeetingId('');
      setDefaultPasscode('');
      setAzureTenantId('');
      setAzureClientId('');
      setAzureClientSecret('');
      setAzureUserId('');
      setTestResult(null);
      setSaveStatus('Configuration removed.');
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
      if (mode === 'custom') {
        const link = customMeetingLink.trim();
        if (!link || (!link.startsWith('http://') && !link.startsWith('https://'))) {
          setTestResult({
            success: false,
            message: 'Please provide a valid meeting link starting with https:// (e.g. https://teams.microsoft.com/...)'
          });
          return;
        }
      }

      const res = await api.post('/training/test-teams-connection', {
        mode,
        customMeetingLink: customMeetingLink.trim(),
        azureTenantId: azureTenantId.trim(),
        azureClientId: azureClientId.trim(),
        azureClientSecret: azureClientSecret.trim(),
        azureUserId: azureUserId.trim()
      });

      if (res.data?.success) {
        setTestResult({
          success: true,
          message: res.data.message || 'Microsoft Teams configuration verified successfully! Ready for training sessions.'
        });
      } else {
        setTestResult({
          success: false,
          message: res.data?.error || res.data?.message || 'Verification failed. Please check the meeting link or credentials.'
        });
      }
    } catch (err: any) {
      console.warn('Teams connection test error:', err);
      const errDetail = err?.response?.data?.error || err?.response?.data?.message || err?.message;
      setTestResult({
        success: false,
        message: errDetail || 'Could not verify Teams connection. Please check your inputs.'
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
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #464EB8 0%, #31378f 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Video size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
                Microsoft Teams Configuration
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#e0e7ff', opacity: 0.9 }}>
                Configure Teams meeting room & sender defaults for employee training dispatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Azure M365 Integration Header Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              borderRadius: '10px',
              marginBottom: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                <ShieldCheck size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e3a8a' }}>
                  Microsoft 365 Azure Graph API Integration
                </div>
                <div style={{ fontSize: '0.74rem', color: '#3b82f6', marginTop: '2px' }}>
                  Enterprise integration for automated Microsoft Teams room & email dispatch
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '99px', background: '#dbeafe', color: '#1d4ed8' }}>
              Azure Cloud
            </span>
          </div>

          {/* Azure M365 Credentials & Instructions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {/* Azure Setup Instructions Banner / Collapsible Guide */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowAzureGuide(!showAzureGuide)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={17} color="#464EB8" />
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                        How to Set Up Azure M365 Graph (Step-by-Step Instructions)
                      </span>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                        {showAzureGuide ? 'Click to collapse guide' : 'Click to view required Azure AD app registration & permission steps'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <a
                      href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: '#464EB8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'none',
                        background: '#e0e7ff',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      Azure Portal <ExternalLink size={12} />
                    </a>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#475569',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                    >
                      {showAzureGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {showAzureGuide && (
                  <div style={{ padding: '14px 16px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#334155', lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      {/* Step 1 */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: '#464EB8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                          1
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Register App in Microsoft Entra ID (Azure AD):</strong>
                          <div>
                            Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer" style={{ color: '#464EB8', fontWeight: 600, textDecoration: 'underline' }}>Azure Portal &gt; App Registrations <ExternalLink size={11} style={{ display: 'inline' }} /></a>.
                            Click <strong>+ New registration</strong>, name it <code>HRMS-Teams-Service</code>, leave Supported account types as <em>"Accounts in this organizational directory only (Single tenant)"</em>, and click <strong>Register</strong>.
                          </div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: '#464EB8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                          2
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Copy Tenant ID and Client ID:</strong>
                          <div>
                            On the App <strong>Overview</strong> screen, copy:
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                              <li><strong>Directory (tenant) ID</strong> &rarr; paste into <em>Tenant ID</em> below.</li>
                              <li><strong>Application (client) ID</strong> &rarr; paste into <em>Client ID</em> below.</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: '#464EB8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                          3
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Create Client Secret:</strong>
                          <div>
                            In the left sidebar, click <strong>Certificates & secrets</strong> &rarr; <strong>+ New client secret</strong>.
                            Enter a description (e.g. <code>HRMS Secret</code>) and set expiry (e.g. 180 days or 24 months). Click <strong>Add</strong>.
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 10px', marginTop: '4px', color: '#991b1b', fontSize: '0.74rem' }}>
                              ⚠️ <strong>Important:</strong> Immediately copy the <strong>Value</strong> column (not Secret ID) and paste into <em>Client Secret</em> below. It will not be shown again once you leave the page.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: '#464EB8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                          4
                        </div>
                        <div style={{ flex: 1 }}>
                          <strong style={{ color: '#0f172a' }}>Add Microsoft Graph API Permissions (2 Required):</strong>
                          <div>
                            Click <strong>API permissions</strong> &rarr; <strong>+ Add a permission</strong> &rarr; Select <strong>Microsoft Graph</strong>.
                            Choose <span style={{ background: '#e0e7ff', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, color: '#312e81' }}>Application permissions</span> (⚠️ NOT Delegated permissions).
                            Search for and add both of the following:

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '8px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                <div>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>1. For Teams Meeting Generation:</span>
                                  <code style={{ fontWeight: 700, color: '#0f172a' }}>OnlineMeetings.ReadWrite.All</code>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPermission('OnlineMeetings.ReadWrite.All')}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#464EB8', fontSize: '0.7rem', fontWeight: 600 }}
                                  title="Copy permission name"
                                >
                                  {copiedPermission === 'OnlineMeetings.ReadWrite.All' ? <><Check size={14} color="#16a34a" /> Copied</> : <><Copy size={14} /> Copy</>}
                                </button>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                <div>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>2. For Sending Invitation Emails via Microsoft:</span>
                                  <code style={{ fontWeight: 700, color: '#0f172a' }}>Mail.Send</code>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPermission('Mail.Send')}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#464EB8', fontSize: '0.7rem', fontWeight: 600 }}
                                  title="Copy permission name"
                                >
                                  {copiedPermission === 'Mail.Send' ? <><Check size={14} color="#16a34a" /> Copied</> : <><Copy size={14} /> Copy</>}
                                </button>
                              </div>
                            </div>

                            Click <strong>Add permissions</strong>.
                          </div>
                        </div>
                      </div>

                      {/* Step 5 */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: '#464EB8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                          5
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Grant Admin Consent (Crucial!):</strong>
                          <div>
                            On the same <em>API permissions</em> screen, click the button <strong>"Grant admin consent for [Your Organization]"</strong> located right above the table.
                            Click <strong>Yes</strong> to confirm. The status column must turn into a green checkmark stating <code>Granted for [Your Organization]</code> for both permissions.
                          </div>
                        </div>
                      </div>

                      {/* Step 6 */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: '#464EB8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                          6
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Meeting Organizer & Dispatch Mailbox:</strong>
                          <div>
                            Enter the official work email (e.g. <code>trainer@yourcompany.com</code> or your HR Microsoft 365 email). Teams meetings will be hosted by this user, and <strong>all official training invitations will be sent directly through this Microsoft 365 mailbox</strong> (and appear in your Outlook Sent Items).
                          </div>
                        </div>
                      </div>

                      {/* Step 7 */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: '22px', height: '22px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
                          7
                        </div>
                        <div>
                          <strong style={{ color: '#0f172a' }}>Test & Save:</strong>
                          <div>
                            Click the <strong>Test Connection</strong> button below. If everything is configured correctly, you will receive a green verification confirmation! Then click <strong>Save Configuration</strong>.
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Tenant ID (Directory ID) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 25276fbe-5e50-46cc-b2b0-f5d73c1ae606"
                  value={azureTenantId}
                  onChange={(e) => setAzureTenantId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Client ID (Application ID) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 847d891b-698f-4315-99ff-81765c71a399"
                  value={azureClientId}
                  onChange={(e) => setAzureClientId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    Client Secret <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <a
                    href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.72rem', color: '#464EB8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                  >
                    Open Azure Portal <ExternalLink size={12} />
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Azure Client Secret value (from Certificates & secrets)"
                    value={azureClientSecret}
                    onChange={(e) => setAzureClientSecret(e.target.value)}
                    style={{ width: '100%', padding: '9px 40px 9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Meeting Organizer User Principal Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="trainer@yourcompany.com"
                  value={azureUserId}
                  onChange={(e) => setAzureUserId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
                <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                  The Microsoft 365 work account under which training meetings will be officially scheduled and hosted.
                </p>
              </div>
            </div>

          {/* Custom Name / Trainer & Sender Defaults ("with custome name") */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} color="#464EB8" /> Default Custom Names & Meeting Credentials
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Default Trainer / Lead Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma - Lead Trainer"
                  value={defaultTrainerName}
                  onChange={(e) => setDefaultTrainerName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Default Sender Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. VR PI Corporate Training"
                  value={defaultSenderName}
                  onChange={(e) => setDefaultSenderName(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Meeting ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 249 810 931 445"
                  value={defaultMeetingId}
                  onChange={(e) => setDefaultMeetingId(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Meeting Passcode (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TRN2026"
                  value={defaultPasscode}
                  onChange={(e) => setDefaultPasscode(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          </div>

          {/* Test & Status Alerts */}
          {testResult && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                backgroundColor: testResult.success ? '#ecfdf5' : '#fef2f2',
                border: testResult.success ? '1px solid #a7f3d0' : '1px solid #fecaca',
                color: testResult.success ? '#065f46' : '#991b1b',
                fontSize: '0.82rem'
              }}
            >
              {testResult.success ? <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />}
              <div>{testResult.message}</div>
            </div>
          )}

          {saveStatus && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={16} />
              <span>{saveStatus}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              {isTesting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} color="#464EB8" />}
              <span>Test Connection</span>
            </button>

            <button
              type="button"
              onClick={handleRemove}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #fecaca',
                background: '#fff5f5',
                color: '#b91c1c',
                fontSize: '0.82rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={15} />
              <span>Reset</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
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
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#464EB8',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(70, 78, 184, 0.3)'
              }}
            >
              <Save size={15} />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
