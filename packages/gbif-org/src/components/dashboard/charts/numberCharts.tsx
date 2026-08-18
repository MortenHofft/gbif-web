import { FormattedMessage } from 'react-intl';
import { ChartWrapper } from './EnumChartGenerator';
import { DynamicLink } from '@/reactRouterPlugins';

type NumberChartProps = {
  predicate?: unknown;
  detailsRoute?: string;
  currentFilter?: Record<string, unknown>; //excluding root predicate
  [key: string]: unknown;
};

export function Elevation({
  predicate,
  detailsRoute,
  currentFilter = {}, // excluding root predicate
  ...props
}: NumberChartProps) {
  const GQL_QUERY = `
    query summary($q: String, $predicate: Predicate, $hasPredicate: Predicate) {
      search: occurrenceSearch(q: $q, predicate: $predicate) {
        documents(size: 0) {
          total
        }
        facet: histogram {
          results: elevation(interval: 100) {
            interval
            buckets {
              key
              count
              occurrences {
                metaPredicate
                _meta
              }
            }
          }
        }
      }
      isNotNull: occurrenceSearch(q: $q, predicate: $hasPredicate) {
        documents(size: 0) {
          total
        }
      }
    }
  `;
  return (
    <ChartWrapper
      {...{
        predicate,
        detailsRoute,
        currentFilter,
        gqlQuery: GQL_QUERY,
        predicateKey: 'elevation',
        disableUnknown: true,
        disableOther: true,
        title: <FormattedMessage id="filters.elevation.name" defaultMessage="Elevation" />,
        subtitleKey: 'dashboard.numberOfOccurrences',
        defaultOption: 'COLUMN',
        options: ['COLUMN', 'TABLE', 'MAP'],
        transform: (data: unknown) => {
          return data?.search?.facet?.results?.buckets?.map((x) => {
            const keyAsInt = parseInt(x.key, 10);
            return {
              key: x.key,
              title: (
                <span>
                  {keyAsInt}, {keyAsInt + 99}
                </span>
              ),
              plainTextTitle: `${keyAsInt}, ${keyAsInt + 99}`,
              count: x.count,
              occurrences: x.occurrences,
              filter: {
                elevation: [
                  {
                    type: 'range',
                    value: {
                      gte: keyAsInt,
                      lte: keyAsInt + 99,
                    },
                  },
                ],
              },
            };
          });
        },
      }}
      {...props}
    />
  );
}
