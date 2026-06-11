import {
  EsHealthResult,
  HealthResult,
  PoolSettings,
  Settings,
  SettingsResult,
} from './types';

// A partial update: any subset of fields, at any depth, may be sent.
export type SettingsPatch = {
  logLevel?: string;
  overload?: Partial<Settings['overload']>;
  pools?: Record<string, Partial<PoolSettings>>;
};

// All calls go to the gbif-org server's /api/admin/* endpoints, which gate on
// the session cookie and fan out to the GraphQL instances. The browser never
// talks to the instances directly. A 404 here means "not authorised" (the
// surface is hidden), which we surface as a dedicated error so the UI can hide.

export class NotAuthorisedError extends Error {
  constructor() {
    super('Not authorised');
    this.name = 'NotAuthorisedError';
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (response.status === 404) throw new NotAuthorisedError();
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function fetchNodes(): Promise<{ nodes: { label: string; url: string }[] }> {
  return getJson('/api/admin/nodes');
}

export function fetchHealth(): Promise<{ results: HealthResult[] }> {
  return getJson('/api/admin/health');
}

export function fetchEsHealth(): Promise<{ results: EsHealthResult[] }> {
  return getJson('/api/admin/es-health');
}

export function fetchSettings(): Promise<{ results: SettingsResult[] }> {
  return getJson('/api/admin/settings');
}

export async function applySettings(
  settings: SettingsPatch,
  targets?: string[]
): Promise<{ results: SettingsResult[] }> {
  const response = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ settings, targets }),
  });
  if (response.status === 404) throw new NotAuthorisedError();
  if (!response.ok) throw new Error(`Update failed (${response.status})`);
  return response.json() as Promise<{ results: SettingsResult[] }>;
}
