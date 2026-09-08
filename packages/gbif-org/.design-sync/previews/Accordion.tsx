import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from 'new-gbif-org-ts';

// defaultValue keeps the first item open so the card shows real content, not just three
// collapsed triggers — the same pattern GBIF's search help panels use.
export const HelpQuestions = () => (
  <Accordion type="single" collapsible defaultValue="scientific-name" className="g-w-full g-max-w-lg">
    <AccordionItem value="scientific-name">
      <AccordionTrigger>What is a scientific name match?</AccordionTrigger>
      <AccordionContent className="g-prose g-text-sm">
        GBIF matches the scientific name on each record against the GBIF Backbone Taxonomy so
        that occurrences of, for example, <em>Ctenophorus decresii</em> can be found regardless of
        which name the data publisher originally used.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="basis-of-record">
      <AccordionTrigger>What does basis of record mean?</AccordionTrigger>
      <AccordionContent className="g-prose g-text-sm">
        Basis of record describes how the occurrence was recorded — for example a preserved
        specimen, a human observation, or a machine observation from a sensor.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="coordinate-uncertainty">
      <AccordionTrigger>What is coordinate uncertainty?</AccordionTrigger>
      <AccordionContent className="g-prose g-text-sm">
        The horizontal distance, in metres, from the given coordinates describing the smallest
        circle wholly containing the location of the occurrence.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

// Multiple items open at once, styled like the validation-report groupings that show every
// dataset table with its own issue list.
export const MultipleOpen = () => (
  <Accordion
    type="multiple"
    defaultValue={['occurrence', 'multimedia']}
    className="g-w-full g-max-w-lg g-flex g-flex-col g-gap-2"
  >
    <AccordionItem value="occurrence">
      <AccordionTrigger>Occurrence · 14 issues</AccordionTrigger>
      <AccordionContent className="g-text-sm g-text-muted-foreground">
        3,820,133,099 records checked. Coordinate rounded and country coordinate mismatch are the
        most common issues.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="multimedia">
      <AccordionTrigger>Multimedia · 2 issues</AccordionTrigger>
      <AccordionContent className="g-text-sm g-text-muted-foreground">
        A small number of media records are missing a licence, so they cannot be displayed on
        GBIF.org.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="identification">
      <AccordionTrigger>Identification · 0 issues</AccordionTrigger>
      <AccordionContent className="g-text-sm g-text-muted-foreground">
        No issues found in this extension.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);
