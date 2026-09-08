import { Switch, Label } from 'new-gbif-org-ts';

export const States = () => (
  <div className="g-flex g-flex-col g-gap-3">
    <div className="g-flex g-items-center g-gap-2">
      <Switch id="sw-off" />
      <Label htmlFor="sw-off">Off</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Switch id="sw-on" defaultChecked />
      <Label htmlFor="sw-on">On</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Switch id="sw-disabled" disabled />
      <Label htmlFor="sw-disabled">Disabled</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Switch id="sw-disabled-on" disabled defaultChecked />
      <Label htmlFor="sw-disabled-on">Disabled, on</Label>
    </div>
  </div>
);

export const DownloadOptions = () => (
  <div className="g-flex g-flex-col g-gap-3">
    <div className="g-flex g-items-center g-gap-2">
      <Switch id="opt-verbatim" defaultChecked />
      <Label htmlFor="opt-verbatim">Include verbatim extension</Label>
    </div>
    <div className="g-flex g-items-center g-gap-2">
      <Switch id="opt-multimedia" />
      <Label htmlFor="opt-multimedia">Include multimedia extension</Label>
    </div>
  </div>
);
