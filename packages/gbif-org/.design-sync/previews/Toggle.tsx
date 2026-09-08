import { Toggle } from 'new-gbif-org-ts';

export const Default = () => (
  <div className="g-flex g-items-center g-gap-3">
    <Toggle aria-label="Toggle map view">Map</Toggle>
    <Toggle aria-label="Toggle table view" defaultPressed>
      Table
    </Toggle>
    <Toggle aria-label="Toggle gallery view" disabled>
      Gallery
    </Toggle>
  </div>
);

export const Primary = () => (
  <div className="g-flex g-items-center g-gap-3">
    <Toggle variant="primary" aria-label="Include absent taxa">
      Include absent
    </Toggle>
    <Toggle variant="primary" aria-label="Only with images" defaultPressed>
      Only with images
    </Toggle>
  </div>
);

export const Sizes = () => (
  <div className="g-flex g-items-center g-gap-3">
    <Toggle size="sm" defaultPressed aria-label="Small">
      Sm
    </Toggle>
    <Toggle size="default" defaultPressed aria-label="Default">
      Md
    </Toggle>
    <Toggle size="lg" defaultPressed aria-label="Large">
      Lg
    </Toggle>
  </div>
);
