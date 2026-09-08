import { TableOfContents } from 'new-gbif-org-ts';

// The "On this page" sidebar shown alongside dataset About pages
// (see src/routes/dataset/key/about.tsx).
const datasetSections = [
  { id: 'description', title: <>Description</> },
  { id: 'geographic-description', title: <>Geographic scope</> },
  { id: 'taxonomic-description', title: <>Taxonomic scope</> },
  { id: 'bibliography', title: <>Bibliography</> },
  { id: 'contacts', title: <>Contacts</> },
  { id: 'citation', title: <>Citation</> },
];

export const DatasetAboutSidebar = () => (
  <TableOfContents sections={datasetSections} className="g-max-w-[220px]" />
);

export const WithHiddenSection = () => (
  <TableOfContents
    sections={[
      { id: 'description', title: <>Description</> },
      { id: 'purpose', title: <>Purpose</>, hidden: true },
      { id: 'methodology', title: <>Methodology</> },
      { id: 'registration', title: <>Registration</> },
      { id: 'citation', title: <>Citation</> },
    ]}
    className="g-max-w-[220px]"
  />
);

export const ShortList = () => (
  <TableOfContents
    sections={[
      { id: 'about', title: <>About</> },
      { id: 'metrics', title: <>Metrics</> },
      { id: 'download', title: <>Download</> },
    ]}
    className="g-max-w-[220px]"
  />
);
