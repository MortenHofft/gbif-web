import type { ProposalState } from '../types';

export interface FilterState {
  states: Set<ProposalState>;
  pathQuery: string;
  tag: string;
  sort: 'newest' | 'oldest' | 'smallest' | 'largest';
}

const ALL_STATES: ProposalState[] = [
  'pending',
  'conflicted',
  'applied',
  'rejected',
  'superseded',
];

interface Props {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  allTags: string[];
}

export function Filters({ filter, onChange, allTags }: Props) {
  function toggleState(s: ProposalState) {
    const next = new Set(filter.states);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({ ...filter, states: next });
  }
  return (
    <div className="filters">
      <div className="filter-row">
        <input
          type="search"
          placeholder="Filter by path…"
          value={filter.pathQuery}
          onChange={(e) => onChange({ ...filter, pathQuery: e.target.value })}
        />
      </div>
      <div className="filter-row chips">
        {ALL_STATES.map((s) => (
          <button
            key={s}
            className={`chip state-${s} ${filter.states.has(s) ? 'on' : ''}`}
            onClick={() => toggleState(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <select
          value={filter.tag}
          onChange={(e) => onChange({ ...filter, tag: e.target.value })}
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filter.sort}
          onChange={(e) => onChange({ ...filter, sort: e.target.value as FilterState['sort'] })}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="smallest">Smallest patch</option>
          <option value="largest">Largest patch</option>
        </select>
      </div>
    </div>
  );
}
