import { TabLink } from 'new-gbif-org-ts';

// The About / Metrics / Download tab row above dataset and occurrence pages
// (see src/components/tabs.tsx, used from src/routes/dataset/key/datasetKey.tsx).
export const DatasetTabs = () => (
  <ul className="g-flex g-border-b g-border-slate-200">
    <li>
      <TabLink to="/dataset/38b4c89f-584c-41bb-bd8f-cd1def33e92f" isActive autoDetectActive>
        About
      </TabLink>
    </li>
    <li>
      <TabLink to="/dataset/38b4c89f-584c-41bb-bd8f-cd1def33e92f/metrics" autoDetectActive>
        Metrics
      </TabLink>
    </li>
    <li>
      <TabLink to="/dataset/38b4c89f-584c-41bb-bd8f-cd1def33e92f/download" autoDetectActive>
        Download
      </TabLink>
    </li>
  </ul>
);

export const ActiveTab = () => (
  <TabLink to="/occurrence/search" isActive>
    Occurrences
  </TabLink>
);

export const InactiveTab = () => <TabLink to="/occurrence/search">Occurrences</TabLink>;
