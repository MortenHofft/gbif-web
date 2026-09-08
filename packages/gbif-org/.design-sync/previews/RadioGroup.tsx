import { RadioGroup, RadioGroupItem, Label } from 'new-gbif-org-ts';

export const Basic = () => (
  <RadioGroup defaultValue="species" className="g-flex g-flex-col g-gap-2">
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="species" id="rank-species" />
      <Label htmlFor="rank-species">Species</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="genus" id="rank-genus" />
      <Label htmlFor="rank-genus">Genus</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="family" id="rank-family" />
      <Label htmlFor="rank-family">Family</Label>
    </div>
  </RadioGroup>
);

export const SortOrder = () => (
  <RadioGroup defaultValue="yearDesc" className="g-flex g-flex-col g-gap-2">
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="default" id="sort-default" />
      <Label htmlFor="sort-default">Default order</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="random" id="sort-random" />
      <Label htmlFor="sort-random">Random</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="yearDesc" id="sort-year-desc" />
      <Label htmlFor="sort-year-desc">Year, newest first</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="yearAsc" id="sort-year-asc" />
      <Label htmlFor="sort-year-asc">Year, oldest first</Label>
    </div>
  </RadioGroup>
);

export const Disabled = () => (
  <RadioGroup defaultValue="csv" disabled className="g-flex g-flex-col g-gap-2">
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="csv" id="fmt-csv" />
      <Label htmlFor="fmt-csv">Simple CSV</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <RadioGroupItem value="dwca" id="fmt-dwca" />
      <Label htmlFor="fmt-dwca">Darwin Core Archive</Label>
    </div>
  </RadioGroup>
);
