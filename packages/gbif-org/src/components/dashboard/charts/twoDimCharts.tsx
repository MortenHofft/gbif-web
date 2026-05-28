import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  DimensionKind,
  TwoDimChartView,
  TwoDimensionalChart,
  TwoDimensionalChartProps,
} from './TwoDimensionalChart';

// Dimension config. `field` is the GraphQL facet field name on `occurrenceSearch`. For
// `kind: 'histogram'` it's the field on `histogram`, and for `kind: 'autoDateHistogram'`
// the field on `autoDateHistogram` (currently only `eventDate`). `filterKey` is the
// predicate key used for click-through filters (countryCode → country, etc.). `kind`
// defaults to 'facet'. `interval`/`minimumInterval` configure bucketed kinds.
// `highCardinality` is a hint that LIST is a better default view than TABLE because the
// column union across rows would explode.
export type Dimension = {
  field: string;
  kind?: DimensionKind;
  interval?: number;
  minimumInterval?: string;
  filterKey?: string;
  labelId: string;
  defaultLabel: string;
  group: 'common' | 'taxon' | 'location' | 'time' | 'provenance' | 'other';
  highCardinality?: boolean;
};

// Fields that work well as a primary (row) dimension.
export const PRIMARY_DIMENSIONS: Dimension[] = [
  { field: 'basisOfRecord', labelId: 'filters.basisOfRecord.name', defaultLabel: 'Basis of record', group: 'common' },
  { field: 'license', labelId: 'filters.license.name', defaultLabel: 'License', group: 'common' },
  { field: 'mediaType', labelId: 'filters.mediaType.name', defaultLabel: 'Media type', group: 'common' },
  { field: 'issue', labelId: 'filters.occurrenceIssue.name', defaultLabel: 'Issue', group: 'common' },
  { field: 'countryCode', filterKey: 'country', labelId: 'filters.country.name', defaultLabel: 'Country', group: 'location' },
  { field: 'publishingCountry', labelId: 'filters.publishingCountryCode.name', defaultLabel: 'Publishing country', group: 'location' },
  { field: 'continent', labelId: 'filters.continent.name', defaultLabel: 'Continent', group: 'location' },
  { field: 'gbifRegion', labelId: 'filters.gbifRegion.name', defaultLabel: 'GBIF region', group: 'location' },
  { field: 'kingdomKey', labelId: 'filters.kingdomKey.name', defaultLabel: 'Kingdom', group: 'taxon' },
  { field: 'month', labelId: 'filters.month.name', defaultLabel: 'Month', group: 'time' },
  { field: 'year', kind: 'histogram', interval: 10, labelId: 'filters.year.name', defaultLabel: 'Year (decade)', group: 'time' },
  { field: 'establishmentMeans', labelId: 'filters.establishmentMeans.name', defaultLabel: 'Establishment means', group: 'other' },
  { field: 'typeStatus', labelId: 'filters.typeStatus.name', defaultLabel: 'Type status', group: 'other' },
  { field: 'datasetKey', labelId: 'filters.datasetKey.name', defaultLabel: 'Dataset', group: 'provenance', highCardinality: true },
  { field: 'publishingOrg', labelId: 'filters.publisherKey.name', defaultLabel: 'Publisher', group: 'provenance', highCardinality: true },
  { field: 'networkKey', labelId: 'filters.networkKey.name', defaultLabel: 'Network', group: 'provenance' },
];

// Fields that work as a secondary (column) dimension. We include some high-cardinality
// fields here (datasetKey, publishingOrg, recordedBy) — they aren't suitable for the
// TABLE/COLUMN views (where columns must align across rows) but render fine in the
// LIST view, which surfaces each row's own top-N values inline.
export const SECONDARY_DIMENSIONS: Dimension[] = [
  { field: 'basisOfRecord', labelId: 'filters.basisOfRecord.name', defaultLabel: 'Basis of record', group: 'common' },
  { field: 'license', labelId: 'filters.license.name', defaultLabel: 'License', group: 'common' },
  { field: 'mediaType', labelId: 'filters.mediaType.name', defaultLabel: 'Media type', group: 'common' },
  { field: 'issue', labelId: 'filters.occurrenceIssue.name', defaultLabel: 'Issue', group: 'common' },
  { field: 'countryCode', filterKey: 'country', labelId: 'filters.country.name', defaultLabel: 'Country', group: 'location' },
  { field: 'continent', labelId: 'filters.continent.name', defaultLabel: 'Continent', group: 'location' },
  { field: 'gbifRegion', labelId: 'filters.gbifRegion.name', defaultLabel: 'GBIF region', group: 'location' },
  { field: 'kingdomKey', labelId: 'filters.kingdomKey.name', defaultLabel: 'Kingdom', group: 'taxon' },
  { field: 'month', labelId: 'filters.month.name', defaultLabel: 'Month', group: 'time' },
  { field: 'year', kind: 'histogram', interval: 10, labelId: 'filters.year.name', defaultLabel: 'Year (decade)', group: 'time' },
  { field: 'eventDate', kind: 'autoDateHistogram', minimumInterval: 'year', filterKey: 'eventDate', labelId: 'filters.eventDate.name', defaultLabel: 'Event date', group: 'time' },
  { field: 'establishmentMeans', labelId: 'filters.establishmentMeans.name', defaultLabel: 'Establishment means', group: 'other' },
  { field: 'typeStatus', labelId: 'filters.typeStatus.name', defaultLabel: 'Type status', group: 'other' },
  { field: 'datasetKey', labelId: 'filters.datasetKey.name', defaultLabel: 'Dataset', group: 'provenance', highCardinality: true },
  { field: 'publishingOrg', labelId: 'filters.publisherKey.name', defaultLabel: 'Publisher', group: 'provenance', highCardinality: true },
];

