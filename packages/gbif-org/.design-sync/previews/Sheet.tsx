import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from 'new-gbif-org-ts';

// Rendered `open` so the card shows the panel itself rather than a closed trigger.
// `modal={false}` keeps the card from scroll-locking the surrounding page, same as the
// Dialog/Popover previews. Modeled on the mobile filter drawer, which opens a right-side sheet
// (src/gbif/header/languageSelector.tsx / mobileMenu.tsx use the same `side` pattern).
export const MobileFilterDrawer = () => (
  <Sheet open modal={false}>
    <SheetContent side="right" className="g-w-4/5 sm:g-max-w-sm">
      <SheetHeader>
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>3,820,133,099 occurrence records match the current search.</SheetDescription>
      </SheetHeader>
      <ul className="g-mt-4 g-flex g-flex-col g-gap-1 g-text-sm">
        <li className="g-flex g-items-center g-justify-between g-py-2 g-border-b">
          <span>Country or area</span>
          <span className="g-text-muted-foreground">Colombia</span>
        </li>
        <li className="g-flex g-items-center g-justify-between g-py-2 g-border-b">
          <span>Basis of record</span>
          <span className="g-text-muted-foreground">2 selected</span>
        </li>
        <li className="g-flex g-items-center g-justify-between g-py-2 g-border-b">
          <span>Taxonomic status</span>
          <span className="g-text-muted-foreground">Any</span>
        </li>
      </ul>
      <SheetFooter className="g-mt-6">
        <button className="g-text-sm g-underline">Clear all</button>
        <button className="g-rounded-md g-bg-primary g-px-4 g-py-2 g-text-sm g-text-primary-foreground">
          Apply
        </button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

// Bottom-sheet variant, used on narrow viewports for the language selector
// (src/gbif/header/languageSelector.tsx).
export const LanguagePicker = () => (
  <Sheet open modal={false}>
    <SheetContent side="bottom" className="g-max-h-80">
      <SheetHeader>
        <SheetTitle>Choose a language</SheetTitle>
      </SheetHeader>
      <ul className="g-mt-4 g-flex g-flex-col">
        <li className="g-py-3 g-border-b g-flex g-items-center g-gap-3">
          <span className="g-w-6" />
          <span>Español</span>
        </li>
        <li className="g-py-3 g-border-b g-flex g-items-center g-gap-3">
          <span className="g-w-6 g-font-bold">✓</span>
          <span>English</span>
        </li>
        <li className="g-py-3 g-border-b g-flex g-items-center g-gap-3">
          <span className="g-w-6" />
          <span>Français</span>
        </li>
      </ul>
    </SheetContent>
  </Sheet>
);
