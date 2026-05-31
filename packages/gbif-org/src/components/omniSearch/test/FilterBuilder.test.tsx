// @vitest-environment jsdom
// gbif-web's vitest config defaults to the node environment and has no global
// setupFiles, so this component test opts into jsdom and pulls in the cmdk /
// clipboard polyfills (and jest-dom matchers) explicitly via ./setup.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBuilder from '../FilterBuilder';
import type { FilterItem } from '../types';
import './setup';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PLACEHOLDER = 'Search filters…';

// Open the popover and return its (auto-focused) search input.
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /search/i }));
  return screen.getByPlaceholderText(PLACEHOLDER);
}

describe('FilterBuilder', () => {
  it('renders an input-styled trigger and opens a popover on click', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder onSelect={() => {}} />);
    expect(screen.queryByTestId('filter-dropdown')).not.toBeInTheDocument();
    await open(user);
    expect(await screen.findByTestId('filter-dropdown')).toBeInTheDocument();
  });

  it('searches filter fields by name and shows matches', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder onSelect={() => {}} rootEntities={[]} />);
    const input = await open(user);
    await user.type(input, 'basisOfRecord');
    expect(await screen.findByText('Basis of Record')).toBeInTheDocument();
  });

  it('selecting a field moves into value mode (input becomes "field=")', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder onSelect={() => {}} rootEntities={[]} />);
    const input = (await open(user)) as HTMLInputElement;
    await user.type(input, 'occurrenceStatus');
    await user.click(await screen.findByRole('option', { name: /Occurrence Status/i }));
    await waitFor(() => expect(input.value).toBe('occurrenceStatus='));
    expect(await screen.findByText('Values for')).toBeInTheDocument();
  });

  it('selecting a value emits the item via onSelect and closes the popover', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FilterBuilder onSelect={onSelect} rootEntities={[]} />);
    const input = await open(user);
    await user.type(input, 'occurrenceStatus=PRESENT');
    await user.click(await screen.findByRole('option', { name: 'PRESENT' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject<Partial<FilterItem>>({
      filterName: 'occurrenceStatus',
      value: 'PRESENT',
      negated: false,
    });
    await waitFor(() => expect(screen.queryByTestId('filter-dropdown')).not.toBeInTheDocument());
  });

  it('negation: a "!" prefix marks the emitted item negated', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FilterBuilder onSelect={onSelect} rootEntities={[]} />);
    const input = await open(user);
    await user.type(input, '!occurrenceStatus=ABSENT');
    expect(await screen.findByText(/negated/i)).toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'ABSENT' }));
    expect(onSelect.mock.calls[0][0]).toMatchObject({ filterName: 'occurrenceStatus', value: 'ABSENT', negated: true });
  });

  it('wildcard value emits "has any value"', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FilterBuilder onSelect={onSelect} rootEntities={[]} />);
    const input = await open(user);
    await user.type(input, 'occurrenceStatus=*');
    await user.click(await screen.findByRole('option', { name: /has any value/i }));
    expect(onSelect.mock.calls[0][0]).toMatchObject({ value: '*', valueLabel: 'has any value', negated: false });
  });

  it('free-text fallback emits a q filter', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FilterBuilder onSelect={onSelect} rootEntities={[]} />);
    const input = await open(user);
    await user.type(input, 'puma concolor');
    await user.click(await screen.findByRole('option', { name: /puma concolor/ }));
    expect(onSelect.mock.calls[0][0]).toMatchObject({ filterName: 'q', value: 'puma concolor', negated: false });
  });

  it('suggestString fields fetch and apply API suggestions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ['Taxonomy lab', 'Tax dept'] })
    );
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<FilterBuilder onSelect={onSelect} rootEntities={[]} />);
    const input = await open(user);
    await user.type(input, 'recordedBy=Tax');
    const option = await waitFor(
      () => {
        const match = screen
          .getAllByRole('option')
          .find((el) => el.textContent === 'Taxonomy lab');
        if (!match) throw new Error('not yet');
        return match;
      },
      { timeout: 2000 }
    );
    await user.click(option);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ filterName: 'recordedBy', value: 'Taxonomy lab' });
  });
});
