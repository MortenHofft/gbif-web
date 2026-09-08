import { Input, Label } from 'new-gbif-org-ts';

export const Basic = () => (
  <div className="g-flex g-flex-col g-gap-3 g-max-w-sm">
    <Input placeholder="Search occurrences" />
    <Input type="search" placeholder="Search species, e.g. Pica pica" />
    <Input type="email" placeholder="you@institution.org" />
  </div>
);

export const WithLabel = () => (
  <div className="g-flex g-flex-col g-gap-1.5 g-max-w-sm">
    <Label htmlFor="dataset-title">Dataset title</Label>
    <Input id="dataset-title" defaultValue="iNaturalist Research-grade Observations" />
  </div>
);

export const States = () => (
  <div className="g-flex g-flex-col g-gap-3 g-max-w-sm">
    <Input defaultValue="Naturalis Biodiversity Center" />
    <Input placeholder="Disabled" disabled />
    <Input defaultValue="10.15468/dl.abc123" readOnly />
  </div>
);

export const Types = () => (
  <div className="g-flex g-flex-col g-gap-3 g-max-w-sm">
    <Input type="number" defaultValue={307616900} />
    <Input type="date" defaultValue="2026-09-08" />
    <Input type="file" />
  </div>
);
