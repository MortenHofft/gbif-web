// @vitest-environment jsdom
// gbif-web's vitest config defaults to the node environment and has no global
// setupFiles, so this component test opts into jsdom and pulls in the cmdk /
// clipboard polyfills (and jest-dom matchers) explicitly via ./setup.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilterBuilder from '../FilterBuilder';
import './setup';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockFetchStrings(strings) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => strings,
  }));
}

function mockFetchError() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  // navigator.clipboard is stubbed in setup.js; spy on its writeText method directly.
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);
  return writeText;
}

// Helper: wait for and return the dropdown
async function getDropdown() {
  return screen.findByTestId('filter-dropdown');
}

// Helper: apply a single enum filter (reused across several tests)
async function applyEnumFilter(user, filterExpr, valueLabel) {
  const input = screen.getByPlaceholderText('Search filters…');
  await user.type(input, filterExpr);
  const dropdown = await getDropdown();
  await user.click(within(dropdown).getByText(valueLabel));
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('initial render', () => {
  it('renders without crashing', () => {
    render(<FilterBuilder />);
    expect(screen.getByPlaceholderText('Search filters…')).toBeInTheDocument();
  });

  it('shows the "Type a filter name" hint', () => {
    render(<FilterBuilder />);
    expect(screen.getByText(/Type a filter name/)).toBeInTheDocument();
  });

  it('does not show the URL parameters section', () => {
    render(<FilterBuilder />);
    expect(screen.queryByText('URL Parameters')).not.toBeInTheDocument();
  });
});

// ── Filter name suggestions ───────────────────────────────────────────────────

describe('filter name suggestions', () => {
  it('shows filter labels in the dropdown when openOnFocus and the input is focused', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder openOnFocus />);
    await user.click(screen.getByPlaceholderText('Search filters…'));
    const dropdown = await getDropdown();
    // The dropdown now shows the friendly label, not the raw key.
    expect(within(dropdown).getByText('Basis of Record')).toBeInTheDocument();
    expect(within(dropdown).getByText('Taxon')).toBeInTheDocument();
    expect(within(dropdown).queryByText('basisOfRecord')).not.toBeInTheDocument();
  });

  it('does not auto-open the dropdown on focus by default', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);
    await user.click(screen.getByPlaceholderText('Search filters…'));
    // No dropdown until the user types or presses ArrowDown.
    expect(screen.queryByTestId('filter-dropdown')).not.toBeInTheDocument();
  });

  it('opens the dropdown on ArrowDown even when openOnFocus is false', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);
    const input = screen.getByPlaceholderText('Search filters…');
    await user.click(input);
    expect(screen.queryByTestId('filter-dropdown')).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    expect(await getDropdown()).toBeInTheDocument();
  });

  it('narrows dropdown to matching prefix', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);
    await user.type(screen.getByPlaceholderText('Search filters…'), 'bas');
    const dropdown = await getDropdown();
    // highlight() wraps matched prefix in <strong>, splitting text nodes — use textContent
    expect(within(dropdown).getByText((_, el) => el.textContent === 'Basis of Record')).toBeInTheDocument();
    expect(within(dropdown).queryByText('Taxon')).not.toBeInTheDocument();
  });

  it('shows only the free-text option for an unrecognised prefix', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);
    await user.type(screen.getByPlaceholderText('Search filters…'), 'zzz');
    const dropdown = screen.queryByTestId('filter-dropdown');
    expect(dropdown).toBeInTheDocument();
    expect(within(dropdown).getByText((_, el) => el.textContent === '"zzz"')).toBeInTheDocument();
  });

  it('matches a filter by alias as well as key and label', async () => {
    const user = userEvent.setup();
    const config = [
      { key: 'taxonKey', label: 'Taxon', aliases: ['Scientific name'], hint: 'h', type: 'enum', values: ['a'] },
      { key: 'basisOfRecord', label: 'Basis of Record', hint: 'h', type: 'enum', values: ['b'] },
    ];
    render(<FilterBuilder filterConfig={config} rootEntities={[]} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), 'scientific');
    const dropdown = await getDropdown();
    expect(within(dropdown).getByText((_, el) => el.textContent === 'Taxon')).toBeInTheDocument();
    expect(within(dropdown).queryByText((_, el) => el.textContent === 'Basis of Record')).not.toBeInTheDocument();
  });
});

// ── Per-field capability flags ────────────────────────────────────────────────

