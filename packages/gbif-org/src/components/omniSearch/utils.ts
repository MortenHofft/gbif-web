import { formatRangeLabel, GBIF_GRAPHQL_URL } from './filterConfig';
import type { FilterFieldConfig, ParsedInput, Suggestion } from './types';

export const WILDCARD_OPTION: Suggestion = {
  value: '*',
  label: 'has any value',
  meta: 'matches any non-null value',
  isWildcard: true,
};

export function parseInput(text: string): ParsedInput {
  let negated = false;
  let rest = text;

  if (text.startsWith('!')) {
    negated = true;
    rest = text.slice(1);
  } else if (/^not\s+/i.test(text)) {
    negated = true;
    rest = text.replace(/^not\s+/i, '');
  }

  const eqIdx = rest.indexOf('=');
  if (eqIdx === -1) {
    return { mode: 'filter_name', filterName: null, valueQuery: rest, negated };
  }
  return {
    mode: 'filter_value',
    filterName: rest.slice(0, eqIdx).trim(),
    valueQuery: rest.slice(eqIdx + 1),
    negated,
  };
}

// Expand a filter's optional `presets` into dropdown rows. The config may
// expose either a plain array (static — e.g. elevation buckets) or a
// function that returns one (dynamic — e.g. "Last 5 years" needs the
// current calendar year). Each preset is `{ value, label, meta? }`.
function resolvePresets(cfg?: FilterFieldConfig): Suggestion[] {
  const raw = typeof cfg?.presets === 'function' ? cfg.presets() : cfg?.presets;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((p) => ({
    value: p.value,
    label: p.label,
    meta: p.meta ?? p.value,
    isPreset: true,
  }));
}

export function getIntegerRangeSuggestions(query: string, cfg?: FilterFieldConfig): Suggestion[] {
  const presets = resolvePresets(cfg);

  if (!query) {
    if (!presets.length) return [WILDCARD_OPTION];
    return [
      WILDCARD_OPTION,
      { isSectionHeader: true, label: 'Quick ranges', value: '__sec_presets' },
      ...presets,
    ];
  }

  const suggestions: Suggestion[] = [];
  const isNum = /^\d{1,4}$/.test(query.trim());
  const isRange = /^[\d*]+,[\d*]*$/.test(query.trim());

  if (query !== '*') {
    suggestions.push({ value: query, label: formatRangeLabel(query), meta: query });
  }

  if (isNum) {
    const y = query.trim();
    suggestions.push(
      { value: `${y},*`, label: `from ${y} onwards`, meta: `${y},*` },
      { value: `*,${y}`, label: `up to ${y}`, meta: `*,${y}` }
    );
  }

  if (!isRange && !isNum) suggestions.length = 0;

  suggestions.push(WILDCARD_OPTION);
  return suggestions;
}

// ── Geological time vocabulary ─────────────────────────────────────────────
//
// Geological periods carry startAge (older boundary, larger Ma) and endAge
// (younger boundary, smaller Ma). A range "A,B" reads "from A through B"
// going from older to younger. Two periods overlap (invalid range) when
// B.startAge > A.endAge — i.e. B began before A finished.
//
// Matches the rule used in gbif-web's geoTimeFilter:
//   periodsOverlap = (end.startAge ?? 0) > (start.endAge ?? 0)
// Missing ages default to 0 so incomplete vocab entries don't get filtered
// out — be permissive when we don't know.

type GeoTimeConcept = {
  name: string;
  uiLabel?: string;
  rank?: string;
  startAge?: number;
  endAge?: number;
};

let geoTimeVocabPromise: Promise<GeoTimeConcept[]> | null = null;

