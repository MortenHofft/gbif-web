import { useState, useEffect } from 'react';
import FilterBuilder from './FilterBuilder.jsx';
import { filtersToQuery, queryToFilters } from './filterUrl.js';
import { useFilterHistory } from './filterHistory.js';
import { DATASET_FILTER_CONFIG, DATASET_FILTER_MAP } from './datasetFilterConfig.js';

export default function App() {
  // null = still loading (prevents a flash of empty state before URL is parsed)
  const [filters, setFilters] = useState(null);

  // Dataset-search filters are kept local — they don't round-trip to the URL
  // (which is owned by the occurrence builder). The composed query string is
  // shown in a read-only text field below the input.
  const [datasetFilters, setDatasetFilters] = useState([]);

  useEffect(() => {
    queryToFilters(window.location.search)
      .then(setFilters)
      .catch(() => setFilters([]));
  }, []);

  const handleChange = (newFilters) => {
    setFilters(newFilters);
    const qs = filtersToQuery(newFilters);
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname + location.hash);
  };

  const shortcuts = useFilterHistory(filters ?? []);

  if (filters === null) return null;

  const datasetQuery = filtersToQuery(datasetFilters, DATASET_FILTER_MAP);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '48px 24px' }}>
      <FilterBuilder
        value={filters}
        showChipsInInput={false}
        onChange={handleChange}
        subtitle={
          <>Compose occurrence search filters. Try typing <code style={codeStyle}>basisOfRecord</code> or <code style={codeStyle}>taxonKey</code>.</>
        }
        rootEntities={[
          'taxonKey',
          'basisOfRecord',
          { key: 'typeStatus', minChars: 3 },
          { key: 'establishmentMeans', minChars: 4 },
        ]}
        shortcuts={shortcuts}
        valueActions={[
          {
            id: 'facet-chart',
            label: '📊 View these suggestions as a facet chart',
            // when: cfg => cfg.type === 'enum' || cfg.type === 'vocabulary',
            onSelect: ({ filterName, filterLabel, valueQuery }) => {
              // Hook in the real chart launcher here.
              console.log('Launch facet chart for', { filterName, filterLabel, valueQuery });
              window.alert(`Facet chart for ${filterLabel} (q="${valueQuery}")`);
            },
          },
        ]}
      />

      <div style={{ height: 48 }} />

      <FilterBuilder
        value={datasetFilters}
        onChange={setDatasetFilters}
        showChipsInInput={false}
        filterConfig={DATASET_FILTER_CONFIG}
        title="GBIF Dataset Search"
        subtitle={
          <>Compose registry dataset filters. Try typing <code style={codeStyle}>type</code>, <code style={codeStyle}>publishingCountry</code>, or a dataset name like <code style={codeStyle}>iNaturalist</code>.</>
        }
        placeholder="Search dataset filters…"
        queryLabel="Dataset search query"
        rootEntities={[
          'datasetKey',
          'publishingOrg',
        ]}
      />

      {datasetFilters.length > 0 && (
        <div style={{ maxWidth: 700, margin: '16px auto 0' }}>
          <label style={textFieldLabelStyle} htmlFor="dataset-search-text">
            Dataset search (as text)
          </label>
          <input
            id="dataset-search-text"
            type="text"
            readOnly
            value={datasetQuery}
            style={textFieldStyle}
            onFocus={e => e.target.select()}
          />
        </div>
      )}
    </div>
  );
}

const codeStyle = {
  fontFamily: 'monospace', background: '#f3f4f6',
  padding: '1px 5px', borderRadius: '4px', fontSize: '13px',
};

const textFieldLabelStyle = {
  display: 'block',
  fontSize: '11px', fontWeight: 700, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.07em',
  marginBottom: '6px',
};

const textFieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  fontFamily: 'monospace', fontSize: '13px', color: '#374151',
  background: '#fff',
  border: '1px solid #d1d5db', borderRadius: '8px',
  outline: 'none',
};
