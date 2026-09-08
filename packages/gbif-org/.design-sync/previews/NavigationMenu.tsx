import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from 'new-gbif-org-ts';

// The site header keeps a menu open via a controlled `value`/`defaultValue` on the Root —
// hover-driven open state has nothing to show in a static capture. `defaultValue` opens
// "Get data" without needing local state.
export const GetDataMenu = () => (
  <NavigationMenu defaultValue="get-data" className="g-z-30">
    <NavigationMenuList>
      <NavigationMenuItem value="get-data">
        <NavigationMenuTrigger>Get data</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="g-grid g-gap-1 g-p-4 g-w-72">
            <li>
              <NavigationMenuLink
                href="/occurrence/search"
                className="g-block g-select-none g-space-y-1 g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
              >
                <div className="g-text-sm g-font-medium">Occurrences</div>
                <p className="g-line-clamp-2 g-text-sm g-text-muted-foreground g-m-0">
                  Observations, specimens and other evidence of species occurrences.
                </p>
              </NavigationMenuLink>
            </li>
            <li>
              <NavigationMenuLink
                href="/dataset/search"
                className="g-block g-select-none g-space-y-1 g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
              >
                <div className="g-text-sm g-font-medium">Datasets</div>
                <p className="g-line-clamp-2 g-text-sm g-text-muted-foreground g-m-0">
                  Explore the datasets published by the GBIF network.
                </p>
              </NavigationMenuLink>
            </li>
            <li>
              <NavigationMenuLink
                href="/species/search"
                className="g-block g-select-none g-space-y-1 g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
              >
                <div className="g-text-sm g-font-medium">Species</div>
                <p className="g-line-clamp-2 g-text-sm g-text-muted-foreground g-m-0">
                  Browse the GBIF backbone taxonomy.
                </p>
              </NavigationMenuLink>
            </li>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem value="how-to">
        <NavigationMenuTrigger>How to</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="g-grid g-gap-1 g-p-4 g-w-60">
            <li>
              <NavigationMenuLink
                href="/citation-guidelines"
                className="g-block g-select-none g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
              >
                <div className="g-text-sm g-font-medium">Cite data</div>
              </NavigationMenuLink>
            </li>
            <li>
              <NavigationMenuLink
                href="/publishing-data"
                className="g-block g-select-none g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
              >
                <div className="g-text-sm g-font-medium">Publish data</div>
              </NavigationMenuLink>
            </li>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
);

// Second cell keeps "Community" open instead, so both the row of triggers and a different
// panel width/shape are visible across the two cells.
export const CommunityMenu = () => (
  <NavigationMenu defaultValue="community" className="g-z-30">
    <NavigationMenuList>
      <NavigationMenuItem value="get-data">
        <NavigationMenuTrigger>Get data</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="g-grid g-gap-1 g-p-4 g-w-60">
            <li>
              <NavigationMenuLink
                href="/occurrence/search"
                className="g-block g-select-none g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
              >
                <div className="g-text-sm g-font-medium">Occurrences</div>
              </NavigationMenuLink>
            </li>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem value="community">
        <NavigationMenuTrigger>Community</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="g-grid g-gap-1 g-p-4 g-w-96 g-grid-cols-2">
            <li>
              <h4 className="g-mt-2 g-ps-2 g-text-slate-500">Network</h4>
              <ul className="g-py-2">
                <li>
                  <NavigationMenuLink
                    href="/the-gbif-network"
                    className="g-block g-select-none g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
                  >
                    <div className="g-text-sm g-font-medium">Participant nodes</div>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink
                    href="/publisher/search"
                    className="g-block g-select-none g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
                  >
                    <div className="g-text-sm g-font-medium">Publishers</div>
                  </NavigationMenuLink>
                </li>
              </ul>
            </li>
            <li>
              <h4 className="g-mt-2 g-ps-2 g-text-slate-500">Get involved</h4>
              <ul className="g-py-2">
                <li>
                  <NavigationMenuLink
                    href="/programme/bid"
                    className="g-block g-select-none g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
                  >
                    <div className="g-text-sm g-font-medium">Biodiversity Information Fund</div>
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink
                    href="/event/search"
                    className="g-block g-select-none g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
                  >
                    <div className="g-text-sm g-font-medium">Events</div>
                  </NavigationMenuLink>
                </li>
              </ul>
            </li>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
      <NavigationMenuItem value="about">
        <NavigationMenuTrigger>About</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="g-grid g-gap-1 g-p-4 g-w-48">
            <li>
              <NavigationMenuLink
                href="/governance"
                className="g-block g-select-none g-rounded-md g-p-2 g-leading-none g-no-underline hover:g-bg-accent hover:g-text-accent-foreground"
              >
                <div className="g-text-sm g-font-medium">Governance</div>
              </NavigationMenuLink>
            </li>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
);
