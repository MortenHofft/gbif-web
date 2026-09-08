import {
  DeletedMessage,
  HeaderInfo,
  HeaderInfoEdit,
  HeaderInfoMain,
  Hostname,
} from 'new-gbif-org-ts';
import { MdLink, MdPeople as PeopleIcon } from 'react-icons/md';

// Modeled on src/routes/dataset/key/datasetKey.tsx: HeaderInfoMain carries the feature-list
// metadata row (contacts, homepage), HeaderInfoEdit carries the right-aligned action buttons —
// the two halves stack on mobile and sit side by side from `md:` up.
export const DatasetHeaderInfo = () => (
  <HeaderInfo className="g-max-w-2xl">
    <HeaderInfoMain>
      <div className="g-flex g-flex-wrap g-items-center -g-my-1 g-mt-3 g-gap-x-6 g-text-sm">
        <div className="g-inline-flex g-items-center g-gap-2">
          <PeopleIcon className="g-h-5 g-w-5" />
          <span>Andrew Bentley • 3 more contacts</span>
        </div>
        <div className="g-inline-flex g-items-center g-gap-2">
          <MdLink className="g-h-5 g-w-5" />
          <Hostname href="https://www.inaturalist.org" />
        </div>
      </div>
    </HeaderInfoMain>
    <HeaderInfoEdit className="g-flex g-mt-4 g-gap-2">
      <a
        href="#"
        className="g-inline-flex g-h-8 g-items-center g-rounded-md g-border g-border-solid g-px-3 g-text-sm g-no-underline hover:g-bg-accent"
      >
        18,204 citations
      </a>
      <a
        href="#"
        className="g-inline-flex g-h-8 g-items-center g-rounded-md g-bg-primary g-px-3 g-text-sm g-text-primary-foreground g-no-underline"
      >
        Download
      </a>
    </HeaderInfoEdit>
  </HeaderInfo>
);

// A deleted dataset: `DeletedMessage` renders nothing without a date, so this composes the
// same header shape with the error banner that appears above it on real dataset pages.
export const DeletedDatasetHeaderInfo = () => (
  <div className="g-max-w-2xl">
    <DeletedMessage date="2024-03-11T09:00:00.000+0000" />
    <HeaderInfo>
      <HeaderInfoMain>
        <div className="g-flex g-flex-wrap g-items-center -g-my-1 g-mt-3 g-gap-x-6 g-text-sm">
          <div className="g-inline-flex g-items-center g-gap-2">
            <MdLink className="g-h-5 g-w-5" />
            <Hostname href="naturalis.nl/en/collectie" />
          </div>
        </div>
      </HeaderInfoMain>
    </HeaderInfo>
  </div>
);
