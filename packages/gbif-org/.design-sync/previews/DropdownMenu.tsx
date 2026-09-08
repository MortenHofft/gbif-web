import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'new-gbif-org-ts';

// Rendered `open` so the card shows the menu surface — a closed menu has nothing to look at.
// modal={false} keeps the card from scroll-locking.
export const SortByMenu = () => (
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger className="g-text-sm g-underline">Sort by</DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value="createdAt_desc">
        <DropdownMenuRadioItem value="relevance">Relevance</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="createdAt_desc">Newest first</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="createdAt_asc">Oldest first</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const BasisOfRecordFilter = () => (
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger className="g-text-sm g-underline">Basis of record</DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuLabel>Filter by basis of record</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem checked>Human observation</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked>Preserved specimen</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem>Material sample</DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem>Machine observation</DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
