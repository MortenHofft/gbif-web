import { SimpleTooltip as Tooltip } from '@/components/simpleTooltip';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardTitle } from '@/components/ui/smallCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfig } from '@/config/config';
import useQuery from '@/hooks/useQuery';
import { useI18n } from '@/reactRouterPlugins';
import formatAsPercentage from '@/utils/formatAsPercentage';
import HighchartsReact from 'highcharts-react-official';
import React, { useMemo } from 'react';
import { BsFillBarChartFill } from 'react-icons/bs';
import { MdViewList, MdViewStream } from 'react-icons/md';
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl';
import { useDeepCompareEffectNoCheck as useDeepCompareEffect } from 'use-deep-compare-effect';
import { useUncontrolledProp } from 'uncontrollable';
import { Card, CardHeader, Table } from '../shared';
import ChartClickWrapper from './ChartClickWrapper';
import Highcharts, { generateChartsPalette } from './highcharts';

export type TwoDimChartView = 'TABLE' | 'COLUMN' | 'LIST';

// How a dimension's values are produced by the GBIF GraphQL API.
//   - 'facet'             — categorical / enum-like (basisOfRecord, country, datasetKey, …)
//   - 'autoDateHistogram' — eventDate buckets sized by the API
//   - 'histogram'         — numeric histogram with a caller-supplied `interval` (year, elevation, …)
export type DimensionKind = 'facet' | 'autoDateHistogram' | 'histogram';

export type TwoDimensionalChartProps = {
  predicate?: unknown;
  q?: string;
  primaryField: string;
  secondaryField: string;
  primaryKind?: DimensionKind;
  secondaryKind?: DimensionKind;
  primaryFilterKey?: string;
  secondaryFilterKey?: string;
  primarySize?: number;
  secondarySize?: number;
  // Histogram bucket interval (years, metres, …) when the matching kind is 'histogram'.
  primaryInterval?: number;
  secondaryInterval?: number;
  // Minimum interval hint for 'autoDateHistogram'. Falls through to the API default if omitted.
  primaryMinimumInterval?: string;
  secondaryMinimumInterval?: string;
  title?: React.ReactNode;
  primaryTitle?: React.ReactNode;
  secondaryTitle?: React.ReactNode;
  subtitleKey?: string;
  options?: TwoDimChartView[];
  defaultOption?: TwoDimChartView;
  detailsRoute?: string;
  interactive?: boolean;
  handleRedirect?: (args: { filter?: Record<string, unknown> }) => void;
  setView?: (view: TwoDimChartView) => void;
  view?: TwoDimChartView;
  [key: string]: unknown;
};

type RawBucket = {
  key: string | number;
  count: number;
  label?: string | null;
  // autoDateHistogram bucket has a DateTime in `date`
  date?: string | null;
};

type HistogramResult = {
  interval?: string | number | null;
  buckets?: RawBucket[];
};

// One nested bucket. The inner structure depends on the secondary kind, so all three
// possible shapes are typed as optional.
type NestedBucket = RawBucket & {
  occurrences?: {
    facet?: { secondary?: RawBucket[] };
    autoDateHistogram?: { secondary?: HistogramResult };
    histogram?: { secondary?: HistogramResult };
  };
};

type TwoDimResponse = {
  search?: {
    documents?: { total?: number };
    cardinality?: { primary?: number };
    facet?: { primary?: NestedBucket[] };
    autoDateHistogram?: { primary?: HistogramResult };
    histogram?: { primary?: HistogramResult };
  };
};

type NormalizedBucket = {
  key: string | number;
  label: string;
  count: number;
  // Filter value(s) to apply when this bucket is selected. For histogram buckets we emit
  // "n,m" range strings; for autoDateHistogram we currently emit the bucket start year/date.
  filterValue: string | number;
};

type NormalizedRow = NormalizedBucket & { secondary: NormalizedBucket[] };

type PivotData = {
  rows: NormalizedRow[];
  columns: NormalizedBucket[]; // union of all secondary buckets, sorted by total count desc
  matrix: number[][];
  rowTotals: number[];
  max: number;
  min: number;
};

export function TwoDimensionalChart(props: TwoDimensionalChartProps) {
  return (
    <ChartClickWrapper {...props}>
      <TwoDimensionalChartInner {...props} />
    </ChartClickWrapper>
  );
}

