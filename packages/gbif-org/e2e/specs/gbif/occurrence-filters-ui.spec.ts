import { type Page } from '@playwright/test';
import { expect, test } from '../../test';

const PATH = '/occurrence/search';
const COUNT = /^[\d,]+ results?$/;

async function count(page: Page) {
  const text = await page.getByText(COUNT).first().innerText();
  return Number(text.replace(/\D/g, ''));
}

// Highlighted filters sit in the bar as comboboxes; everything else is under "more". Controls have
// no accessible names yet (#35), so they are located by text.
async function openFilter(page: Page, name: string) {
  const applied = page.getByRole('button', { name: new RegExp(`^${name}\\s*(:|\\d)`) });
  const inBar = page.getByRole('combobox').filter({ hasText: new RegExp(`^${name}$`) });
  if (await applied.count()) {
    await applied.first().click();
  } else if (await inBar.count()) {
    await inBar.first().click();
  } else {
    await page.getByRole('button', { name: 'more', exact: true }).click();
    await page.getByPlaceholder('Search filters').fill(name);
    await page.getByRole('option', { name, exact: true }).first().click();
  }
  await expect(page.getByRole('dialog').getByRole('heading', { name, level: 3 })).toBeVisible();
}
// A reopened popover re-syncs its options for a moment and can swallow a click; retry until it sticks.
async function ensureChecked(page: Page, name: string) {
  const box = page.getByRole('checkbox', { name });
  await expect(async () => {
    if (!(await box.isChecked())) await box.click();
    await expect(box).toBeChecked({ timeout: 1000 });
  }).toPass();
}
const apply = (page: Page) =>
  page.getByRole('dialog').getByRole('button', { name: 'Apply' }).click();
