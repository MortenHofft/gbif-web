import { useState } from 'react';
import type { Proposal } from '../types';
import { ScreenshotPair } from './ScreenshotPair';
import { DiffView } from './DiffView';
import { StatusBadge } from './StatusBadge';

interface Props {
  proposal: Proposal;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  onReset: () => void;
}

export function ProposalDetail({ proposal, onApprove, onReject, onRegenerate, onReset }: Props) {
  const [showDiff, setShowDiff] = useState(false);
  const { meta, status } = proposal;
  const totalAdds = meta.files.reduce((s, f) => s + f.additions, 0);
  const totalDels = meta.files.reduce((s, f) => s + f.deletions, 0);

  return (
    <article className="proposal-detail">
      <header>
        <div className="title-row">
          <h1>{meta.title}</h1>
          <StatusBadge state={status.state} />
        </div>
        <div className="sub">
          <code>{meta.id}</code>
          <span> · base <code>{meta.baseSha.slice(0, 8)}</code> ({meta.baseBranch})</span>
          <span> · by {meta.author}</span>
          <span> · {new Date(meta.createdAt).toLocaleString()}</span>
        </div>
        {meta.tags.length > 0 && (
          <div className="tags">
            {meta.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
        )}
      </header>

      {status.state === 'conflicted' && status.conflict && (
        <div className="banner banner-conflict">
          <strong>Conflict</strong> — 3-way merge left conflict markers in:
          <ul>
            {status.conflict.files.map((f) => <li key={f}><code>{f}</code></li>)}
          </ul>
          Resolve them in your editor and remove the markers. The patch is partially applied.
        </div>
      )}

      {status.state === 'applied' && (
        <div className="banner banner-applied">
          Applied to working tree at {status.appliedAt && new Date(status.appliedAt).toLocaleString()}.
          Review with HMR, then commit when ready.
        </div>
      )}

      {status.state === 'rejected' && (
        <div className="banner banner-rejected">Rejected{status.notes && ` — ${status.notes}`}</div>
      )}

      {status.state === 'superseded' && (
        <div className="banner banner-superseded">Marked superseded — regenerate this proposal against current HEAD.</div>
      )}

      <section className="rationale">
        <h2>Rationale</h2>
        <p>{meta.rationale}</p>
      </section>

      <section className="actions">
        <button className="approve" onClick={onApprove} disabled={status.state === 'applied' || status.state === 'conflicted'}>
          Approve & apply <kbd>a</kbd>
        </button>
        <button className="reject" onClick={onReject} disabled={status.state === 'rejected'}>
          Reject <kbd>r</kbd>
        </button>
        <button className="regen" onClick={onRegenerate}>
          Mark superseded <kbd>g</kbd>
        </button>
        {(status.state === 'rejected' || status.state === 'superseded' || status.state === 'conflicted') && (
          <button onClick={onReset}>Reset to pending</button>
        )}
      </section>

      <section className="files">
        <h2>Files changed ({meta.files.length} · <span className="add">+{totalAdds}</span> <span className="del">−{totalDels}</span>)</h2>
        <ul>
          {meta.files.map((f) => (
            <li key={f.path}>
              <code>{f.path}</code>
              <span className="counts">
                <span className="add">+{f.additions}</span>
                <span className="del">−{f.deletions}</span>
              </span>
            </li>
          ))}
        </ul>
        <button className="toggle-diff" onClick={() => setShowDiff(!showDiff)}>
          {showDiff ? 'Hide' : 'Show'} unified diff
        </button>
        {showDiff && <DiffView proposalId={meta.id} />}
      </section>

      <section className="shots">
        <h2>Screenshots ({meta.shots.length})</h2>
        {meta.shots.length === 0 && <p className="empty">No screenshots in this proposal.</p>}
        {meta.shots.map((s) => (
          <ScreenshotPair key={s.id} shot={s} proposalId={meta.id} />
        ))}
      </section>
    </article>
  );
}
