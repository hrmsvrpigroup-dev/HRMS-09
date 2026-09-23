export interface GoogleMailConfig {
  email: string;
  appPassword: string;
  senderName: string;
  enabled: boolean;
  interviewAutoEmail?: boolean;
  documentsAutoEmail?: boolean;
  callLetterAutoEmail?: boolean;
  offerLetterAutoEmail?: boolean;
  lastUpdated?: string;
}

const STORAGE_KEY = 'hrms_recruitment_gmail_config';

export function getGoogleMailConfig(): GoogleMailConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string' && parsed.email.includes('@')) {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse Google Mail config from localStorage:', e);
  }
  return null;
}

export function saveGoogleMailConfig(config: GoogleMailConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...config,
      appPassword: config.appPassword.replace(/\s+/g, ''),
      lastUpdated: new Date().toISOString()
    }));
  } catch (e) {
    console.error('Failed to save Google Mail config to localStorage:', e);
  }
}

export function clearGoogleMailConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to remove Google Mail config from localStorage:', e);
  }
}

export function isGoogleMailConfigured(): boolean {
  const config = getGoogleMailConfig();
  return Boolean(config && config.enabled && config.email && config.appPassword);
}
