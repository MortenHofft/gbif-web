import fs from 'node:fs/promises';
import path from 'node:path';

export interface ShotMeta {
  id: string;
  label: string;
  url: string;
  viewport: { width: number; height: number };
  setup: string | null;
  before: string;
  after: string;
}

export interface FileMeta {
  path: string;
  additions: number;
  deletions: number;
}

export interface ProposalMeta {
  id: string;
  title: string;
  rationale: string;
  createdAt: string;
  author: string;
  baseSha: string;
  baseBranch: string;
  tags: string[];
  patch: string;
  files: FileMeta[];
  shots: ShotMeta[];
}

export type ProposalState =
  | 'pending'
  | 'approved'
  | 'applied'
  | 'rejected'
  | 'conflicted'
  | 'superseded';

export interface ProposalStatus {
  state: ProposalState;
  decidedAt: string | null;
  appliedAt: string | null;
  conflict: { files: string[]; strategy: string } | null;
  notes: string;
}

export interface Proposal {
  meta: ProposalMeta;
  status: ProposalStatus;
  dir: string;
}

const DEFAULT_STATUS: ProposalStatus = {
  state: 'pending',
  decidedAt: null,
  appliedAt: null,
  conflict: null,
  notes: '',
};

export function proposalsDir(repoRoot: string): string {
  return path.join(repoRoot, '.review', 'proposals');
}

export async function listProposals(repoRoot: string): Promise<Proposal[]> {
  const root = proposalsDir(repoRoot);
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }
  const proposals: Proposal[] = [];
  for (const entry of entries) {
    const dir = path.join(root, entry);
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const p = await readProposal(dir).catch(() => null);
    if (p) proposals.push(p);
  }
  proposals.sort((a, b) => a.meta.id.localeCompare(b.meta.id));
  return proposals;
}

export async function readProposal(dir: string): Promise<Proposal> {
  const metaRaw = await fs.readFile(path.join(dir, 'meta.json'), 'utf8');
  const meta = JSON.parse(metaRaw) as ProposalMeta;
  let status: ProposalStatus = { ...DEFAULT_STATUS };
  try {
    const statusRaw = await fs.readFile(path.join(dir, 'status.json'), 'utf8');
    status = { ...DEFAULT_STATUS, ...JSON.parse(statusRaw) };
  } catch {
    // status.json may not exist yet
  }
  return { meta, status, dir };
}

export async function writeStatus(dir: string, status: ProposalStatus): Promise<void> {
  await fs.writeFile(path.join(dir, 'status.json'), JSON.stringify(status, null, 2) + '\n');
}

export async function findProposalDir(repoRoot: string, id: string): Promise<string | null> {
  const root = proposalsDir(repoRoot);
  const dir = path.join(root, id);
  const stat = await fs.stat(dir).catch(() => null);
  if (stat?.isDirectory()) return dir;
  // Fallback: search by id in meta.json (in case dir name diverges)
  const entries = await fs.readdir(root).catch(() => []);
  for (const entry of entries) {
    const candidate = path.join(root, entry);
    try {
      const meta = JSON.parse(await fs.readFile(path.join(candidate, 'meta.json'), 'utf8'));
      if (meta.id === id) return candidate;
    } catch {
      // skip
    }
  }
  return null;
}
