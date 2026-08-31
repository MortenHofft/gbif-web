import { ResourceSearchQueryVariables, ResourceSortBy, ResourceSortOrder } from '@/gql/graphql';
import { useParam } from '@/hooks/useParam';

export type ResourceSortValue = 'relevance' | 'createdAt_desc' | 'createdAt_asc';

const VALID_SORTS: ResourceSortValue[] = ['relevance', 'createdAt_desc', 'createdAt_asc'];

function parseSort(value?: string): ResourceSortValue | undefined {
  return VALID_SORTS.includes(value as ResourceSortValue)
    ? (value as ResourceSortValue)
    : undefined;
}

// The explicit sort choice, if any. `undefined` means "use the contextual default"
// (relevance while free-text searching, newest first otherwise) - see getDefaultResourceSort.
export function useResourceSort(): [
  ResourceSortValue | undefined,
  (value: ResourceSortValue | undefined) => void,
] {
  return useParam<ResourceSortValue | undefined>({
    key: 'sort',
    parse: parseSort,
  });
}

export function getDefaultResourceSort(hasQuery: boolean): ResourceSortValue {
  return hasQuery ? 'relevance' : 'createdAt_desc';
}

export function getResourceSortVariables(
  sort: ResourceSortValue
): Pick<ResourceSearchQueryVariables, 'sortBy' | 'sortOrder'> {
  switch (sort) {
    case 'createdAt_asc':
      return { sortBy: ResourceSortBy.CreatedAt, sortOrder: ResourceSortOrder.Asc };
    case 'createdAt_desc':
      return { sortBy: ResourceSortBy.CreatedAt, sortOrder: ResourceSortOrder.Desc };
    case 'relevance':
      // Omitting sortBy makes the es-api fall back to its relevance (_score) sort.
      return { sortBy: undefined, sortOrder: undefined };
  }
}
