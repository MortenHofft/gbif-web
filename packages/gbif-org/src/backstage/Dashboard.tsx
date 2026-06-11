import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applySettings,
  fetchHealth,
  fetchSettings,
  NotAuthorisedError,
  SettingsPatch,
} from './api';
import { HealthResult, Settings, SettingsResult } from './types';

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

// -1 is the wire value for "unbounded"; show it as ∞ for readability.
function fmtLimit(n: number | undefined): string {
  if (n === undefined || n === null) return '—';
  return n < 0 ? '∞' : String(n);
}

function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="g-flex g-flex-col">
      <span className="g-text-[11px] g-uppercase g-tracking-wide g-text-zinc-500">{label}</span>
      <span className={`g-text-sm g-tabular-nums ${warn ? 'g-text-amber-400' : 'g-text-zinc-100'}`}>
        {value}
      </span>
    </div>
  );
}

function HealthCard({ result }: { result: HealthResult }) {
  if (!result.ok || !result.health) {
    return (
      <div className="g-rounded-lg g-border g-border-red-900/60 g-bg-red-950/30 g-p-4">
        <div className="g-font-medium g-text-red-300">{result.node}</div>
        <div className="g-mt-1 g-text-xs g-text-red-400 g-break-all">
          unreachable{result.status ? ` (${result.status})` : ''}
        </div>
      </div>
    );
  }
  const h = result.health;
  const o = h.overload ?? {};
  const pools = h.requestPools ?? {};
  return (
    <div className="g-rounded-lg g-border g-border-zinc-800 g-bg-zinc-950 g-p-4">
      <div className="g-flex g-items-center g-justify-between">
        <div className="g-font-medium g-text-zinc-100">{result.node}</div>
        <span
          className={`g-text-[11px] g-rounded g-px-1.5 g-py-0.5 ${
            o.enabled ? 'g-bg-emerald-900/50 g-text-emerald-300' : 'g-bg-zinc-800 g-text-zinc-400'
          }`}
        >
          guard {o.enabled ? 'on' : 'off'}
        </span>
      </div>
      <div className="g-mt-3 g-grid g-grid-cols-3 g-gap-3">
        <Stat label="uptime" value={`${h.uptimeSeconds ?? '—'}s`} />
        <Stat label="inflight" value={h.inflight ?? o.inflight ?? '—'} />
        <Stat label="heap" value={`${o.heapUsedPercent ?? '—'}%`} warn={(o.heapUsedPercent ?? 0) > 80} />
        <Stat label="loop ms" value={o.eventLoopDelayMs ?? '—'} />
        <Stat label="loop max" value={o.eventLoopDelayMaxMs ?? '—'} />
        <Stat
          label="loop peak"
          value={o.peakEventLoopDelayMs ?? '—'}
          warn={(o.peakEventLoopDelayMs ?? 0) > 1000}
        />
      </div>
      <div className="g-mt-3 g-border-t g-border-zinc-800 g-pt-2">
        <div className="g-text-[11px] g-uppercase g-tracking-wide g-text-zinc-500 g-mb-1">pools</div>
        <table className="g-w-full g-text-xs g-tabular-nums">
          <thead>
            <tr className="g-text-zinc-500">
              <th className="g-text-left g-font-normal">pool</th>
              <th className="g-text-right g-font-normal">wait</th>
              <th className="g-text-right g-font-normal">run</th>
              <th className="g-text-right g-font-normal">conc</th>
              <th className="g-text-right g-font-normal">rej</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(pools).map(([name, p]) => (
              <tr key={name} className="g-text-zinc-300">
                <td className="g-text-left g-text-zinc-400">{name}</td>
                <td className="g-text-right" >{p.waiting}</td>
                <td className="g-text-right">{p.running}</td>
                <td className="g-text-right">{fmtLimit(p.concurrencyLimit)}</td>
                <td className={`g-text-right ${p.rejected > 0 ? 'g-text-amber-400' : ''}`}>
                  {p.rejected}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {h.nagiosString && (
        <div className="g-mt-2 g-text-[10px] g-text-zinc-600 g-break-words">{h.nagiosString}</div>
      )}
    </div>
  );
}

// Numeric input that maps to a settings field. Empty string is treated as "no
// change" by the caller (kept out of the payload).
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="g-flex g-flex-col g-gap-1">
      <span className="g-text-[11px] g-uppercase g-tracking-wide g-text-zinc-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="g-w-full g-rounded g-border g-border-zinc-700 g-bg-zinc-900 g-px-2 g-py-1 g-text-sm g-text-zinc-100 focus:g-border-amber-500 focus:g-outline-none"
      />
    </label>
  );
}

