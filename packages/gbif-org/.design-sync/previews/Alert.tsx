import { Alert, AlertDescription, AlertTitle } from 'new-gbif-org-ts';

export const Default = () => (
  <Alert className="g-max-w-md">
    <AlertTitle>Preparing your download</AlertTitle>
    <AlertDescription>
      We are gathering 307,616,900 occurrence records. This can take a few minutes for large
      requests.
    </AlertDescription>
  </Alert>
);

export const Info = () => (
  <Alert variant="info" className="g-max-w-md">
    <AlertTitle>New GBIF backbone taxonomy</AlertTitle>
    <AlertDescription>
      Name matching now uses the 2026-06 backbone. Some classifications may have shifted slightly.
    </AlertDescription>
  </Alert>
);

export const Warning = () => (
  <Alert variant="warning" className="g-max-w-md">
    <AlertTitle>Coordinates flagged</AlertTitle>
    <AlertDescription>
      12 records in this dataset have coordinates that fall outside the stated country boundary.
    </AlertDescription>
  </Alert>
);

export const Destructive = () => (
  <Alert variant="destructive" className="g-max-w-md">
    <AlertTitle>Download deleted</AlertTitle>
    <AlertDescription>
      This download and its DOI have been removed and will no longer resolve.
    </AlertDescription>
  </Alert>
);

export const ThemeVariant = () => (
  <Alert variant="theme" className="g-max-w-md">
    <AlertTitle>Data quality flags updated</AlertTitle>
    <AlertDescription>
      Naturalis Biodiversity Center republished this dataset with revised coordinate validation.
    </AlertDescription>
  </Alert>
);
