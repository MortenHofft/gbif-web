import { FormattedDateRange, Message, Unknown } from 'new-gbif-org-ts';

// `Message` resolves `id` through the real IntlProvider (useIntl), pipes the result through
// HyperText, so a dictionary entry containing markdown renders as sanitised HTML — verified
// against src/config/fallback/messages/en.json.
export const PlainMessage = () => (
  <Message id="dataset.checklistBankDownloadDescription" className="g-max-w-md g-text-sm" />
);

// A dictionary entry with an inline markdown link, so the HyperText pass-through is visible,
// not just plain text. Tailwind's preflight strips default `<a>` styling, so real call sites
// (e.g. src/routes/dataset/key/about.tsx, .../deletionNotice.tsx) style embedded links with
// this exact `[&_a]:...` selector rather than a class on the anchor itself, which HyperText's
// sanitizer would strip anyway.
export const MessageWithLink = () => (
  <Message
    id="downloadKey.aboutDeletionPolicy"
    className="g-max-w-md g-text-sm [&_a]:g-underline [&_a]:g-text-inherit"
  />
);

// `Unknown` — muted placeholder used where a field genuinely has no value.
export const UnknownValue = () => <Unknown />;

// `FormattedDateRange` — occurrence.eventDate is often an ISO interval ("start/end"); a single
// date collapses to just the start.
export const EventDateRange = () => (
  <div className="g-text-sm">
    <div className="g-mb-2">
      <FormattedDateRange date="2024-11-02/2024-11-14" />
    </div>
    <div>
      <FormattedDateRange date="2023-06-17" />
    </div>
  </div>
);
