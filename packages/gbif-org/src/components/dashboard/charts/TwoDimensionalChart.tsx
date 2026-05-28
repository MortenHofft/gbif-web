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
import { MdViewStream } from 'react-icons/md';
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl';
import { useDeepCompareEffectNoCheck as useDeepCompareEffect } from 'use-deep-compare-effect';
import { useUncontrolledProp } from 'uncontrollable';
import { Card, CardHeader, Table } from '../shared';
import ChartClickWrapper from './ChartClickWrapper';
import Highcharts, { generateChartsPalette } from './highcharts';

export type TwoDimChartView = 'TABLE' | 'COLUMN';

export type TwoDimensionalChartProps = {
  predicate?: unknown;
  q?: string;
  primaryField: string;
  secondaryField: string;
  primaryFilterKey?: string;
  secondaryFilterKey?: string;
  primarySize?: number;
  secondarySize?: number;
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

type Bucket = {
  key: string | number;
  count: number;
  label?: string | null;
};

type NestedBucket = Bucket & {
  occurrences?: {
    facet?: {
      secondary?: Bucket[];
    };
  };
};

type TwoDimResponse = {
  search?: {
    documents?: { total?: number };
    cardinality?: { primary?: number };
    facet?: {
      primary?: NestedBucket[];
    };
  };
};

type PivotData = {
  rows: Array<{ key: string | number; label: string; count: number }>;
  columns: Array<{ key: string | number; label: string; count: number }>;
  matrix: number[][]; // matrix[rowIdx][colIdx]
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

function buildQuery({
  primaryField,
  secondaryField,
}: {
  primaryField: string;
  secondaryField: string;
}): string {
  return `
    query twoDim($q: String, $predicate: Predicate, $size: Int, $secondarySize: Int, $lang: String) {
      search: occurrenceSearch(q: $q, predicate: $predicate) {
        documents(size: 0) { total }
        cardinality { primary: ${primaryField} }
        facet {
          primary: ${primaryField}(size: $size) {
            key
            label(language: $lang)
            count
            occurrences {
              facet {
                secondary: ${secondaryField}(size: $secondarySize) {
                  key
                  label(language: $lang)
                  count
                }
              }
            }
          }
        }
      }
    }
  `;
}

function buildPivot(primary: NestedBucket[]): PivotData {
  // Collect rows in order returned by the API (descending count).
  const rows = primary.map((p) => ({
    key: p.key,
    label: String(p.label ?? p.key),
    count: p.count ?? 0,
  }));

  // Collect column union across all primary buckets, summing counts.
  const columnMap = new Map<string, { key: string | number; label: string; count: number }>();
  primary.forEach((p) => {
    p.occurrences?.facet?.secondary?.forEach((s) => {
      const k = String(s.key);
      const existing = columnMap.get(k);
      if (existing) {
        existing.count += s.count ?? 0;
      } else {
        columnMap.set(k, {
          key: s.key,
          label: String(s.label ?? s.key),
          count: s.count ?? 0,
        });
      }
    });
  });
  const columns = Array.from(columnMap.values()).sort((a, b) => b.count - a.count);
  const colIndex = new Map(columns.map((c, i) => [String(c.key), i]));

  // Fill matrix
  const matrix: number[][] = primary.map(() => columns.map(() => 0));
  primary.forEach((p, rowIdx) => {
    p.occurrences?.facet?.secondary?.forEach((s) => {
      const c = colIndex.get(String(s.key));
      if (c !== undefined) {
        matrix[rowIdx][c] = s.count ?? 0;
      }
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
  primaryFilterKey,
  secondaryFilterKey,
  primarySize = 10,
  secondarySize = 10,
  title,
  primaryTitle,
  secondaryTitle,
  subtitleKey,
  options = ['TABLE', 'COLUMN'],
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
    () => buildQuery({ primaryField, secondaryField }),
    [primaryField, secondaryField]
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
        lang: locale.vocabularyLocale ?? locale.localeCode,
      },
      queue: { name: 'dashboard' },
    });
  }, [predicate, q, primarySize, secondarySize, query, locale]);

  const pFilterKey = primaryFilterKey ?? primaryField;
  const sFilterKey = secondaryFilterKey ?? secondaryField;

  const pivot = useMemo(
    () => buildPivot(data?.search?.facet?.primary ?? []),
    [data]
  );

  const hasData = pivot.rows.length > 0 && pivot.columns.length > 0;

  const onCellClick = (rowKey: string | number, colKey?: string | number) => {
    if (!interactive || !handleRedirect) return;
    const filter: Record<string, unknown> = { [pFilterKey]: [rowKey] };
    if (colKey !== undefined && colKey !== null && String(colKey).length > 0) {
      filter[sFilterKey] = [colKey];
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
  onCellClick: (rowKey: string | number, colKey?: string | number) => void;
};

function HeatmapTable({
  pivot,
  primaryTitle,
  secondaryTitle,
  interactive,
  onCellClick,
}: HeatmapTableProps) {
  const { rows, columns, matrix, rowTotals, min, max } = pivot;

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
                    onClick={() => onCellClick(row.key)}
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
                        onClick={() => onCellClick(row.key, col.key)}
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

type ColumnViewProps = {
  pivot: PivotData;
  interactive: boolean;
  onCellClick: (rowKey: string | number, colKey?: string | number) => void;
  palette: string[];
  seriesName: string;
};

function ColumnView({ pivot, interactive, onCellClick, palette, seriesName }: ColumnViewProps) {
  const { rows, columns, matrix } = pivot;
  // One series per secondary value (column). x-axis = primary rows.
  const series = columns.map((col, colIdx) => ({
    name: col.label,
    type: 'column' as const,
    color: palette?.[colIdx % (palette.length || 1)],
    data: matrix.map((row, rIdx) => ({
      y: row[colIdx],
      name: rows[rIdx].label,
      __rowKey: rows[rIdx].key,
      __colKey: col.key,
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
        text: seriesName,
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
                  __rowKey?: string | number;
                  __colKey?: string | number;
                }) {
                  if (this.__rowKey !== undefined) {
                    onCellClick(this.__rowKey, this.__colKey);
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
        containerProps={{ style: { minWidth: Math.max(400, rows.length * columns.length * 12) } }}
      />
    </div>
  );
}
