// Shared types for the omni-search filter builder.

export type FilterFieldType =
  | 'freeText'
  | 'boolean'
  | 'enum'
  | 'integerRange'
  | 'suggestString'
  | 'suggestStringRange'
  | 'geoTimeRange'
  | 'suggestEntity'
  | 'vocabulary';

// A value in an enum list — either a bare string or a {value,label} pair for
// filters that want friendlier display text (e.g. ISO country code -> name).
export type EnumValue = string | { value: string; label: string };

export type Preset = { value: string; label: string; meta?: string };

export type FilterFieldConfig = {
  key: string;
  label: string;
  hint?: string;
  type: FilterFieldType;
  aliases?: string[];
  // enum
  values?: EnumValue[];
  // suggestString / suggestStringRange / suggestEntity
  suggestUrl?: string;
  wildcardPattern?: boolean;
  toSuggestion?: (item: any) => Suggestion;
  resolveLabel?: (value: string) => Promise<string>;
  // vocabulary
  vocabulary?: string;
  limit?: number;
  // ranges
  presets?: Preset[] | (() => Preset[]);
  // capability flags (default true)
  supportsNegation?: boolean;
  supportsExistence?: boolean;
  // single-value fields (e.g. q) replace rather than accumulate
  singleValue?: boolean;
  // formatting
  formatValue?: (value: string) => string;
  encodeValue?: (value: string) => string;
};

// A single applied filter, as emitted by the box when the user picks a value.
export type FilterItem = {
  filterName: string;
  filterLabel: string;
  value: string;
  valueLabel: string;
  negated: boolean;
};

export type Shortcut = {
  filterName: string;
  filterLabel: string;
  value: string;
  valueLabel: string;
  negated?: boolean;
};

// A row in the suggestion dropdown. Most flags are mutually-exclusive markers
// describing what selecting the row should do.
export type Suggestion = {
  value: string;
  label: string;
  meta?: string | null;
  // markers
  isWildcard?: boolean;
  isFilterName?: boolean;
  isQuickText?: boolean;
  isShortcut?: boolean;
  isSectionHeader?: boolean;
  isPreset?: boolean;
  isRootEntitySuggestion?: boolean;
  isPatternValue?: boolean;
  extendRange?: boolean;
  disabled?: boolean;
  // payloads
  entityKey?: string;
  chipLabel?: string;
  shortcut?: Shortcut;
};

export type RootEntity = string | { key: string; minChars?: number };

export type ParsedInput = {
  mode: 'filter_name' | 'filter_value';
  filterName: string | null;
  valueQuery: string;
  negated: boolean;
};
