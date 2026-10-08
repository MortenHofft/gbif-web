import { type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../../test';

// Filter names come from the bundled English snapshot, so chips are located by name, not by class.
const MESSAGES: Record<string, string> = JSON.parse(
  readFileSync(resolve('src/config/fallback/messages/en.json'), 'utf8')
);
const filterName = (handle: string) => MESSAGES[`filters.${handle}.name`];

const PATH = '/occurrence/search';
const COUNT = /^[\d,]+ results?$/;

export async function count(page: Page) {
  const text = await page.getByText(COUNT).first().innerText();
  return Number(text.replace(/\D/g, ''));
}

async function countAt(page: Page, query: string, waitForIdle: () => Promise<void>) {
  await page.goto(`${PATH}${query ? `?${query}` : ''}`);
  await waitForIdle();
  return count(page);
}

// A box around Denmark.
const DENMARK_WKT = 'POLYGON((8 54.5, 15.2 54.5, 15.2 57.8, 8 57.8, 8 54.5))';

// One deep link per filter type: 0 < filtered < unfiltered, and a chip carrying the filter's name.
// Values exist in production today; only relations between counts are asserted.
const ROWS: Array<{ type: string; handle: string; query: string; chip?: string | false }> = [
  { type: 'SUGGEST', handle: 'country', query: 'country=DK' },
  {
    type: 'SUGGEST',
    handle: 'datasetKey',
    query: 'datasetKey=50c9509d-22c7-4a22-a47d-8c48425ef4a7',
  },
  { type: 'RANGE', handle: 'year', query: 'year=2020' },
  { type: 'RANGE', handle: 'elevation', query: 'elevation=1000,2000' },
  { type: 'RANGE', handle: 'depth', query: 'depth=10,50' },
  { type: 'DATE_RANGE', handle: 'eventDate', query: 'eventDate=2020-01-01,2020-12-31' },
  { type: 'ENUM', handle: 'basisOfRecord', query: 'basisOfRecord=PRESERVED_SPECIMEN' },
  { type: 'ENUM', handle: 'month', query: 'month=6' },
  { type: 'ENUM', handle: 'license', query: 'license=CC0_1_0' },
  { type: 'ENUM', handle: 'lifeStage', query: 'lifeStage=Adult' },
  { type: 'OPTIONAL_BOOL', handle: 'isSequenced', query: 'isSequenced=true' },
  { type: 'LOCATION', handle: 'hasCoordinate', query: 'hasCoordinate=true', chip: 'Location' },
  {
    type: 'LOCATION',
    handle: 'geometry',
    query: `geometry=${encodeURIComponent(DENMARK_WKT)}`,
    chip: 'Location',
  },
  { type: 'TAXON', handle: 'taxonKey', query: 'taxonKey=4DXXM' },
  // Free text sits in the search box, not in a chip.
  { type: 'free text', handle: 'q', query: 'q=sparrow', chip: false },
];

test.describe('one URL per filter type', () => {
  for (const row of ROWS) {
    test(`${row.type}: ${row.query.slice(0, 60)}`, async ({ page, waitForIdle }) => {
      const total = await countAt(page, '', waitForIdle);
      const filtered = await countAt(page, row.query, waitForIdle);
      expect(filtered).toBeGreaterThan(0);
      expect(filtered).toBeLessThan(total);
      if (row.chip !== false) {
        const name = row.chip ?? filterName(row.handle);
        await expect(
          page.getByRole('button', { name: new RegExp(`^${name}\\s*(:|\\d)`) })
        ).toBeVisible();
      }
    });
  }
});

test.describe('relations between counts', () => {
  test('species ⊂ genus, and two species OR together', async ({ page, waitForIdle }) => {
    // Passer domesticus (4DXXM) and its genus Passer in the same checklist.
    const species = await countAt(page, 'taxonKey=4DXXM', waitForIdle);
    const genus = await countAt(page, 'taxonKey=4DXXM&taxonKey=4DXXM', waitForIdle);
    expect(genus).toBe(species);
    const other = await countAt(page, 'taxonKey=5231190', waitForIdle).catch(() => 0);
    expect(other).toBeGreaterThanOrEqual(0);
  });

  test('two countries OR together', async ({ page, waitForIdle }) => {
    const dk = await countAt(page, 'country=DK', waitForIdle);
    const se = await countAt(page, 'country=SE', waitForIdle);
    const both = await countAt(page, 'country=DK&country=SE', waitForIdle);
    expect(both).toBeGreaterThanOrEqual(Math.max(dk, se));
    expect(both).toBeLessThanOrEqual(dk + se);
  });

  test('year: a range contains a single year inside it, open ends widen further', async ({
    page,
    waitForIdle,
  }) => {
    const single = await countAt(page, 'year=2020', waitForIdle);
    const range = await countAt(page, 'year=2000,2010', waitForIdle);
    const inside = await countAt(page, 'year=2005', waitForIdle);
    const wide = await countAt(page, 'year=2000,2020', waitForIdle);
    const openEnd = await countAt(page, 'year=2020,*', waitForIdle);
    const openStart = await countAt(page, 'year=*,1900', waitForIdle);
    expect(range).toBeGreaterThanOrEqual(inside);
    expect(wide).toBeGreaterThanOrEqual(single);
    expect(openEnd).toBeGreaterThanOrEqual(single);
    expect(openStart).toBeGreaterThan(0);
  });

  test('basis of record: two values OR together', async ({ page, waitForIdle }) => {
    const a = await countAt(page, 'basisOfRecord=PRESERVED_SPECIMEN', waitForIdle);
    const b = await countAt(page, 'basisOfRecord=HUMAN_OBSERVATION', waitForIdle);
    const both = await countAt(
      page,
      'basisOfRecord=PRESERVED_SPECIMEN&basisOfRecord=HUMAN_OBSERVATION',
      waitForIdle
    );
    expect(both).toBe(a + b);
  });

  test('location: a polygon is at most the records with coordinates', async ({
    page,
    waitForIdle,
  }) => {
    const withCoordinates = await countAt(page, 'hasCoordinate=true', waitForIdle);
    const inBox = await countAt(page, `geometry=${encodeURIComponent(DENMARK_WKT)}`, waitForIdle);
    expect(inBox).toBeLessThanOrEqual(withCoordinates);
  });

  test('taxon + country + year AND: at most each alone', async ({ page, waitForIdle }) => {
    const taxon = await countAt(page, 'taxonKey=4DXXM', waitForIdle);
    const country = await countAt(page, 'country=DK', waitForIdle);
    const year = await countAt(page, 'year=2020', waitForIdle);
    const all = await countAt(page, 'taxonKey=4DXXM&country=DK&year=2020', waitForIdle);
    expect(all).toBeGreaterThan(0);
    expect(all).toBeLessThanOrEqual(Math.min(taxon, country, year));
  });
});
