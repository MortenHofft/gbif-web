import { Callout } from 'new-gbif-org-ts';

// Ported from src/routes/country/key/components/trends.tsx — a definition
// callout sitting above a chart, explaining a metric before the reader sees
// the numbers.
export const DefinitionCallout = () => (
  <Callout className="g-max-w-2xl">
    <Callout.Title>Definition</Callout.Title>
    <Callout.Description>
      <p>
        Species counts are based on the number of binomial scientific names for which GBIF has
        received data records, organized as far as possible using synonyms recorded in key
        databases such as the Catalogue of Life. Since many names are not yet included in these
        databases, some proportion of these names will be unrecognized synonyms and do not
        represent valid species.
      </p>
    </Callout.Description>
  </Callout>
);

// Ported from the same file's caveat callout below the daily-pattern charts —
// shows the component with a shorter title and a tighter description.
export const NoteCallout = () => (
  <Callout className="g-max-w-2xl">
    <Callout.Title>Note</Callout.Title>
    <Callout.Description>
      <p>
        These charts may reveal patterns that represent biases in data collection (seasonality,
        public holidays) or potential issues in data management. Such issues may arise at various
        stages in data processing and require further investigation.
      </p>
    </Callout.Description>
  </Callout>
);
