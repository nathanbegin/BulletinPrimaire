/** Configuration de l'IA, sans dépendance au SDK (chargé à la demande). */
export const AI_MODEL = 'claude-opus-5-5';
const AI_STORAGE_KEY = 'bulletin-ai';

export interface AIConfig {
  apiKey: string;
  /** Adresse d'un serveur relais (facultatif). */
  baseURL: string;
}

export function loadAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (raw) return { apiKey: '', baseURL: '', ...JSON.parse(raw) };
  } catch {
    /* stockage indisponible */
  }
  return { apiKey: '', baseURL: '' };
}

export function saveAIConfig(c: AIConfig) {
  try {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* stockage indisponible */
  }
}

export function aiConfigured(c = loadAIConfig()): boolean {
  return !!(c.apiKey.trim() || c.baseURL.trim());
}

