import { HyperText } from 'new-gbif-org-ts';

// `text` is markdown-ish, parsed with `marked` then sanitised down to
// DEFAULT_SANITIZE_OPTIONS (a, strong, em, p, br, code, pre) — real dataset abstract text,
// with a link and emphasis, so both survive sanitisation.
export const DatasetDescription = () => (
  <HyperText
    className="g-prose g-max-w-md g-text-sm"
    text={
      "This dataset is a snapshot of *iNaturalist* research-grade observations shared through the " +
      'GBIF network. Records are contributed by citizen scientists and reviewed by the community ' +
      'before being marked research-grade. See the [iNaturalist data quality assessment]' +
      '(https://www.inaturalist.org/pages/help#quality) for how that status is determined.'
    }
  />
);

// A shorter field-level description, the more common call site (occurrenceFieldNames /
// definitions text rendered per-property), including an inline `code` span.
export const FieldDefinition = () => (
  <HyperText
    className="g-max-w-md g-text-sm"
    text="The **basisOfRecord** term records the specific nature of the data record — for example `PRESERVED_SPECIMEN`, `HUMAN_OBSERVATION` or `MATERIAL_SAMPLE`."
  />
);