describe('supportsNegation / supportsExistence flags', () => {
  const capsConfig = [
    {
      key: 'type', label: 'Dataset Type', hint: 'h',
      type: 'enum', values: ['OCCURRENCE', 'CHECKLIST'],
      supportsNegation: false, supportsExistence: false,
    },
    {
      key: 'taxonKey', label: 'Taxon', hint: 'h',
      type: 'enum', values: ['a'],
    },
  ];

  it('hides non-negatable fields when the user types "!"', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder filterConfig={capsConfig} rootEntities={[]} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), '!t');
    const dropdown = screen.queryByTestId('filter-dropdown');
    if (dropdown) {
      // 'taxonKey' contains "t" and DOES support negation → must be there.
      // The highlight wraps the matching "T" in a <strong>, so match on textContent.
      expect(within(dropdown).getByText((_, el) => el.textContent === 'Taxon')).toBeInTheDocument();
      // 'type' also matches "t" by key but is non-negatable → must NOT be there.
      expect(within(dropdown).queryByText((_, el) => el.textContent === 'Dataset Type')).not.toBeInTheDocument();
    }
  });

  it('skips root-entity inline suggestions when the user types "!"', async () => {
    const user = userEvent.setup();
    // taxonKey is the typical root entity. With "!" typed it must not
    // fire any network call (no fetch mock set → would throw if attempted).
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchSpy);
    render(<FilterBuilder filterConfig={capsConfig} rootEntities={['taxonKey']} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), '!tax');
    // Give the debounce a chance to fire.
    await new Promise(r => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('hides non-negated recents from the "Recent" section when "!" is typed', async () => {
    const user = userEvent.setup();
    const recents = [
      { filterName: 'taxonKey', filterLabel: 'Taxon', value: '1', valueLabel: 'One', negated: false },
      { filterName: 'taxonKey', filterLabel: 'Taxon', value: '2', valueLabel: 'Two', negated: true },
    ];
    render(<FilterBuilder filterConfig={capsConfig} rootEntities={[]} shortcuts={recents} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), '!');
    const dropdown = screen.queryByTestId('filter-dropdown');
    if (dropdown) {
      expect(within(dropdown).queryByText(/Taxon: One/)).not.toBeInTheDocument();
      expect(within(dropdown).getByText(/Taxon: Two/)).toBeInTheDocument();
    }
  });

  it('omits the wildcard option for fields where supportsExistence is false', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder filterConfig={capsConfig} rootEntities={[]} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), 'type=');
    const dropdown = await getDropdown();
    expect(within(dropdown).queryByText(/has any value/)).not.toBeInTheDocument();
    expect(within(dropdown).getByText('OCCURRENCE')).toBeInTheDocument();
  });

  it('keeps the wildcard for fields without the flag (default behaviour)', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder filterConfig={capsConfig} rootEntities={[]} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), 'taxonKey=');
    const dropdown = await getDropdown();
    expect(within(dropdown).getByText(/has any value/)).toBeInTheDocument();
  });
});

// ── Range presets ─────────────────────────────────────────────────────────────

describe('range presets', () => {
  const rangeConfig = [{
    key: 'elevation',
    label: 'Elevation',
    hint: 'metres',
    type: 'integerRange',
    presets: [
      { value: '0,500',  label: 'Up to 500 m' },
      { value: '500,*',  label: 'Above 500 m' },
    ],
  }];

  it('shows presets in a "Quick ranges" group on an empty value', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder filterConfig={rangeConfig} rootEntities={[]} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), 'elevation=');
    const dropdown = await getDropdown();
    expect(within(dropdown).getByText('Quick ranges')).toBeInTheDocument();
    expect(within(dropdown).getByText('Up to 500 m')).toBeInTheDocument();
    expect(within(dropdown).getByText('Above 500 m')).toBeInTheDocument();
  });

  it('selecting a preset adds a chip with the value range and closes the dropdown', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder filterConfig={rangeConfig} rootEntities={[]} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), 'elevation=');
    const dropdown = await getDropdown();
    await user.click(within(dropdown).getByText('Above 500 m'));
    expect(screen.getByText('Elevation')).toBeInTheDocument();
    // Without a formatValue helper on the config, the chip falls back to
    // the preset's own label.
    expect(screen.getByText('Above 500 m')).toBeInTheDocument();
    expect(screen.queryByTestId('filter-dropdown')).not.toBeInTheDocument();
  });
});

// ── Full enum filter application flow ────────────────────────────────────────

