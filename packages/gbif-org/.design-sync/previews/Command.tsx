import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from 'new-gbif-org-ts';
import { useState } from 'react';
import { IoMdCheckmark as Checkmark } from 'react-icons/io';

// Modeled on the site's field/filter search (src/components/filters/SearchCommand.tsx),
// which renders `Command` un-dialoged inside a popover. `shouldFilter={false}` — like that
// component — means the item list always renders regardless of the search text, so the card
// shows real "search results" rather than depending on interaction. `CommandInput` is fully
// controlled by cmdk internally (it ignores plain `defaultValue`, spreading it onto the native
// input alongside its own `value`), so a real typed-looking value needs local state.
export const FilterFieldSearch = () => {
  const [search, setSearch] = useState('taxon');
  return (
    <Command
      shouldFilter={false}
      className="g-max-w-sm g-rounded-lg g-border g-border-solid g-shadow-md"
    >
      <CommandInput placeholder="Search fields…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandGroup heading="Taxonomy filters">
          <CommandItem>Scientific name</CommandItem>
          <CommandItem>Taxon key</CommandItem>
          <CommandItem>Taxonomic status</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Record filters">
          <CommandItem>
            Basis of record
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem>Occurrence status</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
};

// Second cell models a species picker with a current selection (src/components/filters/
// SearchCommand.tsx renders a checkmark next to the selected item) — shows the item styling
// and the icon-based selected state rather than only plain rows.
export const SpeciesPicker = () => {
  const [search, setSearch] = useState('Ctenophorus');
  return (
    <Command
      shouldFilter={false}
      className="g-max-w-sm g-rounded-lg g-border g-border-solid g-shadow-md"
    >
      <CommandInput placeholder="Search species…" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandGroup heading="Species">
          <CommandItem className="g-flex g-items-center g-justify-between">
            Ctenophorus decresii (Duméril &amp; Bibron, 1837)
            <Checkmark className="g-me-2 g-h-4 g-w-4 g-opacity-100" />
          </CommandItem>
          <CommandItem className="g-flex g-items-center g-justify-between">
            Ctenophorus cristatus (Gray, 1841)
            <Checkmark className="g-me-2 g-h-4 g-w-4 g-opacity-0" />
          </CommandItem>
          <CommandItem className="g-flex g-items-center g-justify-between">
            Ctenophorus pictus (Peters, 1866)
            <Checkmark className="g-me-2 g-h-4 g-w-4 g-opacity-0" />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
};
