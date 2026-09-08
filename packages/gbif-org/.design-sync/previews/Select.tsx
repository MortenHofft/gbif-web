import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from 'new-gbif-org-ts';

export const Closed = () => (
  <div className="g-max-w-sm">
    <Select defaultValue="preserved-specimen">
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="preserved-specimen">Preserved specimen</SelectItem>
        <SelectItem value="human-observation">Human observation</SelectItem>
        <SelectItem value="material-sample">Material sample</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

export const Open = () => (
  <div className="g-max-w-sm">
    <Select defaultValue="human-observation" open modal={false}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="item-aligned">
        <SelectGroup>
          <SelectLabel>Basis of record</SelectLabel>
          <SelectItem value="preserved-specimen">Preserved specimen</SelectItem>
          <SelectItem value="human-observation">Human observation</SelectItem>
          <SelectItem value="material-sample">Material sample</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Other</SelectLabel>
          <SelectItem value="fossil-specimen">Fossil specimen</SelectItem>
          <SelectItem value="living-specimen" disabled>
            Living specimen
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);

export const Disabled = () => (
  <div className="g-max-w-sm">
    <Select defaultValue="csv" disabled>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="csv">Simple CSV</SelectItem>
        <SelectItem value="dwca">Darwin Core Archive</SelectItem>
      </SelectContent>
    </Select>
  </div>
);
