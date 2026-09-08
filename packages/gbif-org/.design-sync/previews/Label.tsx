import { Label, Input, Checkbox } from 'new-gbif-org-ts';

export const Basic = () => (
  <div className="g-flex g-flex-col g-gap-1.5 g-max-w-sm">
    <Label htmlFor="publisher">Publisher</Label>
    <Input id="publisher" defaultValue="GBIF Secretariat" />
  </div>
);

export const WithCheckbox = () => (
  <div className="g-flex g-items-center g-gap-2">
    <Checkbox id="terms" defaultChecked />
    <Label htmlFor="terms">I agree to the GBIF Data User Agreement</Label>
  </div>
);

export const Disabled = () => (
  <div className="g-flex g-items-center g-gap-2 g-peer" aria-disabled>
    <Checkbox id="disabled-peer" disabled className="g-peer" />
    <Label htmlFor="disabled-peer" className="peer-disabled:g-cursor-not-allowed peer-disabled:g-opacity-70">
      Basis of record (locked for this dataset type)
    </Label>
  </div>
);
