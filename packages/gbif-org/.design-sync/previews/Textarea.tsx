import { Textarea, Label } from 'new-gbif-org-ts';

export const Basic = () => (
  <div className="g-max-w-md">
    <Textarea placeholder="Describe the issue with this occurrence record..." />
  </div>
);

export const WithLabel = () => (
  <div className="g-flex g-flex-col g-gap-1.5 g-max-w-md">
    <Label htmlFor="dataset-desc">Dataset description</Label>
    <Textarea
      id="dataset-desc"
      defaultValue="Citizen science observations of Ctenophorus decresii and other reptile species, contributed through the iNaturalist platform and vetted to research grade."
      rows={4}
    />
  </div>
);

export const States = () => (
  <div className="g-flex g-flex-col g-gap-3 g-max-w-md">
    <Textarea defaultValue="Occurrence flagged: coordinates fall outside the stated country." />
    <Textarea placeholder="Disabled feedback field" disabled />
  </div>
);
