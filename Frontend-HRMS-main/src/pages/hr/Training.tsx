import React, { useState, useEffect, useMemo } from 'react';
import {
  Video,
  Mail,
  Users,
  Calendar,
  Clock,
  Sparkles,
  Link2,
  CheckCircle2,
  AlertCircle,
  Search,
  CheckSquare,
  Square,
  Send,
  Loader2,
  Settings,
  Eye,
  FileText,
  UserCheck,
  Building,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  Info,
  Key,
  ShieldCheck,
  ChevronDown,
  FolderPlus,
  X,
  Check
} from 'lucide-react';
import api from '../../api/axios';
import { employeeApi, Employee } from '../../api/employee.api';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  TrainingTeamsConfig,
  getTrainingTeamsConfig,
  isTrainingTeamsConfigured
} from '../../utils/trainingTeamsConfig';
import {
  TRAINING_TEMPLATES,
  TrainingTemplate
} from '../../utils/trainingTemplates';
import { TrainingTeamsConfigModal } from './TrainingTeamsConfigModal';
import { RecruitmentGoogleConfigModal } from './RecruitmentGoogleConfigModal';
import {
  GoogleMailConfig,
  getGoogleMailConfig,
  isGoogleMailConfigured
} from '../../utils/googleMailConfig';

interface DispatchedHistoryItem {
  id: string;
  title: string;
  trainerName: string;
  senderName: string;
  date: string;
  time: string;
  meetingLink: string;
  recipientsCount: number;
  sentAt: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
}

export interface EmployeeGroup {
  id: string;
  name: string;
  description?: string;
  employeeIds: string[];
  createdAt: string;
}

const HISTORY_STORAGE_KEY = 'hrms_training_dispatched_history';
const GROUPS_STORAGE_KEY = 'hrms_training_employee_groups';

