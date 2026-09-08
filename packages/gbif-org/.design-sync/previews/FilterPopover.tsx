import * as React from 'react';
import { Button, Checkbox, FilterPopover, Label } from 'new-gbif-org-ts';

// FilterPopover calls React.Children.only(children), so it needs exactly ONE
// element child, and it clones that child with onApply/onCancel/pristine plus a
// ref — hence forwardRef. Ported from src/components/filters/More.tsx and
// filterTools.tsx, which are the only two real call sites.

type PanelProps = {
  onApply?: (args: { keepOpen?: boolean }) => void;
  onCancel?: () => void;
  pristine?: boolean;
};

const FilterPanel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ onApply, onCancel, pristine }, ref) => (
    <div ref={ref} className="g-p-3 g-w-72">
      <div className="g-flex g-flex-col g-gap-2 g-mb-3">
        {['Human observation', 'Preserved specimen', 'Machine observation', 'Material sample'].map(
          (label) => (
            <div key={label} className="g-flex g-items-center g-gap-2">
              <Checkbox id={label} defaultChecked={label === 'Human observation'} />
              <Label htmlFor={label} className="g-text-sm g-font-normal">
                {label}
              </Label>
            </div>
          ),
        )}
      </div>
      <div className="g-flex g-justify-end g-gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={pristine} onClick={() => onApply?.({})}>
          Apply
        </Button>
      </div>
    </div>
  ),
);
FilterPanel.displayName = 'FilterPanel';

export const BasisOfRecordFilter = () => (
  <FilterPopover
    open
    title="Basis of record"
    trigger={
      <Button variant="primaryOutline" size="sm">
        Basis of record
      </Button>
    }
  >
    <FilterPanel />
  </FilterPopover>
);

export const ClosedTrigger = () => (
  <FilterPopover
    title="Issues and flags"
    trigger={
      <Button variant="primaryOutline" size="sm">
        Issues and flags
      </Button>
    }
  >
    <FilterPanel />
  </FilterPopover>
);
