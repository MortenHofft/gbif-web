import React from 'react';
import { FormattedMessage } from 'react-intl';
import { ChartWrapper } from './EnumChartGenerator';
import { FacetResultRow } from './GroupByTable';

type TimeChartProps = {
  predicate?: unknown;
  detailsRoute?: string;
  fieldName?: string;
  translationTemplate?: string; // will fallback to "enums.{fieldName}.{key}"
  facetSize?: number;
  disableOther?: boolean;
  disableUnknown?: boolean;
  currentFilter?: Record<string, unknown>; // excluding root predicate
  gqlEntity?: string;
  [key: string]: unknown;
};

type DateBucket = {
  key: string;
  utc: number;
  date: string;
  title: string;
  count: number;
};

type DateHistogramData = {
  search?: {
    facet?: {
      results?: {
        interval?: string;
        buckets?: DateBucket[];
      };
    };
  };
};

const GEOLOGICAL_TIME_INTERVAL_OPTIONS = [10, 25, 50, 100, 250];

type GeologicalTimeBucket = {
  key: number;
  count: number;
};

type GeologicalTimeData = {
  search?: {
    facet?: {
      results?: {
        interval?: number;
        buckets?: GeologicalTimeBucket[];
      };
    };
  };
};

export function GeologicalTime({
  predicate,
  detailsRoute,
  currentFilter = {},
  ...props
}: TimeChartProps) {
  const [interval, setIntervalValue] = React.useState(50);

  const GQL_QUERY = `
    query summary($predicate: Predicate) {
      search: occurrenceSearch(predicate: $predicate) {
        documents(size: 0) {
          total
        }
        facet: histogram {
          results: geologicalTime(interval: ${interval}) {
            interval
            buckets {
              key
              count
            }
          }
        }
      }
    }
  `;

  const intervalSelector = (
    <div className="g-flex g-items-center g-gap-1 g-flex-wrap">
      <span>
        <FormattedMessage id="filters.geologicalTime.name" defaultMessage="Interval" />:{' '}
      </span>
      {GEOLOGICAL_TIME_INTERVAL_OPTIONS.map((v) => (
        <button
          key={v}
          onClick={() => setIntervalValue(v)}
          className={`g-px-2 g-py-0.5 g-rounded g-text-xs g-border ${
            interval === v
              ? 'g-border-primary-500 g-text-primary-600 g-font-semibold'
              : 'g-border-slate-300 g-text-slate-500 hover:g-border-slate-400'
          }`}
        >
          {v} Ma
        </button>
      ))}
    </div>
  );

  return (
    <ChartWrapper
      {...{
        predicate,
        detailsRoute,
        gqlQuery: GQL_QUERY,
        currentFilter,
        disableUnknown: true,
        disableOther: true,
        options: ['COLUMN', 'TABLE'],
        messages: [intervalSelector, 'dashboard.geologicalTimeRangeWarning'],
        title: <FormattedMessage id="filters.geologicalTime.name" defaultMessage="Geological time" />,
        predicateKey: 'geologicalTime',
        transform: (data: unknown): FacetResultRow[] | undefined => {
          return (data as GeologicalTimeData)?.search?.facet?.results?.buckets?.map((x) => ({
            key: x.key,
            count: x.count,
            title: `${x.key} Ma`,
          })) as FacetResultRow[] | undefined;
        },
      }}
      {...props}
    />
  );
}

// this is for generating charts for fields that are foreign keys like taxonKey, collectionKey, datasetKey, etc.
// for some fields there will always be a value like datasetKey, but e.g. collectionKey is only sparsely filled.
export function EventDate({
  predicate,
  detailsRoute,
  facetSize,
  disableOther,
  disableUnknown,
  currentFilter = {}, // excluding root predicate
  ...props
}: TimeChartProps) {
  const GQL_QUERY = `
    query summary($q: String, $predicate: Predicate${
      !disableUnknown ? ', $hasPredicate: Predicate' : ''
    }){
      search: occurrenceSearch(q: $q, predicate: $predicate) {
        documents(size: 0) {
          total
        }
        facet: autoDateHistogram {
          results: eventDate(buckets: 50, minimum_interval: "day") {
            interval
            buckets {
              key: date
              utc: key
              date
              title: date
              count
            }
          }
        }
      }
      ${
        !disableUnknown
          ? `isNotNull: occurrenceSearch(q: $q, predicate: $hasPredicate) {
        documents(size: 0) {
          total
        }
      }`
          : ''
      }
    }
  `;
  return (
    <ChartWrapper
      {...{
        predicate,
        detailsRoute,
        gqlQuery: GQL_QUERY,
        currentFilter,
        disableOther,
        disableUnknown,
        options: ['TIME'],
        messages: ['dashboard.usingStartDates'],
        title: <FormattedMessage id="filters.eventDate.name" defaultMessage="Event date" />,
        predicateKey: 'eventDate',
        facetSize,
        transform: (data: unknown): FacetResultRow[] | undefined => {
          return (data as DateHistogramData)?.search?.facet?.results?.buckets?.map((x) => ({
            ...x,
            title: x.date,
          })) as FacetResultRow[] | undefined;
        },
      }}
      {...props}
    />
  );
}

export function LiteratureCreatedAt({
  predicate,
  detailsRoute,
  facetSize,
  disableOther,
  disableUnknown,
  currentFilter = {}, // excluding root predicate
  ...props
}: TimeChartProps) {
  const GQL_QUERY = `
    query summary($predicate: Predicate${!disableUnknown ? ', $hasPredicate: Predicate' : ''}){
      search: literatureSearch(predicate: $predicate) {
        documents(size: 0) {
          total
        }
        facet: autoDateHistogram {
          results: createdAt(buckets: 50, minimum_interval: "day") {
            interval
            buckets {
              key: date
              utc: key
              date
              title: date
              count
            }
          }
        }
      }
      ${
        !disableUnknown
          ? `isNotNull: literatureSearch(predicate: $hasPredicate) {
        documents(size: 0) {
          total
        }
      }`
          : ''
      }
    }
  `;
  return (
    <ChartWrapper
      {...{
        predicate,
        detailsRoute,
        gqlQuery: GQL_QUERY,
        currentFilter,
        disableOther,
        disableUnknown,
        options: ['TIME'],
        title: (
          <FormattedMessage id="filters.publicationDate.name" defaultMessage="Publication date" />
        ),
        predicateKey: 'createdAt',
        facetSize,
        transform: (data: unknown): FacetResultRow[] | undefined => {
          return (data as DateHistogramData)?.search?.facet?.results?.buckets?.map((x) => ({
            ...x,
            title: x.date,
          })) as FacetResultRow[] | undefined;
        },
      }}
      {...props}
    />
  );
}
