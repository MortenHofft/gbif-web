import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from 'new-gbif-org-ts';

// Toast throws outside ToastProvider, so every cell composes the same stack the
// app's Toaster uses (src/components/ui/toaster.tsx): provider → toast → viewport.
// Rendered `open` so the card shows the toast rather than an empty viewport.
//
// The viewport is where Radix actually renders the toast, so it must stay
// visible. Its default classes pin it `g-fixed` to the corner of the screen,
// which escapes the preview card entirely — `g-static` with the sizing reset
// brings it back inline. That is presentation-only; the toast itself is
// untouched.
const VIEWPORT = 'g-static g-p-0 g-max-w-none md:g-max-w-none g-w-full';

export const DownloadReady = () => (
  <ToastProvider swipeDirection="right">
    <Toast open className="g-relative g-w-full">
      <div className="g-grid g-gap-1">
        <ToastTitle>Download ready</ToastTitle>
        <ToastDescription>
          Your Darwin Core Archive of 1,284,663 records is ready to download.
        </ToastDescription>
      </div>
      <ToastClose />
    </Toast>
    <ToastViewport className={VIEWPORT} />
  </ToastProvider>
);

export const CitationCopied = () => (
  <ToastProvider swipeDirection="right">
    <Toast open className="g-relative g-w-full">
      <div className="g-grid g-gap-1">
        <ToastTitle>Citation copied</ToastTitle>
        <ToastDescription>GBIF.org (2026), GBIF Occurrence Download</ToastDescription>
      </div>
      <ToastClose />
    </Toast>
    <ToastViewport className={VIEWPORT} />
  </ToastProvider>
);

export const Destructive = () => (
  <ToastProvider swipeDirection="right">
    <Toast open variant="destructive" className="g-relative g-w-full">
      <div className="g-grid g-gap-1">
        <ToastTitle>Download failed</ToastTitle>
        <ToastDescription>
          The occurrence download could not be prepared. Please try again.
        </ToastDescription>
      </div>
      <ToastClose />
    </Toast>
    <ToastViewport className={VIEWPORT} />
  </ToastProvider>
);
