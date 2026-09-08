import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DiscreteCardTitle,
} from 'new-gbif-org-ts';

export const DatasetSummary = () => (
  <Card className="g-max-w-md">
    <CardHeader>
      <CardTitle>Catalogue of Life</CardTitle>
      <CardDescription>Published by Species 2000 & ITIS Catalogue of Life</CardDescription>
    </CardHeader>
    <CardContent>
      A checklist dataset covering 2,297,674 species, used across GBIF as the taxonomic backbone
      for name matching and classification.
    </CardContent>
  </Card>
);

export const WithFooterActions = () => (
  <Card className="g-max-w-md">
    <CardHeader>
      <CardTitle>Darwin Core Archive</CardTitle>
      <CardDescription>307,616,900 occurrence records · CC BY 4.0</CardDescription>
    </CardHeader>
    <CardContent>
      Your download is ready. The archive will remain available for download for 6 weeks.
    </CardContent>
    <CardFooter className="g-gap-2">
      <Button variant="outline">Copy citation</Button>
      <Button>Download</Button>
    </CardFooter>
  </Card>
);

// DiscreteCardTitle is the smaller, muted heading used for secondary sections inside a page,
// as opposed to CardTitle which reads as the page's primary heading.
export const DiscreteSection = () => (
  <Card className="g-max-w-md">
    <CardHeader>
      <DiscreteCardTitle>Citation</DiscreteCardTitle>
    </CardHeader>
    <CardContent className="g-text-sm g-text-muted-foreground">
      GBIF.org (08 September 2026) GBIF Occurrence Download https://doi.org/10.15468/dl.dgykv
    </CardContent>
  </Card>
);

// A whole card used as one clickable surface, as related-dataset links are on the
// dataset page. The anchor is nested inside the Card and stretched to fill it.
// (A branch in flight adds an `asChild` prop that merges the styling onto the
// anchor directly; when that lands on main, a re-sync can simplify this.)
export const ClickableLinkCard = () => (
  <Card className="g-max-w-md hover:g-shadow-lg">
    <a href="#" className="g-block g-no-underline g-text-inherit">
      <CardHeader>
        <CardTitle>iNaturalist Research-grade Observations</CardTitle>
        <CardDescription>National Biodiversity Data Centre</CardDescription>
      </CardHeader>
      <CardContent>3,820,133,099 occurrences · Updated daily</CardContent>
    </a>
  </Card>
);