const chip = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}\\s*(:|\\d)`) });

async function start(page: Page, waitForIdle: () => Promise<void>, query = '') {
  await page.goto(`${PATH}${query}`);
  await waitForIdle();
  return count(page);
}

test.describe('paging', () => {
  const pageLabel = (page: Page, n: number) => page.getByText(new RegExp(`^Page ${n} of `));

  test('Next, Previous and First update the page label and URL', async ({ page, waitForIdle }) => {
    await start(page, waitForIdle, '?country=DK');
    await expect(pageLabel(page, 1)).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(pageLabel(page, 2)).toBeVisible();
    await expect(page).toHaveURL(/[?&](from|offset)=\d+/);
    await waitForIdle();
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(pageLabel(page, 1)).toBeVisible();
    await waitForIdle();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(pageLabel(page, 2)).toBeVisible();
    await waitForIdle();
    await page.getByRole('button', { name: 'First' }).click();
    await expect(pageLabel(page, 1)).toBeVisible();
  });

  test('a deep link to page 3 opens page 3, and a new filter resets to page 1', async ({
    page,
    waitForIdle,
  }) => {
    await start(page, waitForIdle, '?country=DK');
    for (const n of [2, 3]) {
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(pageLabel(page, n)).toBeVisible();
      await waitForIdle();
    }
    const pageThree = page.url();

    await page.goto('about:blank');
    await page.goto(pageThree);
    await expect(pageLabel(page, 3)).toBeVisible();
    await waitForIdle();

    await openFilter(page, 'Year');
    await page.getByRole('textbox', { name: 'E.g. 1000,2000' }).fill('2020');
    await page.getByRole('button', { name: 'Add' }).click();
    await apply(page);
    await expect(page).toHaveURL(/[?&]year=2020(&|$)/);
    await expect(page).not.toHaveURL(/[?&](from|offset)=/);
    await expect(pageLabel(page, 1)).toBeVisible();
  });
});

test.describe('More filters', () => {
  test('searches the list, shows a filter inline and goes back', async ({ page, waitForIdle }) => {
    await start(page, waitForIdle);
    await page.getByRole('button', { name: 'more', exact: true }).click();
    const search = page.getByPlaceholder('Search filters');
    const options = page.getByRole('option');
    const all = await options.count();
    expect(all).toBeGreaterThan(3);

    await search.fill('Basis of record');
    await expect(options.first()).toHaveText('Basis of record');
    await options.first().click();
    await expect(page.getByRole('heading', { name: 'Basis of record', level: 3 })).toBeVisible();
    await page.getByRole('button', { name: 'Back to filter list' }).click();
    await expect(page.getByPlaceholder('Search filters')).toBeVisible();
    await page.getByPlaceholder('Search filters').fill('');
    await expect.poll(() => page.getByRole('option').count()).toBeGreaterThan(3);
  });

  test('scientific name suggestions are inside the viewport', async ({ page, waitForIdle }) => {
    await start(page, waitForIdle);
    await openFilter(page, 'Scientific name');
    await page.getByRole('dialog').getByRole('combobox').fill('Passer');
    const suggestions = page.getByRole('dialog').getByRole('listbox').getByRole('option');
    await expect(suggestions.nth(2)).toBeVisible();
    for (const i of [0, 1, 2]) await expect(suggestions.nth(i)).toBeInViewport({ ratio: 1 });
  });
});

test.describe('filter widgets', () => {
  test('SUGGEST: country suggests Denmark; clearing restores the count', async ({
    page,
    waitForIdle,
  }) => {
    const total = await start(page, waitForIdle);
    await openFilter(page, 'Country or area');
    await page.getByRole('dialog').getByPlaceholder('Search').fill('Den');
    await page.getByRole('dialog').getByText('Denmark', { exact: true }).click();
    await apply(page);
    await expect(page).toHaveURL(/[?&]country=DK(&|$)/);
    await expect(chip(page, 'Country or area')).toBeVisible();
    await expect.poll(() => count(page)).toBeLessThan(total);
    await waitForIdle();

    await page.getByRole('button', { name: 'Clear filter' }).first().click();
    await expect(page).not.toHaveURL(/country=/);
    await expect.poll(() => count(page)).toBe(total);
  });

  test('TAXON: scientific name suggests a species and sets taxonKey', async ({
    page,
    waitForIdle,
  }) => {
    const total = await start(page, waitForIdle);
    await openFilter(page, 'Scientific name');
    await page.getByRole('dialog').getByRole('combobox').fill('Passer domesticus');
    await page.getByRole('dialog').getByRole('listbox').getByRole('option').first().click();
    await apply(page);
    await expect(page).toHaveURL(/[?&]taxonKey=/);
    await expect.poll(() => count(page)).toBeLessThan(total);
  });

  test('RANGE: year writes a closed range and an open-ended one', async ({ page, waitForIdle }) => {
    const total = await start(page, waitForIdle);
    await openFilter(page, 'Year');
    await page.getByRole('textbox', { name: 'E.g. 1000,2000' }).fill('2000,2010');
    await page.getByRole('button', { name: 'Add' }).click();
    await apply(page);
    await expect(page).toHaveURL(/[?&]year=2000(%2C|,)2010(&|$)/);
    await expect.poll(() => count(page)).toBeLessThan(total);
    await waitForIdle();
    const closed = await count(page);

    await openFilter(page, 'Year');
    await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click();
    await page.getByRole('textbox', { name: 'E.g. 1000,2000' }).fill('2000,');
    await page.getByRole('button', { name: 'Add' }).click();
    await apply(page);
    await expect(page).toHaveURL(/[?&]year=2000(%2C|,)(\*)?(&|$)/);
    await expect.poll(() => count(page)).toBeGreaterThanOrEqual(closed);
  });

  test('ENUM: basis of record selects two values', async ({ page, waitForIdle }) => {
    const total = await start(page, waitForIdle);
    await openFilter(page, 'Basis of record');
    // The facet response re-renders the options, which drops a click made while it loads.
    await waitForIdle();
    await ensureChecked(page, 'Preserved specimen');
    await apply(page);
    await expect(page).toHaveURL(/[?&]basisOfRecord=PRESERVED_SPECIMEN(&|$)/);
    await expect.poll(() => count(page)).toBeLessThan(total);
    await waitForIdle();
    const one = await count(page);

    await openFilter(page, 'Basis of record');
    await waitForIdle();
    await ensureChecked(page, 'Fossil specimen');
    await apply(page);
    await expect(page).toHaveURL(/basisOfRecord=FOSSIL_SPECIMEN/);
    await expect.poll(() => count(page)).toBeGreaterThan(one);
  });

  test('OPTIONAL_BOOL: is sequenced narrows to Yes', async ({ page, waitForIdle }) => {
    const total = await start(page, waitForIdle);
    await openFilter(page, 'Is sequenced');
    await page.getByRole('radio', { name: /^Yes/ }).check();
    await apply(page);
    await expect(page).toHaveURL(/[?&]isSequenced=true(&|$)/);
    await expect.poll(() => count(page)).toBeLessThan(total);
  });

  test('WILDCARD: recorded by accepts a pattern', async ({ page, waitForIdle }) => {
    const total = await start(page, waitForIdle);
    await openFilter(page, 'Recorded by');
    await page.getByRole('dialog').getByRole('combobox').fill('*Smith*');
    await page.getByText('*Smith*', { exact: true }).first().click();
    await apply(page);
    // Pattern values have no plain query form, so the URL carries the encoded filter.
    await expect(page).toHaveURL(/[?&]filter=/);
    const encoded = new URL(page.url()).searchParams.get('filter')!;
    expect(JSON.parse(Buffer.from(encoded, 'base64').toString()).must.recordedBy).toEqual([
      { type: 'like', value: '*Smith*' },
    ]);
    await expect(chip(page, 'Recorded by')).toBeVisible();
    await expect.poll(() => count(page)).toBeLessThan(total);
  });
});

test.describe('complex filter form', () => {
  test('a ?filter= deep link applies a wildcard and survives a reload', async ({
    page,
    waitForIdle,
  }) => {
    const total = await start(page, waitForIdle);
    const filter = Buffer.from(
      JSON.stringify({ must: { recordedBy: [{ type: 'like', value: '*Smith*' }] } })
    ).toString('base64');
    await page.goto(`${PATH}?filter=${encodeURIComponent(filter)}`);
    await waitForIdle();
    const filtered = await count(page);
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
    await expect(chip(page, 'Recorded by')).toBeVisible();

    await page.reload();
    await waitForIdle();
    await expect(chip(page, 'Recorded by')).toBeVisible();
    expect(await count(page)).toBe(filtered);
  });

  test('a filter set round-trips through the URL', async ({ page, waitForIdle }) => {
    await start(page, waitForIdle, '?country=DK&year=2020&basisOfRecord=HUMAN_OBSERVATION');
    const before = await count(page);
    await page.reload();
    await waitForIdle();
    await expect(chip(page, 'Country or area')).toBeVisible();
    await expect(chip(page, 'Year')).toBeVisible();
    await expect(chip(page, 'Basis of record')).toBeVisible();
    expect(await count(page)).toBe(before);
  });
});
