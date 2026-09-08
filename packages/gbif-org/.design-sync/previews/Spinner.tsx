import { Button, Spinner } from 'new-gbif-org-ts';

// Spinner defaults to g-h-3 g-w-3 — deliberately tiny, since it is mostly used
// inline next to text. At that size a lone spinner is nearly invisible on a
// card, so each cell shows it at a real usage size or in a real context.

export const Sizes = () => (
  <div className="g-flex g-items-center g-gap-6">
    <Spinner />
    <Spinner className="g-h-5 g-w-5" />
    <Spinner className="g-h-8 g-w-8" />
    <Spinner className="g-h-12 g-w-12" />
  </div>
);

export const InlineWithText = () => (
  <div className="g-flex g-items-center g-gap-2 g-text-sm">
    <Spinner className="g-h-4 g-w-4" />
    Loading 307,616,900 occurrence records…
  </div>
);

// The default fill is slate; the spinner inherits colour, so it can be tinted
// to the brand green for primary surfaces.
export const Tinted = () => (
  <div className="g-flex g-items-center g-gap-6">
    <Spinner className="g-h-8 g-w-8 g-fill-primary-500" />
    <Spinner className="g-h-8 g-w-8 g-fill-destructive" />
  </div>
);

export const InContext = () => (
  <div className="g-flex g-items-center g-gap-4">
    <Button isLoading>Preparing download</Button>
    <div className="g-flex g-items-center g-gap-2 g-text-sm g-text-muted-foreground">
      <Spinner className="g-h-4 g-w-4" />
      Fetching dataset metrics
    </div>
  </div>
);
