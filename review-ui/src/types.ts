export interface Shot {
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
  shots: Shot[];
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

export interface RepoStatus {
  head: string;
  dirty: string[];
  repoRoot: string;
}
