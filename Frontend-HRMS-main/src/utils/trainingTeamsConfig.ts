export type TrainingTeamsMode = 'custom' | 'azure' | 'auto';

export interface TrainingTeamsConfig {
  mode: TrainingTeamsMode;
  customMeetingLink: string;
  defaultTrainerName?: string;
  defaultSenderName?: string;
  defaultMeetingId?: string;
  defaultPasscode?: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  azureUserId?: string;
  enabled: boolean;
  lastUpdated?: string;
}

const STORAGE_KEY = 'hrms_training_teams_config';

export function getTrainingTeamsConfig(): TrainingTeamsConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.mode === 'string') {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse Training Teams config from localStorage:', e);
  }
  return null;
}

export function saveTrainingTeamsConfig(config: TrainingTeamsConfig): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...config,
        customMeetingLink: (config.customMeetingLink || '').trim(),
        defaultTrainerName: (config.defaultTrainerName || '').trim(),
        defaultSenderName: (config.defaultSenderName || '').trim(),
        defaultMeetingId: (config.defaultMeetingId || '').trim(),
        defaultPasscode: (config.defaultPasscode || '').trim(),
        azureTenantId: (config.azureTenantId || '').trim(),
        azureClientId: (config.azureClientId || '').trim(),
        azureClientSecret: (config.azureClientSecret || '').trim(),
        azureUserId: (config.azureUserId || '').trim(),
        lastUpdated: new Date().toISOString()
      })
    );
  } catch (e) {
    console.error('Failed to save Training Teams config to localStorage:', e);
  }
}

export function clearTrainingTeamsConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to remove Training Teams config from localStorage:', e);
  }
}

export function isTrainingTeamsConfigured(): boolean {
  const config = getTrainingTeamsConfig();
  if (!config || !config.enabled) return false;
  if (config.mode === 'custom') {
    return Boolean(config.customMeetingLink && config.customMeetingLink.trim().length > 8);
  }
  if (config.mode === 'azure') {
    return Boolean(
      config.azureTenantId &&
      config.azureClientId &&
      config.azureClientSecret &&
      config.azureUserId
    );
  }
  return true;
}
