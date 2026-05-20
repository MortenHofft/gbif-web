import type { Proposal } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  proposals: Proposal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProposalList({ proposals, selectedId, onSelect }: Props) {
  return (
    <ul className="proposal-list">
      {proposals.map((p) => {
        const adds = p.meta.files.reduce((s, f) => s + f.additions, 0);
        const dels = p.meta.files.reduce((s, f) => s + f.deletions, 0);
        const topDirs = uniqueTopDirs(p.meta.files.map((f) => f.path));
        return (
          <li
            key={p.meta.id}
            className={p.meta.id === selectedId ? 'selected' : ''}
            onClick={() => onSelect(p.meta.id)}
          >
            <div className="row1">
              <StatusBadge state={p.status.state} />
              <span className="title">{p.meta.title}</span>
            </div>
            <div className="row2">
              <span className="id">{p.meta.id}</span>
              <span className="counts">
                <span className="add">+{adds}</span>
                <span className="del">−{dels}</span>
                <span className="files">{p.meta.files.length}f</span>
                <span className="shots">{p.meta.shots.length}📷</span>
              </span>
            </div>
            <div className="row3">
              {topDirs.slice(0, 3).map((d) => (
                <span key={d} className="dir">{d}</span>
              ))}
              {topDirs.length > 3 && <span className="dir more">+{topDirs.length - 3}</span>}
            </div>
            {p.meta.tags.length > 0 && (
              <div className="row4">
                {p.meta.tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function uniqueTopDirs(paths: string[]): string[] {
  const dirs = new Set<string>();
  for (const p of paths) {
    const parts = p.split('/');
    // Use first 3 segments as a "scope" hint.
    dirs.add(parts.slice(0, Math.min(3, parts.length - 1)).join('/'));
  }
  return Array.from(dirs);
}
