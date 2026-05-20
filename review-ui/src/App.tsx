import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Proposal, RepoStatus } from './types';
import { ProposalList } from './components/ProposalList';
import { ProposalDetail } from './components/ProposalDetail';
import { Filters, FilterState } from './components/Filters';

export function App() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [repoStatus, setRepoStatus] = useState<RepoStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({
    states: new Set(['pending', 'conflicted']),
    pathQuery: '',
    tag: '',
    sort: 'newest',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, status] = await Promise.all([api.listProposals(), api.getStatus()]);
      setProposals(list);
      setRepoStatus(status);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    let out = proposals.filter((p) => {
      if (filter.states.size > 0 && !filter.states.has(p.status.state)) return false;
      if (filter.pathQuery) {
        const q = filter.pathQuery.toLowerCase();
        if (!p.meta.files.some((f) => f.path.toLowerCase().includes(q))) return false;
      }
      if (filter.tag && !p.meta.tags.includes(filter.tag)) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (filter.sort) {
        case 'newest':
          return b.meta.createdAt.localeCompare(a.meta.createdAt);
        case 'oldest':
          return a.meta.createdAt.localeCompare(b.meta.createdAt);
        case 'smallest':
          return totalChanges(a) - totalChanges(b);
        case 'largest':
          return totalChanges(b) - totalChanges(a);
        default:
          return 0;
      }
    });
    return out;
  }, [proposals, filter]);

  const selected = useMemo(
    () => filtered.find((p) => p.meta.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    proposals.forEach((p) => p.meta.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [proposals]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const idx = filtered.findIndex((p) => p.meta.id === selected?.meta.id);
      if (e.key === 'j' && idx < filtered.length - 1) {
        setSelectedId(filtered[idx + 1].meta.id);
      } else if (e.key === 'k' && idx > 0) {
        setSelectedId(filtered[idx - 1].meta.id);
      } else if (e.key === 'a' && selected) {
        void handleApprove(selected.meta.id);
      } else if (e.key === 'r' && selected) {
        void handleReject(selected.meta.id);
      } else if (e.key === 'g' && selected) {
        void handleRegenerate(selected.meta.id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, selected]);

  async function handleApprove(id: string) {
    try {
      const { result } = await api.approve(id);
      if (result.ok) {
        toast(`Applied ${id}`);
      } else if (result.conflictFiles) {
        toast(`Conflict in ${result.conflictFiles.length} file(s) — resolve in editor`);
      } else {
        toast(`Apply failed: ${result.error || 'unknown'}`);
      }
      await refresh();
    } catch (e: any) {
      toast(`Error: ${e.message}`);
    }
  }

  async function handleReject(id: string) {
    try {
      await api.reject(id);
      toast(`Rejected ${id}`);
      await refresh();
    } catch (e: any) {
      toast(`Error: ${e.message}`);
    }
  }

  async function handleRegenerate(id: string) {
    try {
      await api.regenerate(id);
      toast(`Marked superseded — ask Claude to regenerate against HEAD`);
      await refresh();
    } catch (e: any) {
      toast(`Error: ${e.message}`);
    }
  }

  async function handleReset(id: string) {
    try {
      await api.reset(id);
      toast(`Reset ${id} to pending`);
      await refresh();
    } catch (e: any) {
      toast(`Error: ${e.message}`);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Change Review</div>
        <div className="repo-status">
          {repoStatus && (
            <>
              <span>HEAD <code>{repoStatus.head.slice(0, 8)}</code></span>
              <span className={repoStatus.dirty.length ? 'dirty' : 'clean'}>
                {repoStatus.dirty.length ? `${repoStatus.dirty.length} dirty file(s)` : 'clean tree'}
              </span>
            </>
          )}
          <button onClick={refresh}>Refresh</button>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      <div className="layout">
        <aside className="sidebar">
          <Filters filter={filter} onChange={setFilter} allTags={allTags} />
          <ProposalList
            proposals={filtered}
            selectedId={selected?.meta.id ?? null}
            onSelect={setSelectedId}
          />
        </aside>
        <main className="detail">
          {loading && <div className="empty">Loading…</div>}
          {!loading && !selected && (
            <div className="empty">
              No proposals match the current filters.
              <br />
              <small>Create proposals in <code>.review/proposals/</code> — see README.</small>
            </div>
          )}
          {selected && (
            <ProposalDetail
              proposal={selected}
              onApprove={() => handleApprove(selected.meta.id)}
              onReject={() => handleReject(selected.meta.id)}
              onRegenerate={() => handleRegenerate(selected.meta.id)}
              onReset={() => handleReset(selected.meta.id)}
            />
          )}
        </main>
      </div>
      <div id="toast-root" />
    </div>
  );
}

function totalChanges(p: Proposal): number {
  return p.meta.files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(msg: string) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  root.textContent = msg;
  root.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => root.classList.remove('show'), 3000);
}
