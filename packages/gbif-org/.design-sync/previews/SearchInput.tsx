import { SearchInput } from 'new-gbif-org-ts';

// A compact search box used inline in filter popovers and toolbars
// (see src/components/filters/QFilter.tsx, src/routes/omniSearch/search.tsx).
export const Empty = () => (
  <SearchInput
    placeholder="Search occurrences"
    className="g-w-64 g-border g-border-slate-300 g-rounded-md g-bg-white"
  />
);

export const WithValue = () => (
  <SearchInput
    defaultValue="Ctenophorus decresii"
    placeholder="Search occurrences"
    className="g-w-64 g-border g-border-slate-300 g-rounded-md g-bg-white"
  />
);

export const FindAField = () => (
  <SearchInput
    placeholder="Find a field"
    className="g-w-full g-max-w-[240px] g-border g-border-slate-300 g-rounded-md g-bg-white g-px-3"
    inputClassName="g-w-full"
  />
);
