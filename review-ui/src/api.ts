import type { Proposal, RepoStatus } from './types';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export const api = {
  listProposals: () => jsonFetch<Proposal[]>('/api/proposals'),
  getProposal: (id: string) => jsonFetch<Proposal>(`/api/proposals/${id}`),
  getPatch: async (id: string): Promise<string> => {
    const res = await fetch(`/api/proposals/${id}/patch`);
    if (!res.ok) throw new Error(await res.text());
    return res.text();
  },
  approve: (id: string) =>
    jsonFetch<{ status: any; result: any }>(`/api/proposals/${id}/approve`, { method: 'POST' }),
  reject: (id: string, notes?: string) =>
    jsonFetch<{ status: any }>(`/api/proposals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  regenerate: (id: string, notes?: string) =>
    jsonFetch<{ status: any }>(`/api/proposals/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  reset: (id: string) =>
    jsonFetch<{ status: any }>(`/api/proposals/${id}/reset`, { method: 'POST' }),
  getStatus: () => jsonFetch<RepoStatus>('/api/status'),
};

export function shotUrl(proposalId: string, relativePath: string): string {
  return `/shots/${proposalId}/${relativePath}`;
}
