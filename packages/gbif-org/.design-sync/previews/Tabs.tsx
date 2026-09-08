import { Tabs, TabsContent, TabsList, TabsTrigger } from 'new-gbif-org-ts';

// defaultValue renders one tab's content statically, matching how a dataset page's
// About / Metrics / Download tabs work.
export const DatasetTabs = () => (
  <Tabs defaultValue="about" className="g-w-full g-max-w-lg">
    <TabsList>
      <TabsTrigger value="about">About</TabsTrigger>
      <TabsTrigger value="metrics">Metrics</TabsTrigger>
      <TabsTrigger value="download">Download</TabsTrigger>
    </TabsList>
    <TabsContent value="about" className="g-text-sm">
      iNaturalist Research-grade Observations is published by the National Biodiversity Data
      Centre and contains 3,820,133,099 human observation records, licensed CC BY 4.0.
    </TabsContent>
  </Tabs>
);

export const MetricsTabSelected = () => (
  <Tabs defaultValue="metrics" className="g-w-full g-max-w-lg">
    <TabsList>
      <TabsTrigger value="about">About</TabsTrigger>
      <TabsTrigger value="metrics">Metrics</TabsTrigger>
      <TabsTrigger value="download">Download</TabsTrigger>
    </TabsList>
    <TabsContent value="metrics" className="g-text-sm">
      2,297,674 species · 189 countries and territories · Basis of record: 62% human observation,
      31% preserved specimen, 7% material sample.
    </TabsContent>
  </Tabs>
);

export const DisabledTab = () => (
  <Tabs defaultValue="about" className="g-w-full g-max-w-lg">
    <TabsList>
      <TabsTrigger value="about">About</TabsTrigger>
      <TabsTrigger value="metrics">Metrics</TabsTrigger>
      <TabsTrigger value="download" disabled>
        Download
      </TabsTrigger>
    </TabsList>
    <TabsContent value="about" className="g-text-sm">
      Downloads are disabled while this dataset is being reprocessed by GBIF's indexing pipeline.
    </TabsContent>
  </Tabs>
);
