import { Checkbox, Label } from 'new-gbif-org-ts';

export const States = () => (
  <div className="g-flex g-flex-col g-gap-3">
    <div className="g-flex g-items-center g-gap-2">
      <Checkbox id="cb-unchecked" />
      <Label htmlFor="cb-unchecked">Unchecked</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Checkbox id="cb-checked" defaultChecked />
      <Label htmlFor="cb-checked">Checked</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Checkbox id="cb-disabled" disabled />
      <Label htmlFor="cb-disabled">Disabled</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Checkbox id="cb-disabled-checked" disabled defaultChecked />
      <Label htmlFor="cb-disabled-checked">Disabled, checked</Label>
    </div>
  </div>
);

export const BasisOfRecordFilter = () => (
  <div className="g-flex g-flex-col g-gap-2">
    <div className="g-flex g-items-center g-gap-2">
      <Checkbox id="bor-preserved" defaultChecked />
      <Label htmlFor="bor-preserved">Preserved specimen</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Checkbox id="bor-human" defaultChecked />
      <Label htmlFor="bor-human">Human observation</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Checkbox id="bor-material" />
      <Label htmlFor="bor-material">Material sample</Label>
    </div>
  </div>
);