function loadGeoTimeVocab(): Promise<GeoTimeConcept[]> {
  if (!geoTimeVocabPromise) {
    geoTimeVocabPromise = fetch(GBIF_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query {
          geoTimeConceptSearch(limit: 500) {
            results { name uiLabel rank startAge endAge }
          }
        }`,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(({ data, errors }) => {
        if (errors?.length) throw new Error(errors[0].message ?? 'GraphQL error');
        const results: GeoTimeConcept[] = data?.geoTimeConceptSearch?.results ?? [];
        // Oldest first — matches gbif-web's geoTimeFilter ordering.
        return [...results].sort((a, b) => (a.startAge ?? 0) - (b.startAge ?? 0)).reverse();
      })
      .catch((err) => {
        // Reset so the next call retries instead of caching the failure,
        // and rethrow so callers can surface the error in the UI.
        geoTimeVocabPromise = null;
        throw err;
      });
  }
  return geoTimeVocabPromise;
}

function findConcept(vocab: GeoTimeConcept[], name: string): GeoTimeConcept | undefined {
  const q = name.trim().toLowerCase();
  return vocab.find((c) => c.name?.toLowerCase() === q || c.uiLabel?.toLowerCase() === q);
}

function ageMeta(c: GeoTimeConcept): string | null {
  if (c.startAge == null || c.endAge == null) return c.rank ?? null;
  const ages = `${c.startAge}–${c.endAge} Ma`;
  return c.rank ? `${ages} · ${c.rank}` : ages;
}

const display = (c: GeoTimeConcept): string => c.uiLabel ?? c.name;

const unknown = (name: string): Suggestion => ({
  value: '__geotime_unknown',
  label: `Unknown period: ${name}`,
  meta: 'not in vocabulary',
  disabled: true,
});

// gbif-web's endFilterFn: a concept is a valid "to" given `from` iff
// concept.startAge <= from.endAge.
const isValidEndpointAfter = (c: GeoTimeConcept, fc: GeoTimeConcept): boolean =>
  (c.startAge ?? 0) <= (fc.endAge ?? 0);

export async function getGeoTimeRangeSuggestions(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  const vocab = await loadGeoTimeVocab();

  // Empty query: show the whole vocabulary (like an enum) so the user can
  // browse, plus the wildcard.
  if (!q) {
    return [
      WILDCARD_OPTION,
      ...vocab.map((c) => ({
        value: c.name,
        label: display(c),
        meta: ageMeta(c),
        extendRange: true,
      })),
    ];
  }

  if (q.includes(',')) {
    const [fromRaw, toRaw] = q.split(',').map((s) => s.trim());

    // The user has already committed to a range — don't offer the "has any
    // value" wildcard here, since selecting it would silently drop the
    // first endpoint they picked.

    // *,B → "up to B"
    if (fromRaw === '*' && toRaw && toRaw !== '*') {
      const tc = findConcept(vocab, toRaw);
      return tc ? [{ value: q, label: `up to ${display(tc)}`, meta: ageMeta(tc) }] : [unknown(toRaw)];
    }
    // A,* → "from A onwards"
    if (toRaw === '*' && fromRaw && fromRaw !== '*') {
      const fc = findConcept(vocab, fromRaw);
      return fc
        ? [{ value: q, label: `from ${display(fc)} onwards`, meta: ageMeta(fc) }]
        : [unknown(fromRaw)];
    }
    if ((fromRaw === '*' || fromRaw === '') && (toRaw === '*' || toRaw === '')) return [WILDCARD_OPTION];

    // A,_ — first endpoint chosen, picking the second.
    const fc = findConcept(vocab, fromRaw);
    if (!fc) return [unknown(fromRaw)];

    if (toRaw === '') {
      const candidates = vocab.filter((c) => isValidEndpointAfter(c, fc));
      return [
        { value: fromRaw, label: `Just ${display(fc)}`, meta: ageMeta(fc) },
        { value: `${fromRaw},*`, label: `${display(fc)} onwards`, meta: 'open-ended end' },
        ...candidates.map((c) => ({
          value: `${fromRaw},${c.name}`,
          label: `${display(fc)} — ${display(c)}`,
          meta: `${fc.startAge}–${c.endAge} Ma`,
        })),
      ];
    }

    // toRaw is non-empty: try exact match, then substring match.
    const tcExact = findConcept(vocab, toRaw);
    if (tcExact) {
      if (!isValidEndpointAfter(tcExact, fc)) {
        return [
          {
            value: '__geotime_invalid',
            label: `Invalid range: ${display(tcExact)} (${tcExact.startAge}–${tcExact.endAge} Ma) overlaps with ${display(fc)} (${fc.startAge}–${fc.endAge} Ma)`,
            meta: 'periods overlap',
            disabled: true,
          },
        ];
      }
      return [{ value: q, label: `${display(fc)} — ${display(tcExact)}`, meta: `${fc.startAge}–${tcExact.endAge} Ma` }];
    }
    const tl = toRaw.toLowerCase();
    const matches = vocab.filter((c) => display(c).toLowerCase().includes(tl));
    if (!matches.length) return [unknown(toRaw)];
    return matches.map((c) => {
      const valid = isValidEndpointAfter(c, fc);
      return {
        value: `${fromRaw},${c.name}`,
        label: `${display(fc)} — ${display(c)}`,
        meta: valid ? `${fc.startAge}–${c.endAge} Ma` : `invalid · ${c.startAge}–${c.endAge} Ma`,
        disabled: !valid,
      };
    });
  }

  // Single value: substring match against the display label.
  // Ranges are the dominant use for this field, so picking a period
  // here extends the input to "A," and re-opens the dropdown to pick
  // the second endpoint (or commit as a single period).
  const ql = q.toLowerCase();
  const matches = vocab.filter((c) => display(c).toLowerCase().includes(ql));

  if (!matches.length) return [WILDCARD_OPTION];

  const suggestions: Suggestion[] = matches.map((c) => ({
    value: c.name,
    label: display(c),
    meta: ageMeta(c),
    extendRange: true,
  }));
  suggestions.push(WILDCARD_OPTION);
  return suggestions;
}

// Build dropdown suggestions for a suggestStringRange field.
// items = string[] from the suggest API; query = raw user input.
export function getStringRangeSuggestions(items: string[], query: string): Suggestion[] {
  const q = query.trim();
  if (!q) return [WILDCARD_OPTION];

  const suggestions: Suggestion[] = [];
  const isRange = q.includes(',');

  if (isRange || q === '*') {
    if (q !== '*') suggestions.push({ value: q, label: formatRangeLabel(q), meta: q });
  } else {
    for (const name of items) {
      suggestions.push({ value: name, label: name, meta: null });
    }
    if (items.length > 0) {
      const first = items[0];
      suggestions.push(
        { value: `${first},*`, label: `from ${first} onwards`, meta: `${first},*` },
        { value: `*,${first}`, label: `up to ${first}`, meta: `*,${first}` }
      );
    }
    if (!items.length) return [WILDCARD_OPTION];
  }

  suggestions.push(WILDCARD_OPTION);
  return suggestions;
}
