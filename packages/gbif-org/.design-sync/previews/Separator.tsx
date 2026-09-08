import { Separator } from 'new-gbif-org-ts';

// The `Separator` synced here is the Radix-based ui/separator.tsx (it wins
// over dataHeader's own div-based one — see NOTES.md). Its one real call
// site is src/routes/resource/key/components/documents.tsx, a vertical rule
// between a file size and its extension. The horizontal case has no single
// call site (most horizontal rules in the app are plain divs), so this cell
// shows it doing the same job in a card: separating two stacked content
// blocks, which is the component's documented default orientation.

export const HorizontalBetweenSections = () => (
  <div className="g-w-80">
    <div>
      <div className="g-font-medium g-text-slate-800">Description</div>
      <p className="g-text-sm g-text-slate-500 g-mt-1">
        Occurrence records mobilised by the Atlas of Living Australia, covering vertebrate and
        invertebrate specimens held in Australian natural history collections.
      </p>
    </div>
    <Separator className="g-my-4" />
    <div>
      <div className="g-font-medium g-text-slate-800">Citation</div>
      <p className="g-text-sm g-text-slate-500 g-mt-1">
        Atlas of Living Australia occurrence download https://doi.org/10.15468/dl.k3v9pj
      </p>
    </div>
  </div>
);

// Ported verbatim from documents.tsx: a vertical rule between a document's
// file size and its extension, inline in a metadata row.
export const VerticalBetweenMetadata = () => (
  <div className="g-text-sm g-text-slate-500 g-flex g-gap-2 g-items-center">
    <span>2.4 MB</span>
    <Separator orientation="vertical" className="g-h-4 g-w-[2px] g-bg-slate-200" />
    <span>.pdf</span>
  </div>
);

// A second vertical case at default (untinted) styling, separating two
// inline record counts the way a search results summary line does.
export const VerticalDefaultStyling = () => (
  <div className="g-text-sm g-text-slate-700 g-flex g-gap-3 g-items-center">
    <span>1,284,663 occurrences</span>
    <Separator orientation="vertical" className="g-h-4" />
    <span>2,104 datasets</span>
    <Separator orientation="vertical" className="g-h-4" />
    <span>412 publishers</span>
  </div>
);