type FormState = {
  logLevel: string;
  overload: Record<string, string>;
  pools: Record<string, Record<string, string>>;
};

function settingsToForm(s: Settings): FormState {
  return {
    logLevel: s.logLevel,
    overload: {
      maxEventLoopDelayMs: String(s.overload.maxEventLoopDelayMs),
      maxInFlight: String(s.overload.maxInFlight),
      maxHeapUsedFraction: String(s.overload.maxHeapUsedFraction),
      retryAfterSeconds: String(s.overload.retryAfterSeconds),
    },
    pools: Object.fromEntries(
      Object.entries(s.pools).map(([name, p]) => [
        name,
        {
          concurrency: String(p.concurrency),
          maxQueueDepth: String(p.maxQueueDepth),
          timeoutMs: String(p.timeoutMs),
          perRequestConcurrency: String(p.perRequestConcurrency),
        },
      ])
    ),
  };
}

// Build the settings payload from form state. Only well-formed numbers are
// included; blanks are dropped so they are left unchanged.
function formToSettings(form: FormState, enabled: boolean): SettingsPatch {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const overload: SettingsPatch['overload'] = { enabled };
  Object.entries(form.overload).forEach(([k, v]) => {
    const n = num(v);
    if (n !== undefined && Number.isFinite(n)) {
      (overload as Record<string, number | boolean>)[k] = n;
    }
  });
  const pools: NonNullable<SettingsPatch['pools']> = {};
  Object.entries(form.pools).forEach(([name, fields]) => {
    const out: Record<string, number> = {};
    Object.entries(fields).forEach(([k, v]) => {
      const n = num(v);
      if (n !== undefined && Number.isFinite(n)) out[k] = n;
    });
    if (Object.keys(out).length) pools[name] = out;
  });
  return { logLevel: form.logLevel, overload, pools };
}

