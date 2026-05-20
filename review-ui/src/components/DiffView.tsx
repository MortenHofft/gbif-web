import { useEffect, useState } from 'react';
import { api } from '../api';

interface Props {
  proposalId: string;
}

export function DiffView({ proposalId }: Props) {
  const [patch, setPatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPatch(null);
    setError(null);
    api.getPatch(proposalId).then(setPatch).catch((e) => setError(e.message));
  }, [proposalId]);

  if (error) return <div className="error">{error}</div>;
  if (!patch) return <div className="empty">Loading diff…</div>;

  return <pre className="diff">{renderDiff(patch)}</pre>;
}

function renderDiff(patch: string) {
  return patch.split('\n').map((line, i) => {
    let cls = '';
    if (line.startsWith('+++') || line.startsWith('---')) cls = 'diff-file';
    else if (line.startsWith('@@')) cls = 'diff-hunk';
    else if (line.startsWith('+')) cls = 'diff-add';
    else if (line.startsWith('-')) cls = 'diff-del';
    else if (line.startsWith('diff --git')) cls = 'diff-git';
    return (
      <span key={i} className={cls}>
        {line}
        {'\n'}
      </span>
    );
  });
}
