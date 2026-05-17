// Pure predicate helper extracted from rangeFilter.tsx so it can be imported
// without pulling in the entire filter-UI module graph (which depends on React,
// FilterContext, icon packs, etc.). Useful in tests and in light helpers.
//
// Generates a range or terms predicate from a user-entered string.
//   "1950"        → { type: 'equals', value: '1950' }
//   "1950,2000"   → { type: 'range', value: { gte: 1950, lte: 2000 } }

export function rangeOrTerm(
  value?: string | number | null,
  lowerBound = 'gte',
  upperBound = 'lte',
  expectNumbers?: boolean
) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value === 'number') {
    return {
      type: 'equals',
      value: value + '',
    };
  }
  let delimter = value.indexOf(',') > -1 ? ',' : null;
  if (expectNumbers && !delimter && value.trim().indexOf('-') > 0) {
    delimter = '-';
  }

  if (typeof value !== 'string' || !delimter) {
    return {
      type: 'equals',
      value: value,
    };
  } else {
    const values = value.split(delimter);
    const cleanedValues = values
      .map((s) => s.trim())
      .map((s) => (s === '*' || s === '' ? undefined : s));

    if (expectNumbers && !cleanedValues.some((x) => x === undefined || isNaN(parseFloat(x)))) {
      const sortedValues = cleanedValues.map((x) => parseFloat(x as string)).sort((a, b) => a - b);
      return {
        type: 'range',
        value: {
          [lowerBound]: sortedValues[0],
          [upperBound]: sortedValues[1],
        },
      };
    }
    return {
      type: 'range',
      value: {
        [lowerBound]: cleanedValues[0],
        [upperBound]: cleanedValues[1],
      },
    };
  }
}