const getStoredGroups = (): EmployeeGroup[] => {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export default function Training() {
  // Config Modal States
  const [isTeamsModalOpen, setIsTeamsModalOpen] = useState(false);
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [teamsConfig, setTeamsConfig] = useState<TrainingTeamsConfig | null>(() => getTrainingTeamsConfig());
  const [mailConfig, setMailConfig] = useState<GoogleMailConfig | null>(() => getGoogleMailConfig());

  // Employees State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());

  // Search & Filters for Employees
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Custom Employee Groups State
  const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>(() => getStoredGroups());
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupFormName, setGroupFormName] = useState('');
  const [groupFormDescription, setGroupFormDescription] = useState('');
  const [groupFormMemberIds, setGroupFormMemberIds] = useState<Set<string>>(new Set());
  const [groupFormSearch, setGroupFormSearch] = useState('');
  const [groupFormDept, setGroupFormDept] = useState('ALL');

  // External / Extra Attendees
  const [extraAttendees, setExtraAttendees] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraEmail, setNewExtraEmail] = useState('');
  const [showExtraForm, setShowExtraForm] = useState(false);

  // Training Session Fields
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('induction');
  const [trainingTitle, setTrainingTitle] = useState('Company Orientation & HRMS Platform Walkthrough');
  const [trainerName, setTrainerName] = useState('HR Training Team');
  const [customSenderName, setCustomSenderName] = useState('VR PI Training Academy');
  const [trainingDate, setTrainingDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  });
  const [trainingTime, setTrainingTime] = useState('11:00 AM - 12:30 PM IST');
  const [duration, setDuration] = useState('90 Minutes');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [agenda, setAgenda] = useState(`1. Welcome & Introduction\n2. Key Policy & System Walkthrough\n3. Hands-on Training & Objectives\n4. Interactive Q&A Session`);
  const [prerequisites, setPrerequisites] = useState('Please ensure you have Microsoft Teams installed and your headset ready.');
  const [instructions, setInstructions] = useState('Join 5 minutes before scheduled start time. Attendance is recorded via MS Teams join logs.');
  const [customMessage, setCustomMessage] = useState('');

  // UI & Dispatch State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // History State
  const [history, setHistory] = useState<DispatchedHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [showAllInline, setShowAllInline] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  const handleClearHistory = () => {
    if (history.length === 0) return;
    if (window.confirm('Are you sure you want to clear all dispatched training session records?')) {
      setHistory([]);
      try {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
      } catch (err) {
        console.error('Failed to clear history from localStorage:', err);
      }
      setIsHistoryModalOpen(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearchQuery.toLowerCase().trim();
    if (!q) return history;
    return history.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.trainerName.toLowerCase().includes(q) ||
        item.date.includes(q) ||
        item.status.toLowerCase().includes(q)
    );
  }, [history, historySearchQuery]);

  // Load Initial Data & Configs
  useEffect(() => {
    loadEmployees();
    applyInitialTeamsDefaults();
  }, []);

  const loadEmployees = async () => {
    setIsLoadingEmployees(true);
    try {
      const res = await employeeApi.list();
      const list = res.data.data || [];
      setEmployees(list);
    } catch (err) {
      console.error('Failed to load employees for training:', err);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const applyInitialTeamsDefaults = () => {
    const cfg = getTrainingTeamsConfig();
    setTeamsConfig(cfg);
    if (cfg) {
      if (cfg.customMeetingLink) setMeetingLink(cfg.customMeetingLink);
      if (cfg.defaultTrainerName) setTrainerName(cfg.defaultTrainerName);
      if (cfg.defaultSenderName) setCustomSenderName(cfg.defaultSenderName);
      if (cfg.defaultMeetingId) setMeetingId(cfg.defaultMeetingId);
      if (cfg.defaultPasscode) setPasscode(cfg.defaultPasscode);
    }
  };

  // Load Template Handler
  const handleLoadTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = TRAINING_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;

    setTrainingTitle(tpl.defaultTitle);
    setTrainerName(teamsConfig?.defaultTrainerName || tpl.defaultTrainerName);
    setCustomSenderName(teamsConfig?.defaultSenderName || tpl.defaultSenderName);
    setDuration(tpl.defaultDuration);
    setTrainingTime(tpl.defaultTime);
    setAgenda(tpl.agenda);
    setPrerequisites(tpl.prerequisites);
    setInstructions(tpl.instructions);
    if (tpl.customMessage) setCustomMessage(tpl.customMessage);
  };

  // Generate or Refresh Teams Meeting Link
  const handleGenerateTeamsLink = async () => {
    setIsGeneratingLink(true);
    try {
      const res = await api.post('/training/generate-teams-link', {
        topic: trainingTitle,
        teamsConfig
      });
      if (res.data?.success && res.data?.data?.link) {
        setMeetingLink(res.data.data.link);
      }
    } catch (err: any) {
      console.warn('Teams link auto generation:', err);
      // Fallback fallback link with clean uuid
      const fallback = `https://teams.microsoft.com/l/meetup-join/19%3ameeting_training_${Date.now()}@thread.v2/0`;
      setMeetingLink(fallback);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Department list for filtering
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((emp) => {
      const deptName = emp.department?.name?.trim();
      if (deptName) set.add(deptName);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const query = searchQuery.toLowerCase().trim();
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const code = (emp.employeeCode || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const dept = (emp.department?.name || '').toLowerCase();
      const designation = (emp.designation?.title || '').toLowerCase();

      const matchesQuery =
        !query ||
        fullName.includes(query) ||
        code.includes(query) ||
        email.includes(query) ||
        dept.includes(query) ||
        designation.includes(query);

      const matchesDept =
        selectedDept === 'ALL' || (emp.department?.name || '') === selectedDept;

      return matchesQuery && matchesDept;
    });
  }, [employees, searchQuery, selectedDept]);

  // Employee Selection Helpers
  const handleToggleEmployee = (id: string) => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      filteredEmployees.forEach((emp) => next.add(emp.id));
      return next;
    });
  };

  const handleDeselectAllFiltered = () => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      filteredEmployees.forEach((emp) => next.delete(emp.id));
      return next;
    });
  };

  const handleClearAllSelections = () => {
    setSelectedEmpIds(new Set());
    setExtraAttendees([]);
  };

  // Add Extra / External Attendee
  const handleAddExtraAttendee = () => {
    if (!newExtraEmail.trim() || !newExtraEmail.includes('@')) {
      alert('Please enter a valid attendee email.');
      return;
    }
    const newAtt = {
      id: `ext_${Date.now()}`,
      name: newExtraName.trim() || newExtraEmail.split('@')[0],
      email: newExtraEmail.trim()
    };
    setExtraAttendees([...extraAttendees, newAtt]);
    setNewExtraName('');
    setNewExtraEmail('');
    setShowExtraForm(false);
  };

  const handleRemoveExtraAttendee = (id: string) => {
    setExtraAttendees(extraAttendees.filter((a) => a.id !== id));
  };

  // Custom Employee Group Actions
  const handleOpenCreateGroup = () => {
    if (selectedEmpIds.size > 0) {
      setGroupFormMemberIds(new Set(selectedEmpIds));
    } else {
      setGroupFormMemberIds(new Set());
    }
    setGroupFormName('');
    setGroupFormDescription('');
    setGroupFormSearch('');
    setGroupFormDept('ALL');
    setIsCreateGroupOpen(true);
  };

  const handleSaveGroup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = groupFormName.trim();
    if (!trimmedName) {
      alert('Please enter a group name.');
      return;
    }
    if (groupFormMemberIds.size === 0) {
      alert('Please select at least 1 employee for this group.');
      return;
    }

    const newGroup: EmployeeGroup = {
      id: `group_${Date.now()}`,
      name: trimmedName,
      description: groupFormDescription.trim(),
      employeeIds: Array.from(groupFormMemberIds),
      createdAt: new Date().toISOString()
    };

    const updatedGroups = [newGroup, ...employeeGroups];
    setEmployeeGroups(updatedGroups);
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(updatedGroups));
    } catch (err) {
      console.error('Failed to save group to localStorage:', err);
    }

    // Auto-select group members in current selection
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      newGroup.employeeIds.forEach((id) => next.add(id));
      return next;
    });

    setIsCreateGroupOpen(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;
    const updated = employeeGroups.filter((g) => g.id !== groupId);
    setEmployeeGroups(updated);
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to update groups in localStorage:', err);
    }
  };

  const handleToggleGroupSelection = (grp: EmployeeGroup) => {
    const allSelected = grp.employeeIds.length > 0 && grp.employeeIds.every((id) => selectedEmpIds.has(id));
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        grp.employeeIds.forEach((id) => next.delete(id));
      } else {
        grp.employeeIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const modalFilteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = groupFormSearch.toLowerCase().trim();
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const code = (emp.employeeCode || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const dept = (emp.department?.name || '').toLowerCase();

      const matchesQ =
        !q || fullName.includes(q) || code.includes(q) || email.includes(q) || dept.includes(q);
      const matchesDept = groupFormDept === 'ALL' || (emp.department?.name || '') === groupFormDept;
      return matchesQ && matchesDept;
    });
  }, [employees, groupFormSearch, groupFormDept]);

  const handleToggleGroupMember = (id: string) => {
    setGroupFormMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllInModal = () => {
    setGroupFormMemberIds((prev) => {
      const next = new Set(prev);
      modalFilteredEmployees.forEach((emp) => next.add(emp.id));
      return next;
    });
  };

  const handleDeselectAllInModal = () => {
    setGroupFormMemberIds((prev) => {
      const next = new Set(prev);
      modalFilteredEmployees.forEach((emp) => next.delete(emp.id));
      return next;
    });
  };

  // Total Recipients Calculation
  const selectedRecipients = useMemo(() => {
    const fromRoster = employees
      .filter((emp) => selectedEmpIds.has(emp.id))
      .map((emp) => ({
        id: emp.id,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee',
        email: emp.email,
        employeeCode: emp.employeeCode,
        department: emp.department?.name,
        designation: emp.designation?.title
      }));

    const fromExtra = extraAttendees.map((att) => ({
      id: att.id,
      name: att.name,
      email: att.email,
      employeeCode: 'EXTERNAL',
      department: 'External Guest',
      designation: 'Attendee'
    }));

    return [...fromRoster, ...fromExtra];
  }, [employees, selectedEmpIds, extraAttendees]);

  // Dispatch Microsoft Teams Invitations
  const handleSendInvitations = async () => {
    if (selectedRecipients.length === 0) {
      alert('Please select at least one employee recipient to send training invitations.');
      return;
    }

    if (!trainingTitle.trim()) {
      alert('Please provide a training session title.');
      return;
    }

    let finalLink = meetingLink.trim();
    if (!finalLink) {
      finalLink = teamsConfig?.customMeetingLink?.trim() || `https://teams.microsoft.com/l/meetup-join/19%3ameeting_training_${Date.now()}@thread.v2/0`;
    }

    const confirmMsg = `Send official Microsoft Teams training invitations to ${selectedRecipients.length} employee(s)?\n\nSession: ${trainingTitle}\nDate & Time: ${trainingDate} at ${trainingTime}\nTrainer: ${trainerName}`;
    if (!confirm(confirmMsg)) return;

    setIsDispatching(true);
    setDispatchStatus(null);

    try {
      const res = await api.post('/training/send-invitations', {
        recipients: selectedRecipients,
        meetingDetails: {
          title: trainingTitle.trim(),
          trainerName: trainerName.trim() || 'HR Training Team',
          customSenderName: customSenderName.trim() || 'VR PI Training Academy',
          date: trainingDate,
          time: trainingTime,
          duration,
          meetingLink: finalLink,
          meetingId: meetingId.trim(),
          passcode: passcode.trim(),
          agenda: agenda.trim(),
          prerequisites: prerequisites.trim(),
          instructions: instructions.trim(),
          customMessage: customMessage.trim()
        },
        googleMailConfig: getGoogleMailConfig(),
        teamsConfig: getTrainingTeamsConfig(),
        subject: `[Training Invitation] ${trainingTitle.trim()} via Microsoft Teams`
      });

      if (res.data?.success) {
        const resultData = res.data.data;
        setDispatchStatus({
          success: true,
          message: res.data.message || `Successfully sent training invitations to ${resultData.successCount} employee(s)!`,
          details: resultData
        });

        // Save to History
        const newHistoryItem: DispatchedHistoryItem = {
          id: `trn_${Date.now()}`,
          title: trainingTitle,
          trainerName,
          senderName: customSenderName,
          date: trainingDate,
          time: trainingTime,
          meetingLink: finalLink,
          recipientsCount: resultData.successCount || selectedRecipients.length,
          sentAt: new Date().toLocaleString(),
          status: resultData.failCount > 0 ? 'PARTIAL' : 'SUCCESS'
        };

        const updatedHistory = [newHistoryItem, ...history.slice(0, 19)];
        setHistory(updatedHistory);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updatedHistory));
      } else {
        setDispatchStatus({
          success: false,
          message: res.data?.error || 'Failed to dispatch training invitations.'
        });
      }
    } catch (err: any) {
      console.error('Dispatch error:', err);
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Error occurred while sending invitations.';
      setDispatchStatus({
        success: false,
        message: errMsg
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const teamsConfigured = isTrainingTeamsConfigured();
  const mailConfigured = isGoogleMailConfigured();

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 8px 48px' }}>
      {/* Top Banner & Action Controls */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          borderRadius: '18px',
          padding: '28px 32px',
          color: '#ffffff',
          marginBottom: '24px',
          boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.25)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px'
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.15)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '10px' }}>
            <Video size={15} />
            <span>Microsoft Teams Training Dispatcher</span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
            Employee Training & Development
          </h1>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem', color: '#c7d2fe', maxWidth: '650px', lineHeight: 1.5 }}>
            Configure Microsoft Teams sessions, load professional corporate training templates, select employee email rosters, and dispatch personalized meeting invitations with custom trainer credentials.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Microsoft Teams Configuration Button */}
          <button
            type="button"
            onClick={() => setIsTeamsModalOpen(true)}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease'
            }}
          >
            <Video size={17} color="#a5b4fc" />
            <span>Teams Configuration</span>
            {teamsConfigured ? (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></span>
            ) : (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></span>
            )}
          </button>

          {/* Mail / SMTP Configuration Button */}
          <button
            type="button"
            onClick={() => setIsMailModalOpen(true)}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              background: 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Mail size={17} color="#a5b4fc" />
            <span>Mail Config</span>
            {mailConfigured ? (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}></span>
            ) : (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }}></span>
            )}
          </button>

          {/* Email Preview Button */}
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: '#ffffff',
              color: '#312e81',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <Eye size={17} />
            <span>Preview Email</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organization Roster</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {isLoadingEmployees ? '...' : employees.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '2px', fontWeight: 500 }}>All workspace employees loaded</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Attendees</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: selectedRecipients.length > 0 ? '#4f46e5' : '#64748b', marginTop: '4px' }}>
            {selectedRecipients.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
            {selectedEmpIds.size} employees + {extraAttendees.length} guests
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Microsoft Teams Link</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: meetingLink ? '#16a34a' : '#d97706', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {meetingLink ? 'Connected & Ready' : 'Auto / Not Generated'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
            {teamsConfig?.mode === 'azure' ? 'Enterprise Azure M365' : teamsConfig?.customMeetingLink ? 'Custom Recurring URL' : 'Auto Room Generator'}
          </div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trainer & Sender</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {trainerName || 'HR Training Team'}
          </div>
          <div style={{ fontSize: '0.75rem', color: teamsConfig?.mode === 'azure' && teamsConfig?.azureUserId ? '#4338ca' : '#64748b', marginTop: '2px', fontWeight: teamsConfig?.mode === 'azure' ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {teamsConfig?.mode === 'azure' && teamsConfig?.azureUserId
              ? `From: ${teamsConfig.azureUserId}`
              : `Display: ${customSenderName}`}
          </div>
        </div>
      </div>

      {/* Main Two-Column Workflow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Template Loader & Session Customization */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Template Loader */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Load Corporate Training Templates
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                {TRAINING_TEMPLATES.length} Pre-built Templates
              </span>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b' }}>
              Select a standardized module below to auto-fill training title, trainer name, duration, agenda, and technical prerequisites.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
              {TRAINING_TEMPLATES.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleLoadTemplate(tpl.id)}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                      background: isSelected ? '#f5f3ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: tpl.badgeColor,
                          background: `${tpl.badgeColor}18`,
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        {tpl.category}
                      </span>
                      {isSelected && <CheckCircle2 size={14} color="#4f46e5" />}
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: isSelected ? '#312e81' : '#1e293b', marginTop: '2px' }}>
                      {tpl.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      ⏱️ {tpl.defaultDuration}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Session & Microsoft Teams Customizer */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={18} color="#464EB8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Session Details & Custom Names
                </h3>
              </div>
              <button
                type="button"
                onClick={handleGenerateTeamsLink}
                disabled={isGeneratingLink}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isGeneratingLink ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span>Regenerate Teams Link</span>
              </button>
            </div>

            {/* Title / Topic */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Training Title / Subject <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={trainingTitle}
                onChange={(e) => setTrainingTitle(e.target.value)}
                placeholder="e.g. Q4 Microservices Architecture & Best Practices"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
              />
            </div>

            {/* Custom Trainer Name & Custom Sender Display Name ("with custome name") */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Trainer / Speaker Name (Custom Name)
                </label>
                <input
                  type="text"
                  value={trainerName}
                  onChange={(e) => setTrainerName(e.target.value)}
                  placeholder="e.g. Priya Sharma - Lead Architect"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Sender Display Name (Custom Name)
                </label>
                <input
                  type="text"
                  value={customSenderName}
                  onChange={(e) => setCustomSenderName(e.target.value)}
                  placeholder="e.g. VR PI HR Training Academy"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            {/* Date, Time & Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Session Date
                </label>
                <input
                  type="date"
                  value={trainingDate}
                  onChange={(e) => setTrainingDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Time & Slot
                </label>
                <input
                  type="text"
                  value={trainingTime}
                  onChange={(e) => setTrainingTime(e.target.value)}
                  placeholder="e.g. 11:00 AM - 12:30 PM IST"
                  style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Duration
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#ffffff' }}
                >
                  <option value="30 Minutes">30 Minutes</option>
                  <option value="45 Minutes">45 Minutes</option>
                  <option value="60 Minutes">60 Minutes</option>
                  <option value="90 Minutes">90 Minutes</option>
                  <option value="2 Hours">2 Hours</option>
                  <option value="Half Day (3.5 Hrs)">Half Day (3.5 Hrs)</option>
                  <option value="Full Day Workshop">Full Day Workshop</option>
                </select>
              </div>
            </div>

            {/* Microsoft Teams Meeting Link */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                  Microsoft Teams Meeting URL <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                </label>
                {meetingLink && (
                  <a
                    href={meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.75rem', color: '#464EB8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                  >
                    <span>Test Join Link</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Link2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#464EB8' }} />
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://teams.microsoft.com/l/meetup-join/..."
                  style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Optional Teams Meeting ID & Passcode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                  Meeting ID (Optional)
                </label>
                <input
                  type="text"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  placeholder="e.g. 235 918 421 002"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                  Meeting Passcode (Optional)
                </label>
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="e.g. MS-TRN2026"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            {/* Agenda Editor */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Agenda & Session Objectives
              </label>
              <textarea
                rows={4}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                placeholder="List the key bullet points and goals of this training..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'inherit' }}
              />
            </div>

            {/* Prerequisites & Instructions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                  Prerequisites / Requirements
                </label>
                <textarea
                  rows={2}
                  value={prerequisites}
                  onChange={(e) => setPrerequisites(e.target.value)}
                  placeholder="Hardware/software or files needed..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                  Joining Instructions
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Camera, mic, or attendance notice..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Employee Selection & Email Dispatch */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Employee Roster Card */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                  Select Employee Emails
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleOpenCreateGroup}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 11px',
                    borderRadius: '8px',
                    border: '1px solid #c7d2fe',
                    background: '#eef2ff',
                    color: '#4338ca',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Create and save a custom employee group"
                >
                  <Plus size={14} />
                  <span>Create Group</span>
                </button>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: selectedRecipients.length > 0 ? '#4f46e5' : '#64748b',
                    background: selectedRecipients.length > 0 ? '#e0e7ff' : '#f1f5f9',
                    padding: '3px 10px',
                    borderRadius: '12px'
                  }}
                >
                  {selectedRecipients.length} Selected
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search by name, employee code, email, or dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
              />
            </div>

            {/* Custom Employee Groups (if any) */}
            {employeeGroups.length > 0 && (
              <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={12} /> Groups:
                </span>
                {employeeGroups.map((grp) => {
                  const allSelected = grp.employeeIds.length > 0 && grp.employeeIds.every((id) => selectedEmpIds.has(id));
                  const someSelected = grp.employeeIds.some((id) => selectedEmpIds.has(id));
                  return (
                    <div
                      key={grp.id}
                      onClick={() => handleToggleGroupSelection(grp)}
                      title={`Click to ${allSelected ? 'deselect' : 'select'} ${grp.name} (${grp.employeeIds.length} members)`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: allSelected ? '1px solid #4338ca' : '1px solid #cbd5e1',
                        background: allSelected ? '#4338ca' : someSelected ? '#e0e7ff' : '#f8fafc',
                        color: allSelected ? '#ffffff' : someSelected ? '#3730a3' : '#475569',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{grp.name} ({grp.employeeIds.length})</span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(grp.id);
                        }}
                        title="Delete group"
                        style={{
                          marginLeft: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: allSelected ? '#e0e7ff' : '#94a3b8',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={11} />
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Department Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedDept('ALL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '14px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: selectedDept === 'ALL' ? '#312e81' : '#f1f5f9',
                  color: selectedDept === 'ALL' ? '#ffffff' : '#64748b'
                }}
              >
                All Departments
              </button>
              {departments.slice(0, 5).map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => setSelectedDept(dept)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: selectedDept === dept ? '#312e81' : '#f1f5f9',
                    color: selectedDept === dept ? '#ffffff' : '#64748b'
                  }}
                >
                  {dept}
                </button>
              ))}
            </div>

            {/* Quick Bulk Selection Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4f46e5',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckSquare size={13} />
                  <span>Select All ({filteredEmployees.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Deselect Filtered
                </button>
              </div>

              {selectedRecipients.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllSelections}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Employees Interactive List */}
            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
              {isLoadingEmployees ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                  <LoadingSpinner />
                  <p style={{ marginTop: '8px', fontSize: '0.8rem' }}>Loading workspace employee rosters...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                  No employees matched the search filters.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isChecked = selectedEmpIds.has(emp.id);
                  const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleEmployee(emp.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: isChecked ? '1px solid #c7d2fe' : '1px solid #f1f5f9',
                        background: isChecked ? '#eff6ff' : '#fafafa',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <div style={{ color: isChecked ? '#4f46e5' : '#94a3b8' }}>
                          {isChecked ? <CheckSquare size={17} /> : <Square size={17} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>{fullName}</span>
                            {emp.employeeCode && (
                              <span style={{ fontSize: '0.7rem', color: '#64748b', background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px' }}>
                                {emp.employeeCode}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {emp.email}
                          </div>
                        </div>
                      </div>

                      {emp.department?.name && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: '#475569',
                            background: '#e2e8f0',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            whiteSpace: 'nowrap',
                            marginLeft: '8px'
                          }}
                        >
                          {emp.department.name}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Extra Guest / External Attendee Adder */}
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              {!showExtraForm ? (
                <button
                  type="button"
                  onClick={() => setShowExtraForm(true)}
                  style={{
                    background: 'none',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    width: '100%',
                    padding: '8px',
                    fontSize: '0.78rem',
                    color: '#4f46e5',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={14} />
                  <span>Add External Email / Guest Attendee</span>
                </button>
              ) : (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                    Add External / Guest Attendee
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      placeholder="Guest Name"
                      value={newExtraName}
                      onChange={(e) => setNewExtraName(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                    <input
                      type="email"
                      placeholder="guest@example.com"
                      value={newExtraEmail}
                      onChange={(e) => setNewExtraEmail(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowExtraForm(false)}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddExtraAttendee}
                      style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Add Attendee
                    </button>
                  </div>
                </div>
              )}

              {/* Extra Attendees Badges */}
              {extraAttendees.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {extraAttendees.map((att) => (
                    <div
                      key={att.id}
                      style={{
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '0.72rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#92400e' }}>{att.name}</span>
                      <span style={{ color: '#b45309' }}>({att.email})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraAttendee(att.id)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#92400e' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dispatch Action Card */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Dispatch Invitations via Microsoft Teams
            </h3>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
              Selected employees will receive a personalized invitation with official Microsoft Teams join link, meeting ID, date/time, and trainer credentials.
            </p>

            {dispatchStatus && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  backgroundColor: (dispatchStatus.details?.failCount > 0 && dispatchStatus.details?.successCount === 0)
                    ? '#fef2f2'
                    : (dispatchStatus.details?.failCount > 0 ? '#fffbeb' : (dispatchStatus.success ? '#ecfdf5' : '#fef2f2')),
                  border: (dispatchStatus.details?.failCount > 0 && dispatchStatus.details?.successCount === 0)
                    ? '1px solid #fecaca'
                    : (dispatchStatus.details?.failCount > 0 ? '1px solid #fde68a' : (dispatchStatus.success ? '1px solid #a7f3d0' : '1px solid #fecaca')),
                  color: (dispatchStatus.details?.failCount > 0 && dispatchStatus.details?.successCount === 0)
                    ? '#991b1b'
                    : (dispatchStatus.details?.failCount > 0 ? '#92400e' : (dispatchStatus.success ? '#065f46' : '#991b1b')),
                  fontSize: '0.84rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  {(dispatchStatus.details?.failCount > 0 && dispatchStatus.details?.successCount === 0) || !dispatchStatus.success ? (
                    <AlertCircle size={18} color="#dc2626" />
                  ) : dispatchStatus.details?.failCount > 0 ? (
                    <AlertCircle size={18} color="#d97706" />
                  ) : (
                    <CheckCircle2 size={18} color="#16a34a" />
                  )}
                  <span>{dispatchStatus.message}</span>
                </div>

                {/* Detailed recipient error breakdown */}
                {dispatchStatus.details?.results?.some((r: any) => !r.success) && (
                  <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.05)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px', color: '#0f172a' }}>Reason for Failure:</div>
                    {dispatchStatus.details.results
                      .filter((r: any) => !r.success)
                      .map((r: any, idx: number) => (
                        <div key={idx} style={{ color: '#b91c1c', marginTop: idx > 0 ? '4px' : 0 }}>
                          • <strong>{r.email}:</strong> {r.error}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleSendInvitations}
              disabled={isDispatching || selectedRecipients.length === 0}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '12px',
                border: 'none',
                background: selectedRecipients.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #464EB8 0%, #31378f 100%)',
                color: '#ffffff',
                fontSize: '0.95rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: selectedRecipients.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: selectedRecipients.length > 0 ? '0 6px 18px rgba(70, 78, 184, 0.35)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {isDispatching ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Dispatching to {selectedRecipients.length} Employees...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Send Microsoft Teams Invitation ({selectedRecipients.length})</span>
                </>
              )}
            </button>
          </div>

          {/* Past Dispatched Sessions Audit */}
          {history.length > 0 && (
            <div style={{ background: '#ffffff', padding: '20px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>
                  Recent Dispatched Training Sessions
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsHistoryModalOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #c7d2fe',
                      background: '#eef2ff',
                      color: '#4338ca',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="View all dispatched training sessions"
                  >
                    <Eye size={13} />
                    <span>View All ({history.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Clear recent session history"
                  >
                    <Trash2 size={13} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(showAllInline ? history : history.slice(0, 4)).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.title}</div>
                      <div style={{ color: '#64748b' }}>
                        {item.date} • {item.recipientsCount} Attendees • Trainer: {item.trainerName}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: item.status === 'SUCCESS' ? '#dcfce7' : '#fef3c7',
                        color: item.status === 'SUCCESS' ? '#166534' : '#854d0e'
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              {history.length > 4 && (
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowAllInline(!showAllInline)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4f46e5',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '4px 8px'
                    }}
                  >
                    {showAllInline ? 'Show Less' : `+ Show ${history.length - 4} more inline`}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      <TrainingTeamsConfigModal
        isOpen={isTeamsModalOpen}
        onClose={() => {
          setIsTeamsModalOpen(false);
          setTeamsConfig(getTrainingTeamsConfig());
        }}
        onConfigSaved={(cfg) => {
          setTeamsConfig(cfg);
          if (cfg?.customMeetingLink) setMeetingLink(cfg.customMeetingLink);
          if (cfg?.defaultTrainerName) setTrainerName(cfg.defaultTrainerName);
          if (cfg?.defaultSenderName) setCustomSenderName(cfg.defaultSenderName);
        }}
      />

      <RecruitmentGoogleConfigModal
        isOpen={isMailModalOpen}
        onClose={() => {
          setIsMailModalOpen(false);
          setMailConfig(getGoogleMailConfig());
        }}
        onConfigSaved={(cfg) => {
          setMailConfig(cfg);
        }}
      />

      {/* Live Email Preview Modal */}
      {isPreviewOpen && (
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
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  Live Employee Email Preview
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Personalized for selected employee
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Email Body Simulation */}
            <div style={{ padding: '24px', overflowY: 'auto', background: '#f1f5f9', flex: 1 }}>
              <div style={{ background: '#ffffff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg, #464EB8 0%, #33399b 100%)', padding: '28px 24px', textAlign: 'center', color: '#ffffff' }}>
                  <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>
                    Microsoft Teams Training Session
                  </div>
                  <h2 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: '#ffffff' }}>{trainingTitle}</h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#e0e7ff' }}>Organized by {customSenderName}</p>
                </div>

                <div style={{ padding: '24px', fontSize: '0.875rem', color: '#334155', lineHeight: 1.6 }}>
                  <p style={{ fontWeight: 600, color: '#0f172a', margin: '0 0 12px 0' }}>
                    Dear {selectedRecipients[0]?.name || 'Alex Morgan'},
                  </p>
                  <p style={{ margin: '0 0 16px 0', color: '#475569' }}>
                    You have been selected to attend the upcoming official training session on <strong>Microsoft Teams</strong>. Please review the details below and ensure you are available on time.
                  </p>

                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                    <div style={{ marginBottom: '8px' }}><strong>📅 Date:</strong> {trainingDate}</div>
                    <div style={{ marginBottom: '8px' }}><strong>⏰ Time:</strong> {trainingTime} ({duration})</div>
                    <div style={{ marginBottom: '8px' }}><strong>👨‍🏫 Trainer / Lead:</strong> {trainerName}</div>
                    {meetingId && <div style={{ marginBottom: '8px' }}><strong>🔑 Meeting ID:</strong> <code>{meetingId}</code></div>}
                    {passcode && <div><strong>🔒 Passcode:</strong> <code>{passcode}</code></div>}
                  </div>

                  <div style={{ textAlign: 'center', margin: '24px 0' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        background: '#464EB8',
                        color: '#ffffff',
                        padding: '12px 28px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        boxShadow: '0 4px 12px rgba(70, 78, 184, 0.3)'
                      }}
                    >
                      👉 Click to Join Microsoft Teams Meeting
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '8px', wordBreak: 'break-all' }}>
                      {meetingLink || 'https://teams.microsoft.com/l/meetup-join/...'}
                    </div>
                  </div>

                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>Session Agenda:</div>
                  <div style={{ background: '#f1f5f9', borderLeft: '4px solid #464EB8', padding: '10px 14px', borderRadius: '0 6px 6px 0', whiteSpace: 'pre-wrap', marginBottom: '16px', fontSize: '0.82rem' }}>
                    {agenda}
                  </div>

                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 20px 0' }}>
                    {instructions}
                  </p>

                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    Warm regards,<br />
                    <strong>{trainerName}</strong><br />
                    <em>{customSenderName}</em>
                  </p>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Employee Group Modal */}
      {isCreateGroupOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setIsCreateGroupOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Create Employee Group
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Group employees together for 1-click selection during training scheduling.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateGroupOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                
                {/* Group Name & Description */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Group Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., GIS Surveyors Batch 1"
                      value={groupFormName}
                      onChange={(e) => setGroupFormName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem'
                      }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '5px' }}>
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Technical onboarding team"
                      value={groupFormDescription}
                      onChange={(e) => setGroupFormDescription(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>
                </div>

                {/* Quick Helper if Roster has selections */}
                {selectedEmpIds.size > 0 && (
                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 500 }}>
                      💡 You currently have <strong>{selectedEmpIds.size} employees</strong> checked in the training roster.
                    </div>
                    <button
                      type="button"
                      onClick={() => setGroupFormMemberIds(new Set(selectedEmpIds))}
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Use Active Selection ({selectedEmpIds.size})
                    </button>
                  </div>
                )}

                {/* Member Selection Controls */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                      Select Group Members ({groupFormMemberIds.size} selected)
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleSelectAllInModal}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#4f46e5',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Select All Filtered ({modalFilteredEmployees.length})
                      </button>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAllInModal}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Deselect Filtered
                      </button>
                    </div>
                  </div>

                  {/* Filter controls */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Filter employees by name, email, code..."
                        value={groupFormSearch}
                        onChange={(e) => setGroupFormSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px 6px 30px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.78rem'
                        }}
                      />
                    </div>
                    <select
                      value={groupFormDept}
                      onChange={(e) => setGroupFormDept(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.78rem',
                        background: '#ffffff',
                        color: '#334155',
                        fontWeight: 500
                      }}
                    >
                      <option value="ALL">All Departments</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Employee List */}
                  <div
                    style={{
                      maxHeight: '260px',
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      padding: '4px'
                    }}
                  >
                    {modalFilteredEmployees.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                        No employees match the filter.
                      </div>
                    ) : (
                      modalFilteredEmployees.map((emp) => {
                        const isChecked = groupFormMemberIds.has(emp.id);
                        return (
                          <div
                            key={emp.id}
                            onClick={() => handleToggleGroupMember(emp.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              background: isChecked ? '#eef2ff' : '#ffffff',
                              border: isChecked ? '1px solid #c7d2fe' : '1px solid #f1f5f9',
                              marginBottom: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.1s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                style={{ accentColor: '#4f46e5', cursor: 'pointer' }}
                              />
                              <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                                  {emp.firstName} {emp.lastName}
                                  {emp.employeeCode && (
                                    <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                                      ({emp.employeeCode})
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {emp.email}
                                </div>
                              </div>
                            </div>
                            {emp.department?.name && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  background: '#f1f5f9',
                                  color: '#475569'
                                }}
                              >
                                {emp.department.name}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '14px 24px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  <strong>{groupFormMemberIds.size}</strong> employees selected
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateGroupOpen(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#4f46e5',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
                    }}
                  >
                    <Check size={14} />
                    <span>Save Group ({groupFormMemberIds.size})</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View All Dispatched Training Sessions Modal */}
      {isHistoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setIsHistoryModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '840px',
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                    Dispatched Training Sessions History
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Full audit history of {history.length} dispatched training invitation(s).
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#b91c1c',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} />
                  <span>Clear All</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search Filter in Modal */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter past sessions by title, trainer, date, or status..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem'
                  }}
                />
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredHistory.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  {historySearchQuery ? 'No dispatched sessions match your search filter.' : 'No dispatched training sessions recorded yet.'}
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                        {item.title}
                      </div>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: item.status === 'SUCCESS' ? '#dcfce7' : '#fef3c7',
                          color: item.status === 'SUCCESS' ? '#166534' : '#854d0e'
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.78rem', color: '#475569' }}>
                      <div>📅 <strong>Date:</strong> {item.date} ({item.time})</div>
                      <div>👨‍🏫 <strong>Trainer:</strong> {item.trainerName}</div>
                      <div>👥 <strong>Recipients:</strong> {item.recipientsCount} employee(s)</div>
                      <div>🕒 <strong>Sent At:</strong> {item.sentAt}</div>
                    </div>

                    {item.meetingLink && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.74rem' }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Teams Link:</span>
                        <span style={{ color: '#4338ca', wordBreak: 'break-all', flex: 1 }}>{item.meetingLink}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(item.meetingLink);
                            alert('Meeting link copied to clipboard!');
                          }}
                          style={{
                            background: '#eef2ff',
                            border: '1px solid #c7d2fe',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            color: '#4338ca',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600
                          }}
                        >
                          <Copy size={11} />
                          <span>Copy</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 24px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                Showing <strong>{filteredHistory.length}</strong> of <strong>{history.length}</strong> dispatched session(s)
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
