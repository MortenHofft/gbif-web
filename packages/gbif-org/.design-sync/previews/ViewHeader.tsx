import { ViewHeader } from 'new-gbif-org-ts';

// The small results-count line shown above occurrence/taxon/literature search
// result views (see src/routes/occurrence/search/views/table/occurrenceTable.tsx).
export const OccurrenceResultCount = () => <ViewHeader total={307616900} />;

export const DatasetResultCount = () => <ViewHeader total={2317} message="counts.nDatasets" />;

export const WithCoordinates = () => (
  <ViewHeader total={128442913} message="counts.nResultsWithCoordinates" />
);

export const Loading = () => <ViewHeader loading />;
