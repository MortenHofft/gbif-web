import EmptyTab from '@/components/EmptyTab';
import { useDatasetKeyContext } from '../datasetKey';
import InferredEventsDatasetEvents from './inferredFromOccurrence/inferredEventsDatasetEvents';
import SamplingEventDatasetEvents from './samplingEvent/samplingEventDatasetEvents';

/**
 * Dispatcher for the dataset "Events" tab.
 *
 * Two distinct flows live behind this single route, each with their own
 * folder of components:
 *   - Datasets with events indexed in the event API render `SamplingEventDatasetEvents`
 *     (event-API powered browser, with a feature-flag fallback). This covers
 *     both SAMPLING_EVENT datasets and DwC data packages.
 *   - Other datasets render `InferredEventsDatasetEvents`, which derives
 *     events from `eventID`/`parentEventID` on occurrence records.
 */
const DatasetEvents = () => {
  const { showEventsTab, hasEventsInApi } = useDatasetKeyContext();

  if (!showEventsTab) return <EmptyTab />;

  if (hasEventsInApi) {
    return <SamplingEventDatasetEvents />;
  }

  return <InferredEventsDatasetEvents />;
};

export default DatasetEvents;