function buildPrimaryFragment(
  primaryField: string,
  primaryKind: DimensionKind,
  secondaryFragment: string
): string {
  if (primaryKind === 'autoDateHistogram') {
    // The primary is wrapped inside an autoDateHistogram selector; per-bucket nested
    // selectors aren't currently exposed for autoDateHistogram buckets, so the secondary
    // breakdown is skipped here.
    return `
      autoDateHistogram {
        primary: ${primaryField}(buckets: $size, minimum_interval: $primaryMinimumInterval) {
          interval
          buckets { key date count }
        }
      }
    `;
  }
  if (primaryKind === 'histogram') {
    return `
      histogram {
        primary: ${primaryField}(interval: $primaryInterval) {
          interval
          buckets {
            key
            count
            occurrences { ${secondaryFragment} }
          }
        }
      }
    `;
  }
  return `
    facet {
      primary: ${primaryField}(size: $size) {
        key
        label(language: $lang)
        count
        occurrences { ${secondaryFragment} }
      }
    }
  `;
}

function buildSecondaryFragment(
  secondaryField: string,
  secondaryKind: DimensionKind
): string {
  if (secondaryKind === 'autoDateHistogram') {
    return `
      autoDateHistogram {
        secondary: ${secondaryField}(buckets: $secondarySize, minimum_interval: $secondaryMinimumInterval) {
          interval
          buckets { key date count }
        }
      }
    `;
  }
  if (secondaryKind === 'histogram') {
    return `
      histogram {
        secondary: ${secondaryField}(interval: $secondaryInterval) {
          interval
          buckets { key count }
        }
      }
    `;
  }
  return `
    facet {
      secondary: ${secondaryField}(size: $secondarySize) {
        key
        label(language: $lang)
        count
      }
    }
  `;
}

function buildQuery({
  primaryField,
  secondaryField,
  primaryKind,
  secondaryKind,
}: {
  primaryField: string;
  secondaryField: string;
  primaryKind: DimensionKind;
  secondaryKind: DimensionKind;
}): string {
  const secondaryFragment = buildSecondaryFragment(secondaryField, secondaryKind);
  const primaryFragment = buildPrimaryFragment(primaryField, primaryKind, secondaryFragment);

  return `
    query twoDim(
      $q: String,
      $predicate: Predicate,
      $size: Int,
      $secondarySize: Int,
      $primaryInterval: Float,
      $secondaryInterval: Float,
      $primaryMinimumInterval: String,
      $secondaryMinimumInterval: String,
      $lang: String
    ) {
      search: occurrenceSearch(q: $q, predicate: $predicate) {
        documents(size: 0) { total }
        cardinality { primary: ${primaryField} }
        ${primaryFragment}
      }
    }
  `;
}

// Translate a bucket from any kind into the normalized shape used by the rendering code.
function normalizeBucket(
  raw: RawBucket,
  kind: DimensionKind,
  interval: number | undefined,
  intl: ReturnType<typeof useIntl>
): NormalizedBucket {
  if (kind === 'autoDateHistogram') {
    const date = raw.date ?? '';
    return {
      key: raw.key,
      label: formatDateBucketLabel(date),
      count: raw.count ?? 0,
      filterValue: date.slice(0, 10), // ISO date, used as the start of the range
    };
  }
  if (kind === 'histogram' && typeof interval === 'number' && interval > 0) {
    const start = Number(raw.key);
    const end = start + interval - 1;
    return {
      key: raw.key,
      label: interval === 1 ? String(start) : `${intl.formatNumber(start)}–${intl.formatNumber(end)}`,
      count: raw.count ?? 0,
      filterValue: interval === 1 ? start : `${start},${end}`,
    };
  }
  return {
    key: raw.key,
    label: String(raw.label ?? raw.key),
    count: raw.count ?? 0,
    filterValue: raw.key,
  };
}

