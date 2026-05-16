// Parses the omni-filter input string.
//
// Modes:
//   "year"          → filter_name with valueQuery "year"
//   "year="         → filter_value, filterName=year, valueQuery ""
//   "year=1900"     → filter_value, filterName=year, valueQuery "1900"
//   "!year=1900"    → negated filter_value
//   "not year"      → negated filter_name with valueQuery "year"

export type ParsedInput = {
  mode: 'filter_name' | 'filter_value';
  filterName: string | null;
  valueQuery: string;
  negated: boolean;
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