describe('applying an enum filter', () => {
  it('selecting a value adds a chip and shows URL params', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await applyEnumFilter(user, 'basisOfRecord=', 'OBSERVATION');

    expect(screen.getByText('Basis of Record')).toBeInTheDocument();
    expect(screen.getByText('OBSERVATION')).toBeInTheDocument();
    expect(screen.getByText('URL Parameters')).toBeInTheDocument();
    expect(screen.getByText(/basisOfRecord=OBSERVATION/)).toBeInTheDocument();
  });

  it('input is cleared after a filter is applied', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);
    const input = screen.getByPlaceholderText('Search filters…');

    await applyEnumFilter(user, 'basisOfRecord=', 'OBSERVATION');

    expect(input.value).toBe('');
  });

  it('keyboard Enter applies the highlighted suggestion', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await user.type(screen.getByPlaceholderText('Search filters…'), 'basisOfRecord=');
    await getDropdown();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(screen.getByText('URL Parameters')).toBeInTheDocument();
  });
});

// ── Negated filters ───────────────────────────────────────────────────────────

describe('negated filters', () => {
  it('! prefix creates a chip with a NOT badge', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await applyEnumFilter(user, '!basisOfRecord=', 'OBSERVATION');

    expect(screen.getByText('NOT')).toBeInTheDocument();
  });

  it('negated filter URL param has ! prefix', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await applyEnumFilter(user, '!basisOfRecord=', 'OBSERVATION');

    expect(screen.getByText(/!basisOfRecord=OBSERVATION/)).toBeInTheDocument();
  });
});

// ── Wildcard ──────────────────────────────────────────────────────────────────

describe('wildcard selection', () => {
  it('positive wildcard chip label is "has any value"', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await user.type(screen.getByPlaceholderText('Search filters…'), 'hasCoordinate=');
    // Wildcard renders as "∗  has any value" across sibling nodes — use regex
    const dropdown = await getDropdown();
    await user.click(within(dropdown).getByText(/has any value/));

    expect(screen.getByText('has any value')).toBeInTheDocument();
  });

  it('negated wildcard chip label is "has no value"', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await user.type(screen.getByPlaceholderText('Search filters…'), '!hasCoordinate=');
    const dropdown = await getDropdown();
    await user.click(within(dropdown).getByText(/has any value/));

    expect(screen.getByText('has no value')).toBeInTheDocument();
  });
});

// ── Chip removal ──────────────────────────────────────────────────────────────

describe('removing chips', () => {
  it('× button removes the chip', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await applyEnumFilter(user, 'basisOfRecord=', 'OBSERVATION');
    expect(screen.getByText('URL Parameters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove basis of record/i }));

    expect(screen.queryByText('URL Parameters')).not.toBeInTheDocument();
  });

  it('Backspace on empty input removes the last chip', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);
    const input = screen.getByPlaceholderText('Search filters…');

    await applyEnumFilter(user, 'basisOfRecord=', 'OBSERVATION');
    expect(screen.getByText('URL Parameters')).toBeInTheDocument();

    // Explicitly focus the input (jsdom doesn't reliably inherit programmatic focus)
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(screen.queryByText('URL Parameters')).not.toBeInTheDocument();
  });
});

// ── API-backed filters ────────────────────────────────────────────────────────