const GROUP_LABEL_IDS: Record<Dimension['group'], string> = {
  common: 'dashboard.group.record',
  taxon: 'dashboard.group.identification',
  location: 'dashboard.group.location',
  time: 'dashboard.group.event',
  provenance: 'dashboard.group.provenance',
  other: 'dashboard.group.other',
};

function findDim(list: Dimension[], field: string | undefined): Dimension | undefined {
  if (!field) return undefined;
  return list.find((d) => d.field === field);
}

function useDimensionLabel(dim: Dimension | undefined): string {
  const intl = useIntl();
  if (!dim) return '';
  return intl.formatMessage({ id: dim.labelId, defaultMessage: dim.defaultLabel });
}

// Pick a sensible default view based on whether the pair is suitable for an aligned
// pivot table. High-cardinality fields are LIST-first because their column union
// across rows is unlikely to overlap, which would make TABLE/COLUMN misleading.
function pickViews(
  secondary: Dimension
): { options: TwoDimChartView[]; defaultView: TwoDimChartView } {
  if (secondary.highCardinality) {
    return { options: ['LIST'], defaultView: 'LIST' };
  }
  // Bucketed numeric/time secondaries align fine because we use a fixed interval.
  return { options: ['TABLE', 'COLUMN', 'LIST'], defaultView: 'TABLE' };
}

function chartPropsFor(
  primary: Dimension,
  secondary: Dimension,
  primaryLabel: string,
  secondaryLabel: string
): Omit<TwoDimensionalChartProps, 'title'> {
  const { options, defaultView } = pickViews(secondary);
  return {
    primaryField: primary.field,
    secondaryField: secondary.field,
    primaryKind: primary.kind ?? 'facet',
    secondaryKind: secondary.kind ?? 'facet',
    primaryInterval: primary.interval,
    secondaryInterval: secondary.interval,
    primaryMinimumInterval: primary.minimumInterval ?? 'year',
    secondaryMinimumInterval: secondary.minimumInterval ?? 'year',
    primaryFilterKey: primary.filterKey ?? primary.field,
    secondaryFilterKey: secondary.filterKey ?? secondary.field,
    primaryTitle: primaryLabel,
    secondaryTitle: secondaryLabel,
    options,
    defaultOption: defaultView,
    subtitleKey: 'dashboard.numberOfOccurrences',
  };
}

// Shared props from the dashboard
type CommonProps = {
  predicate?: unknown;
  q?: string;
  detailsRoute?: string;
  currentFilter?: Record<string, unknown>;
  interactive?: boolean;
  [key: string]: unknown;
};

type PreconfiguredProps = CommonProps & {
  primary: string;
  secondary: string;
  titleId?: string;
  defaultTitle?: string;
};

function Preconfigured({
  primary,
  secondary,
  titleId,
  defaultTitle,
  ...rest
}: PreconfiguredProps) {
  const intl = useIntl();
  const primaryDim = findDim(PRIMARY_DIMENSIONS, primary);
  const secondaryDim = findDim(SECONDARY_DIMENSIONS, secondary);
  if (!primaryDim || !secondaryDim) return null;

  const primaryLabel = intl.formatMessage({
    id: primaryDim.labelId,
    defaultMessage: primaryDim.defaultLabel,
  });
  const secondaryLabel = intl.formatMessage({
    id: secondaryDim.labelId,
    defaultMessage: secondaryDim.defaultLabel,
  });

  const title = titleId ? (
    <FormattedMessage id={titleId} defaultMessage={defaultTitle ?? `${primaryLabel} × ${secondaryLabel}`} />
  ) : (
    <span>
      {primaryLabel} × {secondaryLabel}
    </span>
  );

  const chartProps = {
    ...(rest as object),
    ...chartPropsFor(primaryDim, secondaryDim, primaryLabel, secondaryLabel),
    title,
  } as TwoDimensionalChartProps;
  return <TwoDimensionalChart {...chartProps} />;
}