function formatDateBucketLabel(date: string): string {
  if (!date) return '';
  // Show just the year when the bucket is annual; otherwise show YYYY-MM.
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getUTCFullYear()}`;
}

function extractSecondary(
  bucket: NestedBucket,
  kind: DimensionKind
): RawBucket[] {
  if (kind === 'autoDateHistogram') {
    return bucket.occurrences?.autoDateHistogram?.secondary?.buckets ?? [];
  }
  if (kind === 'histogram') {
    return bucket.occurrences?.histogram?.secondary?.buckets ?? [];
  }
  return bucket.occurrences?.facet?.secondary ?? [];
}

function extractPrimary(
  response: TwoDimResponse,
  kind: DimensionKind
): NestedBucket[] {
  if (kind === 'autoDateHistogram') {
    return (response.search?.autoDateHistogram?.primary?.buckets ?? []) as NestedBucket[];
  }
  if (kind === 'histogram') {
    return (response.search?.histogram?.primary?.buckets ?? []) as NestedBucket[];
  }
  return response.search?.facet?.primary ?? [];
}

function buildPivot(
  rawPrimary: NestedBucket[],
  primaryKind: DimensionKind,
  secondaryKind: DimensionKind,
  primaryInterval: number | undefined,
  secondaryInterval: number | undefined,
  intl: ReturnType<typeof useIntl>
): PivotData {
  const rows: NormalizedRow[] = rawPrimary.map((p) => {
    const primary = normalizeBucket(p, primaryKind, primaryInterval, intl);
    const secondary = extractSecondary(p, secondaryKind).map((s) =>
      normalizeBucket(s, secondaryKind, secondaryInterval, intl)
    );
    return { ...primary, secondary };
  });

  // Union of secondary buckets across all rows, summed.
  const columnMap = new Map<string, NormalizedBucket>();
  rows.forEach((row) => {
    row.secondary.forEach((s) => {
      const k = String(s.key);
      const existing = columnMap.get(k);
      if (existing) {
        existing.count += s.count;
      } else {
        columnMap.set(k, { ...s });
      }
    });
  });
  const columns = Array.from(columnMap.values()).sort((a, b) => b.count - a.count);
  const colIndex = new Map(columns.map((c, i) => [String(c.key), i]));

  const matrix: number[][] = rows.map(() => columns.map(() => 0));
  rows.forEach((row, rowIdx) => {
    row.secondary.forEach((s) => {
      const c = colIndex.get(String(s.key));
      if (c !== undefined) matrix[rowIdx][c] = s.count;
    });
  });

  const rowTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));

  let max = 0;
  let min = Number.POSITIVE_INFINITY;
  matrix.forEach((row) =>
    row.forEach((v) => {
      if (v > 0) {
        if (v > max) max = v;
        if (v < min) min = v;
      }
    })
  );
  if (!isFinite(min)) min = 0;

  return { rows, columns, matrix, rowTotals, max, min };
}

function logShade(value: number, min: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  const logMax = Math.log(Math.max(1, max));
  const logMin = Math.log(Math.max(1, min));
  const denom = logMax - logMin;
  if (denom <= 0) return 1;
  const logVal = Math.log(Math.max(1, value));
  return Math.max(0.04, Math.min(1, (logVal - logMin) / denom));
}

function TwoDimensionalChartInner({
  predicate,
  q,
  primaryField,
  secondaryField,
  primaryKind = 'facet',
  secondaryKind = 'facet',
  primaryFilterKey,
  secondaryFilterKey,
  primarySize = 10,
  secondarySize = 10,
  primaryInterval,
  secondaryInterval,
  primaryMinimumInterval = 'year',
  secondaryMinimumInterval = 'year',
  title,
  primaryTitle,
  secondaryTitle,
  subtitleKey,
  options = ['TABLE', 'COLUMN', 'LIST'],
  defaultOption,
  interactive,
  handleRedirect,
  setView: setUserView,
  view: userView,
}: TwoDimensionalChartProps) {
  const intl = useIntl();
  const { theme } = useConfig();
  const { locale } = useI18n();
  const chartColors: string[] | undefined = theme?.chartColors;
  const palette = chartColors
    ? generateChartsPalette(chartColors)
    : (Highcharts?.defaultOptions?.colors as string[] | undefined);

  const [view, setView] = useUncontrolledProp<TwoDimChartView>(
    userView,
    defaultOption ?? options?.[0] ?? 'TABLE',
    setUserView
  );

  const query = useMemo(
    () => buildQuery({ primaryField, secondaryField, primaryKind, secondaryKind }),
    [primaryField, secondaryField, primaryKind, secondaryKind]
  );

  const { data, loading, error, load } = useQuery<TwoDimResponse, Record<string, unknown>>(query, {
    lazyLoad: true,
    queue: { name: 'dashboard' },
  });

  useDeepCompareEffect(() => {
    load({
      keepDataWhileLoading: true,
      variables: {
        predicate,
        q,
        size: primarySize,
        secondarySize,
        primaryInterval,
        secondaryInterval,
        primaryMinimumInterval,
        secondaryMinimumInterval,
        lang: locale.vocabularyLocale ?? locale.localeCode,
      },
      queue: { name: 'dashboard' },
    });
  }, [
    predicate,
    q,
    primarySize,
    secondarySize,
    primaryInterval,
    secondaryInterval,
    primaryMinimumInterval,
    secondaryMinimumInterval,
    query,
    locale,
  ]);

  const pFilterKey = primaryFilterKey ?? primaryField;
  const sFilterKey = secondaryFilterKey ?? secondaryField;

  const pivot = useMemo(
    () =>
      buildPivot(
        extractPrimary(data ?? {}, primaryKind),
        primaryKind,
        secondaryKind,
        primaryInterval,
        secondaryInterval,
        intl
      ),
    [data, primaryKind, secondaryKind, primaryInterval, secondaryInterval, intl]
  );

  const hasData = pivot.rows.length > 0;

  const onCellClick = (
    rowFilterValue: string | number,
    colFilterValue?: string | number
  ) => {
    if (!interactive || !handleRedirect) return;
    const filter: Record<string, unknown> = { [pFilterKey]: [rowFilterValue] };
    if (colFilterValue !== undefined && colFilterValue !== null && String(colFilterValue).length > 0) {
      filter[sFilterKey] = [colFilterValue];
    }
    handleRedirect({ filter });
  };

  return (
    <Card loading={loading && !data} error={!!error}>
      <CardHeader options={<ViewToggle view={view} setView={setView} options={options} />}>
        <CardTitle>{title}</CardTitle>
        {subtitleKey && (
          <CardDescription>
            <FormattedMessage id={subtitleKey} defaultMessage="Number of occurrences" />
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {loading && !data && (
          <div>
            <Skeleton className="g-h-6 g-mb-2" />
            <Skeleton className="g-h-40 g-w-full" />
          </div>
        )}
        {!loading && !hasData && (
          <div className="g-text-center g-text-slate-400 g-py-4">
            <FormattedMessage id="dashboard.noData" defaultMessage="No data" />
          </div>
        )}
        {hasData && view === 'TABLE' && (
          <HeatmapTable
            pivot={pivot}
            primaryTitle={primaryTitle}
            secondaryTitle={secondaryTitle}
            interactive={!!interactive}
            onCellClick={onCellClick}
          />
        )}
        {hasData && view === 'COLUMN' && (
          <ColumnView
            pivot={pivot}
            interactive={!!interactive}
            onCellClick={onCellClick}
            palette={palette ?? []}
            seriesName={intl.formatMessage({ id: 'dashboard.occurrences' })}
          />
        )}
        {hasData && view === 'LIST' && (
          <ListView
            pivot={pivot}
            primaryTitle={primaryTitle}
            secondaryTitle={secondaryTitle}
            interactive={!!interactive}
            onCellClick={onCellClick}
          />
        )}
      </CardContent>
    </Card>
  );
}

type ViewToggleProps = {
  view: TwoDimChartView;
  setView: (v: TwoDimChartView) => void;
  options: TwoDimChartView[];
};

function ViewToggle({ view, setView, options }: ViewToggleProps) {
  if (options.length < 2) return null;
  const iconMap: Record<TwoDimChartView, React.ReactNode> = {
    TABLE: <MdViewStream />,
    COLUMN: <BsFillBarChartFill />,
    LIST: <MdViewList />,
  };
  return (
    <div>
      {options.map((o) => (
        <Button
          key={o}
          variant="link"
          style={{ padding: '0 5px', height: 'auto' }}
          className={`g-m-0 ${view === o ? 'g-text-primary-500' : 'g-text-slate-400'}`}
          onClick={() => setView(o)}
        >
          {iconMap[o]}
        </Button>
      ))}
    </div>
  );
}

type HeatmapTableProps = {
  pivot: PivotData;
  primaryTitle?: React.ReactNode;
  secondaryTitle?: React.ReactNode;
  interactive: boolean;
  onCellClick: (rowFilterValue: string | number, colFilterValue?: string | number) => void;
};

function HeatmapTable({
  pivot,
  primaryTitle,
  secondaryTitle,
  interactive,
  onCellClick,
}: HeatmapTableProps) {
  const { rows, columns, matrix, rowTotals, min, max } = pivot;
  if (columns.length === 0) {
    return (
      <div className="g-text-center g-text-slate-400 g-py-4">
        <FormattedMessage
          id="dashboard.noData"
          defaultMessage="No data"
        />
      </div>
    );
  }

  return (
    <div className="g-overflow-x-auto">
      <Table removeBorder>
        <thead className="[&_th]:g-text-sm [&_th]:g-font-normal [&_th]:g-py-2 [&_th]:g-text-slate-500 [&_th]:g-align-bottom">
          <tr>
            <th className="g-text-start g-whitespace-nowrap">{primaryTitle}</th>
            <th className="g-text-end g-whitespace-nowrap">
              <FormattedMessage id="metrics.count" defaultMessage="Total" />
            </th>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className="g-text-end g-whitespace-nowrap"
                style={{ maxWidth: 120 }}
                title={`${secondaryTitle ?? ''}: ${c.label}`}
              >
                <div
                  className="g-truncate"
                  style={{ maxWidth: 120, display: 'inline-block', verticalAlign: 'bottom' }}
                >
                  {c.label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:g-align-baseline">
          {rows.map((row, rIdx) => (
            <tr key={String(row.key)} className="g-border-t g-border-slate-200">
              <td className="g-whitespace-nowrap">
                {interactive ? (
                  <button
                    type="button"
                    className="g-text-start hover:g-underline"
                    onClick={() => onCellClick(row.filterValue)}
                  >
                    {row.label}
                  </button>
                ) : (
                  <div>{row.label}</div>
                )}
              </td>
              <td className="g-text-end g-tabular-nums">
                <FormattedNumber value={rowTotals[rIdx] || row.count} />
              </td>
              {columns.map((col, cIdx) => {
                const value = matrix[rIdx][cIdx];
                const shade = logShade(value, min, max);
                const cellStyle: React.CSSProperties = {
                  backgroundColor:
                    value > 0
                      ? `rgb(var(--primary) / ${shade.toFixed(3)})`
                      : 'transparent',
                  cursor: interactive && value > 0 ? 'pointer' : 'default',
                  textAlign: 'end',
                  minWidth: 40,
                };
                const content =
                  value > 0 ? <FormattedNumber value={value} /> : <span className="g-text-slate-300">—</span>;
                if (!interactive || value === 0) {
                  return (
                    <td key={String(col.key)} style={cellStyle} className="g-tabular-nums">
                      {content}
                    </td>
                  );
                }
                return (
                  <td key={String(col.key)} style={cellStyle} className="g-tabular-nums">
                    <Tooltip
                      asChild
                      title={
                        <span>
                          {row.label} × {col.label}: <FormattedNumber value={value} />
                          {rowTotals[rIdx] > 0 && (
                            <>
                              {' '}
                              ({formatAsPercentage(value / rowTotals[rIdx])} of row)
                            </>
                          )}
                        </span>
                      }
                      side="top"
                    >
                      <button
                        type="button"
                        className="g-w-full g-text-end"
                        onClick={() => onCellClick(row.filterValue, col.filterValue)}
                      >
                        {content}
                      </button>
                    </Tooltip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

type ListViewProps = {
  pivot: PivotData;
  primaryTitle?: React.ReactNode;
  secondaryTitle?: React.ReactNode;
  interactive: boolean;
  onCellClick: (rowFilterValue: string | number, colFilterValue?: string | number) => void;
};

function ListView({
  pivot,
  primaryTitle,
  secondaryTitle,
  interactive,
  onCellClick,
}: ListViewProps) {
  const { rows } = pivot;
  return (
    <div className="g-overflow-x-auto">
      <Table removeBorder>
        <thead className="[&_th]:g-text-sm [&_th]:g-font-normal [&_th]:g-py-2 [&_th]:g-text-slate-500">
          <tr>
            <th className="g-text-start g-whitespace-nowrap">{primaryTitle}</th>
            <th className="g-text-end g-whitespace-nowrap">
              <FormattedMessage id="metrics.count" defaultMessage="Total" />
            </th>
            <th className="g-text-start">
              <span className="g-text-slate-500">
                <FormattedMessage id="dashboard.top" defaultMessage="Top" />{' '}
                {secondaryTitle ? <>· {secondaryTitle}</> : null}
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="[&_td]:g-align-baseline">
          {rows.map((row) => (
            <tr key={String(row.key)} className="g-border-t g-border-slate-200">
              <td className="g-whitespace-nowrap g-pe-2">
                {interactive ? (
                  <button
                    type="button"
                    className="g-text-start hover:g-underline"
                    onClick={() => onCellClick(row.filterValue)}
                  >
                    {row.label}
                  </button>
                ) : (
                  <div>{row.label}</div>
                )}
              </td>
              <td className="g-text-end g-tabular-nums g-pe-3">
                <FormattedNumber value={row.count} />
              </td>
              <td>
                <SecondaryInline
                  row={row}
                  interactive={interactive}
                  onClick={(s) => onCellClick(row.filterValue, s.filterValue)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

type SecondaryInlineProps = {
  row: NormalizedRow;
  interactive: boolean;
  onClick: (s: NormalizedBucket) => void;
};

function SecondaryInline({ row, interactive, onClick }: SecondaryInlineProps) {
  if (row.secondary.length === 0) {
    return <span className="g-text-slate-300">—</span>;
  }
  return (
    <div className="g-flex g-flex-wrap g-gap-x-3 g-gap-y-1">
      {row.secondary.map((s) => {
        const inner = (
          <>
            <span>{s.label}</span>
            <span className="g-text-slate-400 g-ms-1 g-tabular-nums">
              <FormattedNumber value={s.count} />
            </span>
          </>
        );
        return (
          <span key={String(s.key)} className="g-whitespace-nowrap">
            {interactive ? (
              <button
                type="button"
                className="hover:g-underline g-text-start"
                onClick={() => onClick(s)}
              >
                {inner}
              </button>
            ) : (
              <span>{inner}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

type ColumnViewProps = {
  pivot: PivotData;
  interactive: boolean;
  onCellClick: (rowFilterValue: string | number, colFilterValue?: string | number) => void;
  palette: string[];
  seriesName: string;
};

function ColumnView({ pivot, interactive, onCellClick, palette, seriesName: _seriesName }: ColumnViewProps) {
  const { rows, columns, matrix } = pivot;
  // One series per secondary value (column). x-axis = primary rows.
  const series = columns.map((col, colIdx) => ({
    name: col.label,
    type: 'column' as const,
    color: palette?.[colIdx % (palette.length || 1)],
    data: matrix.map((row, rIdx) => ({
      y: row[colIdx],
      name: rows[rIdx].label,
      __rowFilter: rows[rIdx].filterValue,
      __colFilter: col.filterValue,
    })),
  }));

  const options = {
    chart: {
      animation: false,
      type: 'column',
      height: 360,
    },
    title: { text: '' },
    credits: { enabled: false },
    xAxis: {
      categories: rows.map((r) => r.label),
      crosshair: true,
      labels: {
        formatter: function (this: { value: unknown }) {
          const s = String(this.value);
          return s.length > 24 ? s.slice(0, 24) + '…' : s;
        },
      },
      lineColor: '#d0d2da',
    },
    yAxis: {
      title: {
        text: _seriesName,
      },
      gridLineDashStyle: 'LongDash',
      lineColor: '#d0d2da',
    },
    tooltip: {
      headerFormat: '<span style="font-size:11px">{point.key}</span><br/>',
      pointFormat: '<span style="color:{point.color}">●</span> {series.name}: <b>{point.y}</b><br/>',
    },
    plotOptions: {
      column: {
        animation: false,
        cursor: interactive ? 'pointer' : 'default',
        borderWidth: 0,
        groupPadding: 0.08,
        point: interactive
          ? {
              events: {
                click: function (this: {
                  __rowFilter?: string | number;
                  __colFilter?: string | number;
                }) {
                  if (this.__rowFilter !== undefined) {
                    onCellClick(this.__rowFilter, this.__colFilter);
                  }
                },
              },
            }
          : {},
      },
    },
    series,
    exporting: { buttons: { contextButton: { enabled: false } } },
    legend: {
      itemStyle: { width: '200px', textOverflow: 'ellipsis', overflow: 'hidden' },
    },
  };

  return (
    <div className="g-overflow-x-auto">
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        containerProps={{
          style: { minWidth: Math.max(400, rows.length * Math.max(1, columns.length) * 12) },
        }}
      />
    </div>
  );
}