describe('suggestString filter (mocked fetch)', () => {
  it('shows API suggestions and applies the selected one as a chip', async () => {
    mockFetchStrings(['Maria Merian', 'Marie Curie']);
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await user.type(screen.getByPlaceholderText('Search filters…'), 'recordedBy=mari');

    // highlight() wraps "mari" in <strong>, splitting text nodes across elements.
    // Testing Library's getNodeText only reads direct text nodes, so use textContent.
    const dropdown = await getDropdown();
    const [itemEl] = await within(dropdown).findAllByText((_, el) => el.textContent === 'Maria Merian');
    await user.click(itemEl);

    expect(screen.getByText('Recorded By')).toBeInTheDocument();
    // Chip value label is set directly from the suggestion's label — no splitting
    expect(screen.getByText('Maria Merian')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    mockFetchError();
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await user.type(screen.getByPlaceholderText('Search filters…'), 'recordedBy=mari');

    expect(await screen.findByText('Failed to load suggestions')).toBeInTheDocument();
  });

  it('clicking the error item does not add a chip', async () => {
    mockFetchError();
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await user.type(screen.getByPlaceholderText('Search filters…'), 'recordedBy=mari');
    await user.click(await screen.findByText('Failed to load suggestions'));

    expect(screen.queryByText('URL Parameters')).not.toBeInTheDocument();
  });
});

// ── Copy button ───────────────────────────────────────────────────────────────

describe('copy button', () => {
  it('calls clipboard.writeText with the correct param string', async () => {
    const writeText = mockClipboard();
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await applyEnumFilter(user, 'basisOfRecord=', 'OBSERVATION');
    await user.click(screen.getByRole('button', { name: /copy params/i }));

    expect(writeText).toHaveBeenCalledWith('?basisOfRecord=OBSERVATION');
  });

  it('button text changes to "✓ Copied!" after clicking', async () => {
    mockClipboard();
    const user = userEvent.setup();
    render(<FilterBuilder />);

    await applyEnumFilter(user, 'basisOfRecord=', 'OBSERVATION');
    const copyBtn = screen.getByRole('button', { name: /copy params/i });
    await user.click(copyBtn);

    await waitFor(() => expect(copyBtn).toHaveTextContent('✓ Copied!'));
  });
});

// ── Multiple filters ──────────────────────────────────────────────────────────

describe('multiple filters', () => {
  it('URL params join multiple filters with &', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder />);
    const input = screen.getByPlaceholderText('Search filters…');

    await applyEnumFilter(user, 'basisOfRecord=', 'OBSERVATION');
    await user.type(input, 'occurrenceStatus=');
    const dropdown = await getDropdown();
    await user.click(within(dropdown).getByText('PRESENT'));

    const urlArea = screen.getByText(/basisOfRecord=OBSERVATION/);
    expect(urlArea.textContent).toMatch(/occurrenceStatus=PRESENT/);
  });
});

// ── Custom filterConfig prop ──────────────────────────────────────────────────

describe('custom filterConfig', () => {
  const customConfig = [
    {
      key: 'shape',
      label: 'Shape',
      hint: 'A geometric shape',
      type: 'enum',
      values: ['CIRCLE', 'SQUARE', 'TRIANGLE'],
    },
  ];

  it('uses the supplied filterConfig and ignores the default catalogue', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder filterConfig={customConfig} openOnFocus />);
    await user.click(screen.getByPlaceholderText('Search filters…'));
    const dropdown = await getDropdown();
    // The dropdown shows the friendly label, not the raw key.
    expect(within(dropdown).getByText('Shape')).toBeInTheDocument();
    expect(within(dropdown).queryByText('Basis of Record')).not.toBeInTheDocument();
    expect(within(dropdown).queryByText('Taxon')).not.toBeInTheDocument();
  });

  it('respects custom title, placeholder and queryLabel props', async () => {
    const user = userEvent.setup();
    render(
      <FilterBuilder
        filterConfig={customConfig}
        title="Custom Builder"
        placeholder="Find a shape…"
        queryLabel="Shape query"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Custom Builder' })).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Find a shape…');
    await user.type(input, 'shape=');
    const dropdown = await getDropdown();
    await user.click(within(dropdown).getByText('CIRCLE'));
    expect(screen.getByText('Shape query')).toBeInTheDocument();
  });
});

// ── Enum with labelled values ─────────────────────────────────────────────────

describe('enum with {value,label} values', () => {
  const labelledConfig = [
    {
      key: 'country',
      label: 'Country',
      hint: 'Pick a country',
      type: 'enum',
      values: [
        { value: 'DK', label: 'Denmark' },
        { value: 'DE', label: 'Germany' },
        { value: 'FR', label: 'France' },
      ],
      formatValue: v => ({ DK: 'Denmark', DE: 'Germany', FR: 'France' }[v] ?? v),
    },
  ];

  it('matches against the label as well as the value', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder filterConfig={labelledConfig} />);
    await user.type(screen.getByPlaceholderText('Search filters…'), 'country=denm');
    const dropdown = await getDropdown();
    expect(within(dropdown).getByText((_, el) => el.textContent === 'Denmark')).toBeInTheDocument();
    expect(within(dropdown).queryByText('France')).not.toBeInTheDocument();
  });

  it('chip uses the labelled name via formatValue', async () => {
    const user = userEvent.setup();
    render(<FilterBuilder filterConfig={labelledConfig} />);
    await applyEnumFilter(user, 'country=', 'Germany');
    expect(screen.getByText('Country')).toBeInTheDocument();
    // The chip's value label comes from formatValue('DE') → 'Germany'.
    const chipMatches = screen.getAllByText('Germany');
    expect(chipMatches.length).toBeGreaterThan(0);
  });
});