export function BasisOfRecordByCountry(props: CommonProps) {
  return <Preconfigured primary="basisOfRecord" secondary="countryCode" {...props} />;
}
export function CountryByBasisOfRecord(props: CommonProps) {
  return <Preconfigured primary="countryCode" secondary="basisOfRecord" {...props} />;
}
export function BasisOfRecordByMonth(props: CommonProps) {
  return <Preconfigured primary="basisOfRecord" secondary="month" {...props} />;
}
export function LicenseByCountry(props: CommonProps) {
  return <Preconfigured primary="license" secondary="countryCode" {...props} />;
}
export function KingdomByBasisOfRecord(props: CommonProps) {
  return <Preconfigured primary="kingdomKey" secondary="basisOfRecord" {...props} />;
}
export function DatasetsByBasisOfRecord(props: CommonProps) {
  return <Preconfigured primary="datasetKey" secondary="basisOfRecord" {...props} />;
}
export function CountryByDataset(props: CommonProps) {
  return <Preconfigured primary="countryCode" secondary="datasetKey" {...props} />;
}
export function YearByBasisOfRecord(props: CommonProps) {
  return <Preconfigured primary="year" secondary="basisOfRecord" {...props} />;
}
export function BasisOfRecordByYear(props: CommonProps) {
  return <Preconfigured primary="basisOfRecord" secondary="year" {...props} />;
}

// Custom 2D chart: user picks both dimensions at runtime.
export function CustomTwoDimensionalChart({
  primary: primaryProp,
  secondary: secondaryProp,
  ...props
}: CommonProps & { primary?: string; secondary?: string }) {
  const [primary, setPrimary] = useState<string>(primaryProp ?? 'basisOfRecord');
  const [secondary, setSecondary] = useState<string>(secondaryProp ?? 'countryCode');

  const primaryDim = findDim(PRIMARY_DIMENSIONS, primary);
  const secondaryDim = findDim(SECONDARY_DIMENSIONS, secondary);
  const primaryLabel = useDimensionLabel(primaryDim);
  const secondaryLabel = useDimensionLabel(secondaryDim);

  return (
    <div>
      <DimensionPicker
        primary={primary}
        secondary={secondary}
        onPrimaryChange={setPrimary}
        onSecondaryChange={setSecondary}
      />
      {primaryDim && secondaryDim && primaryDim.field !== secondaryDim.field && (() => {
        const chartProps = {
          ...(props as object),
          ...chartPropsFor(primaryDim, secondaryDim, primaryLabel, secondaryLabel),
          title: (
            <span>
              {primaryLabel} × {secondaryLabel}
            </span>
          ),
        } as TwoDimensionalChartProps;
        return (
          <TwoDimensionalChart
            key={`${primaryDim.field}__${secondaryDim.field}`}
            {...chartProps}
          />
        );
      })()}
      {primaryDim && secondaryDim && primaryDim.field === secondaryDim.field && (
        <div className="g-text-slate-400 g-text-sm g-p-4 g-text-center">
          <FormattedMessage
            id="dashboard.customChart.pickDifferent"
            defaultMessage="Pick two different dimensions to see a breakdown."
          />
        </div>
      )}
    </div>
  );
}

type DimensionPickerProps = {
  primary: string;
  secondary: string;
  onPrimaryChange: (v: string) => void;
  onSecondaryChange: (v: string) => void;
};

function DimensionPicker({
  primary,
  secondary,
  onPrimaryChange,
  onSecondaryChange,
}: DimensionPickerProps) {
  return (
    <div className="g-flex g-flex-wrap g-gap-3 g-items-end g-mb-3 g-px-3 g-pt-3">
      <DimensionSelect
        labelId="dashboard.customChart.primary"
        defaultLabel="Show occurrences by"
        value={primary}
        onChange={onPrimaryChange}
        options={PRIMARY_DIMENSIONS}
      />
      <DimensionSelect
        labelId="dashboard.customChart.secondary"
        defaultLabel="And broken down by"
        value={secondary}
        onChange={onSecondaryChange}
        options={SECONDARY_DIMENSIONS}
      />
    </div>
  );
}

type DimensionSelectProps = {
  labelId: string;
  defaultLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: Dimension[];
};

function DimensionSelect({
  labelId,
  defaultLabel,
  value,
  onChange,
  options,
}: DimensionSelectProps) {
  const intl = useIntl();
  const grouped = useMemo(() => {
    const map: Record<string, Dimension[]> = {};
    options.forEach((o) => {
      if (!map[o.group]) map[o.group] = [];
      map[o.group].push(o);
    });
    return map;
  }, [options]);

  return (
    <div className="g-flex g-flex-col g-gap-1">
      <span className="g-text-xs g-text-slate-500">
        <FormattedMessage id={labelId} defaultMessage={defaultLabel} />
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="g-w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(grouped).map(([group, dims]) => (
            <SelectGroup key={group}>
              <SelectLabel>
                <FormattedMessage
                  id={GROUP_LABEL_IDS[group as Dimension['group']]}
                  defaultMessage={group}
                />
              </SelectLabel>
              {dims.map((dim) => (
                <SelectItem value={dim.field} key={dim.field}>
                  {intl.formatMessage({ id: dim.labelId, defaultMessage: dim.defaultLabel })}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
