import { Popover, PopoverContent, PopoverTrigger } from 'new-gbif-org-ts';

// Rendered `open` so the card shows the popover surface itself — a closed popover has nothing
// to look at. modal={false} keeps the card from scroll-locking.
export const FilterHelp = () => (
  <Popover open modal={false}>
    <PopoverTrigger className="g-underline g-text-sm">Basis of record</PopoverTrigger>
    <PopoverContent className="g-w-80">
      <p className="g-text-sm g-m-0">
        Basis of record describes how the occurrence was recorded — for example a preserved
        specimen, a human observation, or a machine observation from a sensor.
      </p>
    </PopoverContent>
  </Popover>
);

export const CitationPopover = () => (
  <Popover open modal={false}>
    <PopoverTrigger className="g-underline g-text-sm">How to cite this dataset</PopoverTrigger>
    <PopoverContent className="g-w-96 g-break-words g-text-sm">
      GBIF.org (08 September 2026) GBIF Occurrence Download https://doi.org/10.48580/dgykv
    </PopoverContent>
  </Popover>
);
