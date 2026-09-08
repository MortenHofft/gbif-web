import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'new-gbif-org-ts';

const records = [
  {
    name: 'Ctenophorus decresii',
    coords: '-34.7, 138.6',
    year: 2024,
    dataset: 'iNaturalist Research-grade Observations',
    publisher: 'National Biodiversity Data Centre',
  },
  {
    name: 'Pica pica',
    coords: '55.7, 12.5',
    year: 2023,
    dataset: 'Naturalis Biodiversity Center (multiple)',
    publisher: 'Naturalis Biodiversity Center',
  },
  {
    name: 'Turdus iliacus',
    coords: '60.4, 5.3',
    year: 2022,
    dataset: 'Norwegian Species Observation Service',
    publisher: 'Norwegian Biodiversity Information Centre',
  },
  {
    name: 'Vulpes vulpes',
    coords: '52.5, 13.4',
    year: 2021,
    dataset: 'Observation.org, Nature data from around the World',
    publisher: 'Observation International',
  },
  {
    name: 'Zea mays',
    coords: '19.4, -99.1',
    year: 2020,
    dataset: 'GBIF Backbone Taxonomy',
    publisher: 'GBIF',
  },
];

export const OccurrenceRecords = () => (
  <Table>
    <TableCaption>3,820,133,099 occurrence records match your current filters.</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Scientific name</TableHead>
        <TableHead>Coordinates</TableHead>
        <TableHead>Year</TableHead>
        <TableHead>Dataset</TableHead>
        <TableHead>Publisher</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {records.map((r) => (
        <TableRow key={r.name}>
          <TableCell className="g-italic">{r.name}</TableCell>
          <TableCell className="g-text-xs g-whitespace-nowrap g-tabular-nums">{r.coords}</TableCell>
          <TableCell>{r.year}</TableCell>
          <TableCell>{r.dataset}</TableCell>
          <TableCell>{r.publisher}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export const CompactMetrics = () => (
  <Table className="g-max-w-sm">
    <TableHeader>
      <TableRow>
        <TableHead>Basis of record</TableHead>
        <TableHead>Records</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>Human observation</TableCell>
        <TableCell>2,368,482,521</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Preserved specimen</TableCell>
        <TableCell>1,184,241,260</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Material sample</TableCell>
        <TableCell>267,409,318</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Machine observation</TableCell>
        <TableCell>0</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