function SettingsEditor({
  settingsResults,
  onApplied,
}: {
  settingsResults: SettingsResult[];
  onApplied: () => void;
}) {
  const okResults = settingsResults.filter((r) => r.ok && r.settings);
  const seed = okResults[0]?.settings;

  const [form, setForm] = useState<FormState | null>(seed ? settingsToForm(seed) : null);
  const [enabled, setEnabled] = useState<boolean>(seed?.overload.enabled ?? false);
  const [targets, setTargets] = useState<string[]>([]); // empty = all
  const [submitting, setSubmitting] = useState(false);
  const [togglingGuard, setTogglingGuard] = useState(false);
  const [applyResults, setApplyResults] = useState<SettingsResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form when fresh settings arrive (e.g. after a refresh) but only
  // while the user has not started editing (form === null means not yet seeded).
  useEffect(() => {
    if (!form && seed) {
      setForm(settingsToForm(seed));
      setEnabled(seed.overload.enabled);
    }
  }, [seed, form]);

  // Surface drift: do all reachable instances report the same settings?
  const drift = useMemo(() => {
    if (okResults.length < 2) return false;
    const first = JSON.stringify(okResults[0].settings);
    return okResults.some((r) => JSON.stringify(r.settings) !== first);
  }, [okResults]);

  const allUrls = settingsResults.map((r) => r.url);

  const submit = useCallback(async () => {
    if (!form) return;
    setSubmitting(true);
    setError(null);
    setApplyResults(null);
    try {
      const payload = formToSettings(form, enabled);
      const { results } = await applySettings(payload, targets.length ? targets : undefined);
      setApplyResults(results);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [form, enabled, targets, onApplied]);

  // The on/off switch applies immediately to the targeted instances (a switch
  // that did nothing until a separate "Apply" is confusing). Optimistic, with
  // revert on failure.
  const toggleGuard = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    setTogglingGuard(true);
    setError(null);
    try {
      const { results } = await applySettings(
        { overload: { enabled: next } },
        targets.length ? targets : undefined
      );
      setApplyResults(results);
      onApplied();
    } catch (e) {
      setEnabled(!next); // revert
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTogglingGuard(false);
    }
  }, [enabled, targets, onApplied]);

  if (!form) {
    return (
      <div className="g-rounded-lg g-border g-border-zinc-800 g-bg-zinc-950 g-p-4 g-text-sm g-text-zinc-400">
        No reachable instance to read settings from.
      </div>
    );
  }

  return (
    <div className="g-rounded-lg g-border g-border-zinc-800 g-bg-zinc-950 g-p-4">
      <div className="g-flex g-items-center g-justify-between g-mb-4">
        <h2 className="g-text-sm g-font-semibold g-text-zinc-100">Adjust settings</h2>
        <span className="g-text-[11px] g-text-zinc-500">
          changes are live &amp; ephemeral — reset on restart
        </span>
      </div>

      {drift && (
        <div className="g-mb-4 g-rounded g-border g-border-amber-800/60 g-bg-amber-950/30 g-px-3 g-py-2 g-text-xs g-text-amber-300">
          Instances do not all report the same settings. The form is seeded from{' '}
          <code>{okResults[0].node}</code>.
        </div>
      )}

      {/* General */}
      <div className="g-grid g-grid-cols-2 sm:g-grid-cols-4 g-gap-3 g-mb-4">
        <label className="g-flex g-flex-col g-gap-1">
          <span className="g-text-[11px] g-uppercase g-tracking-wide g-text-zinc-500">log level</span>
          <select
            value={form.logLevel}
            onChange={(e) => setForm({ ...form, logLevel: e.target.value })}
            className="g-rounded g-border g-border-zinc-700 g-bg-zinc-900 g-px-2 g-py-1 g-text-sm g-text-zinc-100 focus:g-border-amber-500 focus:g-outline-none"
          >
            {LOG_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="g-flex g-flex-col g-gap-1">
          <span className="g-text-[11px] g-uppercase g-tracking-wide g-text-zinc-500">
            overload guard <span className="g-normal-case g-text-zinc-600">(applies now)</span>
          </span>
          <button
            type="button"
            disabled={togglingGuard}
            onClick={toggleGuard}
            className={`g-rounded g-px-2 g-py-1 g-text-sm g-border disabled:g-opacity-60 ${
              enabled
                ? 'g-border-emerald-700 g-bg-emerald-900/40 g-text-emerald-300'
                : 'g-border-zinc-700 g-bg-zinc-900 g-text-zinc-400'
            }`}
          >
            {togglingGuard ? 'applying…' : enabled ? 'enabled' : 'disabled'}
          </button>
        </label>
      </div>

      {/* Overload thresholds */}
      <div className="g-text-[11px] g-uppercase g-tracking-wide g-text-zinc-500 g-mb-2">
        overload thresholds <span className="g-normal-case g-text-zinc-600">(blank = unchanged)</span>
      </div>
      <div className="g-grid g-grid-cols-2 sm:g-grid-cols-4 g-gap-3 g-mb-4">
        {Object.keys(form.overload).map((k) => (
          <NumberField
            key={k}
            label={k}
            value={form.overload[k]}
            onChange={(v) => setForm({ ...form, overload: { ...form.overload, [k]: v } })}
          />
        ))}
      </div>

      {/* Pools */}
      <div className="g-text-[11px] g-uppercase g-tracking-wide g-text-zinc-500 g-mb-2">
        request pools
      </div>
      <div className="g-space-y-3 g-mb-4">
        {Object.entries(form.pools).map(([name, fields]) => (
          <div key={name} className="g-rounded g-border g-border-zinc-800 g-p-3">
            <div className="g-text-sm g-text-zinc-300 g-mb-2">{name}</div>
            <div className="g-grid g-grid-cols-2 sm:g-grid-cols-4 g-gap-3">
              {Object.keys(fields).map((k) => (
                <NumberField
                  key={k}
                  label={k}
                  value={fields[k]}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      pools: { ...form.pools, [name]: { ...fields, [k]: v } },
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Targets */}
      <div className="g-text-[11px] g-uppercase g-tracking-wide g-text-zinc-500 g-mb-2">
        apply to
      </div>
      <div className="g-flex g-flex-wrap g-gap-3 g-mb-4">
        <label className="g-flex g-items-center g-gap-2 g-text-sm">
          <input
            type="checkbox"
            checked={targets.length === 0}
            onChange={() => setTargets([])}
          />
          all instances
        </label>
        {allUrls.map((url) => {
          const label = settingsResults.find((r) => r.url === url)?.node ?? url;
          return (
            <label key={url} className="g-flex g-items-center g-gap-2 g-text-sm g-text-zinc-300">
              <input
                type="checkbox"
                checked={targets.includes(url)}
                onChange={(e) =>
                  setTargets((prev) =>
                    e.target.checked ? [...prev, url] : prev.filter((u) => u !== url)
                  )
                }
              />
              {label}
            </label>
          );
        })}
      </div>

      <div className="g-flex g-items-center g-gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="g-rounded g-bg-amber-500 g-px-4 g-py-1.5 g-text-sm g-font-medium g-text-zinc-950 hover:g-bg-amber-400 disabled:g-opacity-50"
        >
          {submitting ? 'applying…' : 'Apply'}
        </button>
        {error && <span className="g-text-sm g-text-red-400">{error}</span>}
      </div>

      {applyResults && (
        <div className="g-mt-4 g-space-y-1">
          {applyResults.map((r) => (
            <div key={r.url} className="g-text-xs">
              <span className="g-text-zinc-400">{r.node}: </span>
              {r.skipped ? (
                <span className="g-text-zinc-600">skipped</span>
              ) : r.ok ? (
                <span className="g-text-emerald-400">applied</span>
              ) : (
                <span className="g-text-red-400">
                  failed{r.status ? ` (${r.status})` : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [healthResults, setHealthResults] = useState<HealthResult[]>([]);
  const [settingsResults, setSettingsResults] = useState<SettingsResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorised, setUnauthorised] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [health, settings] = await Promise.all([fetchHealth(), fetchSettings()]);
      setHealthResults(health.results);
      setSettingsResults(settings.results);
    } catch (e) {
      if (e instanceof NotAuthorisedError) setUnauthorised(true);
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Refresh health periodically so the overview stays live.
    const id = setInterval(() => {
      fetchHealth()
        .then((h) => setHealthResults(h.results))
        .catch(() => undefined);
    }, 10000);
    return () => clearInterval(id);
  }, [load]);

  if (unauthorised) {
    return <div className="g-text-sm g-text-zinc-400">Not found.</div>;
  }

  return (
    <div className="g-space-y-6">
      <div className="g-flex g-items-center g-justify-between">
        <h1 className="g-text-lg g-font-semibold g-text-zinc-100">GraphQL instances</h1>
        <button
          type="button"
          onClick={load}
          className="g-rounded g-border g-border-zinc-700 g-px-3 g-py-1 g-text-xs g-text-zinc-300 hover:g-bg-zinc-800"
        >
          refresh
        </button>
      </div>

      {loading && <div className="g-text-sm g-text-zinc-500">loading…</div>}
      {error && <div className="g-text-sm g-text-red-400">{error}</div>}

      {!loading && healthResults.length === 0 && !error && (
        <div className="g-text-sm g-text-zinc-500">
          No instances configured (set <code>ADMIN_GRAPHQL_NODES</code>).
        </div>
      )}

      <div className="g-grid g-grid-cols-1 sm:g-grid-cols-2 lg:g-grid-cols-4 g-gap-4">
        {healthResults.map((r) => (
          <HealthCard key={r.url} result={r} />
        ))}
      </div>

      {settingsResults.length > 0 && (
        <SettingsEditor settingsResults={settingsResults} onApplied={load} />
      )}
    </div>
  );
}
