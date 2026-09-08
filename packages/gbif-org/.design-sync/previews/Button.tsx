import { Button } from 'new-gbif-org-ts';

export const Variants = () => (
  <div className="g-flex g-flex-wrap g-items-center g-gap-3">
    <Button variant="default">Download</Button>
    <Button variant="primaryOutline">Add to list</Button>
    <Button variant="outline">Cancel</Button>
    <Button variant="secondary">Filters</Button>
    <Button variant="ghost">Clear</Button>
    <Button variant="subtle">More filters</Button>
    <Button variant="link">View dataset</Button>
  </div>
);

export const Destructive = () => (
  <div className="g-flex g-flex-wrap g-items-center g-gap-3">
    <Button variant="destructive">Delete download</Button>
    <Button variant="destructiveSecondary">Remove</Button>
    <Button variant="linkDestructive">Revoke access</Button>
  </div>
);

export const Sizes = () => (
  <div className="g-flex g-flex-wrap g-items-center g-gap-3">
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const States = () => (
  <div className="g-flex g-flex-wrap g-items-center g-gap-3">
    <Button>Enabled</Button>
    <Button disabled>Disabled</Button>
    <Button isLoading>Downloading</Button>
    <Button variant="outline" disabled>
      Disabled outline
    </Button>
  </div>
);
