export type TeamsMode = 'custom' | 'azure' | 'auto';

export interface TeamsConfig {
  mode: TeamsMode;
  customMeetingLink: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  azureUserId?: string;
  enabled: boolean;
  lastUpdated?: string;
}

const STORAGE_KEY = 'hrms_recruitment_teams_config';

export function getTeamsConfig(): TeamsConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.mode === 'string') {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse Teams config from localStorage:', e);
  }
  return null;
}

export function saveTeamsConfig(config: TeamsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...config,
      customMeetingLink: (config.customMeetingLink || '').trim(),
      azureTenantId: (config.azureTenantId || '').trim(),
      azureClientId: (config.azureClientId || '').trim(),
      azureClientSecret: (config.azureClientSecret || '').trim(),
      azureUserId: (config.azureUserId || '').trim(),
      lastUpdated: new Date().toISOString()
    }));
  } catch (e) {
    console.error('Failed to save Teams config to localStorage:', e);
  }
}

export function clearTeamsConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to remove Teams config from localStorage:', e);
  }
}

export function isTeamsConfigured(): boolean {
  const config = getTeamsConfig();
  if (!config || !config.enabled) return false;
  if (config.mode === 'custom') {
    return Boolean(config.customMeetingLink && config.customMeetingLink.trim().length > 8);
  }
  if (config.mode === 'azure') {
    return Boolean(config.azureTenantId && config.azureClientId && config.azureClientSecret && config.azureUserId);
  }
  return true;
}
