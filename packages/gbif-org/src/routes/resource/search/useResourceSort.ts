import { ResourceSearchQueryVariables, ResourceSortBy, ResourceSortOrder } from '@/gql/graphql';
import { useParam } from '@/hooks/useParam';

export type ResourceSortValue = 'createdAt_desc' | 'createdAt_asc';

const DEFAULT_SORT: ResourceSortValue = 'createdAt_desc';

function parseSort(value?: string): ResourceSortValue {
  return value === 'createdAt_asc' ? 'createdAt_asc' : DEFAULT_SORT;
}

export function useResourceSort(): [ResourceSortValue, (value: ResourceSortValue) => void] {
  return useParam<ResourceSortValue>({
    key: 'sort',
    defaultValue: DEFAULT_SORT,
    hideDefault: true,
    parse: parseSort,
  });
}

export function getResourceSortVariables(
  sort: ResourceSortValue
): Pick<ResourceSearchQueryVariables, 'sortBy' | 'sortOrder'> {
  return sort === 'createdAt_asc'
    ? { sortBy: ResourceSortBy.CreatedAt, sortOrder: ResourceSortOrder.Asc }
    : { sortBy: ResourceSortBy.CreatedAt, sortOrder: ResourceSortOrder.Desc };
}
