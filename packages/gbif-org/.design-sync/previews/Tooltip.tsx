import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'new-gbif-org-ts';

// Tooltip needs a TooltipProvider ancestor, and open renders the content statically since a
// closed tooltip shows nothing.
export const CoordinateUncertainty = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger className="g-underline g-decoration-dotted g-text-sm">
        Coordinate uncertainty: 28,762 m
      </TooltipTrigger>
      <TooltipContent>
        The radius, in metres, of the smallest circle wholly containing the occurrence location.
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const DataQualityFlag = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger className="g-underline g-decoration-dotted g-text-sm">
        Country coordinate mismatch
      </TooltipTrigger>
      <TooltipContent side="bottom">
        The supplied coordinates fall outside the stated country's boundaries.
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
