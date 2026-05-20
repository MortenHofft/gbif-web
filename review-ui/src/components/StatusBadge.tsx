import type { ProposalState } from '../types';

export function StatusBadge({ state }: { state: ProposalState }) {
  return <span className={`badge state-${state}`}>{state}</span>;
}
