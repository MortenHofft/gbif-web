import { DataHeader } from '@/components/dataHeader';
import DynamicHeightDiv from '@/components/DynamicHeightDiv';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FilterBarWithActions } from '@/components/filters/filterBarWithActions';
import { Card } from '@/components/ui/smallCard';
import { Tabs } from '@/components/tabs';
import { useConfig } from '@/config/config';
import { FilterProvider } from '@/contexts/filter';
import { SearchContextProvider, useSearchContext } from '@/contexts/search';
import { UrlStoreProvider, useUrlParam } from '@/contexts/urlStore';
import { useFilterParams } from '@/dataManagement/filterAdapter/useFilterParams';
import { useStringParam } from '@/hooks/useParam';
import { useUpdateViewParams } from '@/hooks/useUpdateViewParams';
import EntityDrawer from '@/routes/occurrence/search/views/browseList/ListBrowser';
import React, { memo, useMemo, useRef } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { useFilters } from './filters';
import { AboutContent, ApiContent } from './helpTexts';
import { searchConfig } from './searchConfig';
import { Table } from './views/table';
import { SearchPageTree } from './views/tree';
import PageMetaData from '@/components/PageMetaData';
import { ChecklistKeyContext } from '../ChecklistKeyContext';

export function TaxonSearchPage(): React.ReactElement {
  const [filter, setFilter] = useFilterParams({
    filterConfig: searchConfig,
    paramsToRemove: ['offset', 'from'],
  });
  const config = useConfig();
  const intl = useIntl();

  return (
    <>
      <PageMetaData
        path="/taxon/search"
        title={intl.formatMessage({ id: 'speciesSearch.title' })}
        description={intl.formatMessage({ id: 'speciesSearch.description' })}
      />

      <SearchContextProvider searchContext={config.taxonSearch}>
        <FilterProvider filter={filter} onChange={setFilter}>
          <UrlStoreProvider>
            <TaxonSearchPageInner
              datasetKey={config.taxonSearch?.checklistKey ?? config.defaultChecklistKey}
            />
          </UrlStoreProvider>
        </FilterProvider>
      </SearchContextProvider>
    </>
  );
}

export function TaxonSearchPageInner({
  datasetKey = import.meta.env.PUBLIC_DEFAULT_CHECKLIST_KEY,
}: {
  datasetKey?: string;
}): React.ReactElement {
  const searchContext = useSearchContext();
  const { filters } = useFilters({ searchConfig, datasetKey });
  const defaultView = searchContext?.tabs?.[0] ?? 'table';
  const [view, setView] = useStringParam({
    key: 'view',
    defaultValue: defaultView,
    hideDefault: true,
  });

  const visibleFilters = useMemo(() => {
    if (view === 'table') {
      return filters;
    } else if (view === 'tree') {
      return { taxonId: filters.taxonId };
    } else if (filters.q) {
      return { q: filters.q };
    } else {
      return {};
    }
  }, [filters, view]);

  return (
    <ChecklistKeyContext.Provider value={{ datasetKey }}>
      <PocDebugBar />
      <EntityDrawer />
      <DataHeader
        className="g-bg-white"
        title={<FormattedMessage id="catalogues.taxa" defaultMessage="Taxa" />}
        hasBorder
        aboutContent={<AboutContent />}
        apiContent={<ApiContent />}
      >
        {/* <TaxonViewTabs
          setView={setView}
          view={view}
          defaultView={defaultView}
          tabs={searchContext.tabs}
        /> */}
      </DataHeader>

      <section className="g-bg-white g-border-b g-border-slate-200">
        <FilterBarWithActions filters={visibleFilters} className="g-px-4" />
      </section>

      <ViewsByUrlParam
        defaultView={defaultView}
        entityDrawerPrefix="t"
        className="g-py-2 g-px-4 g-bg-slate-100"
      />
    </ChecklistKeyContext.Provider>
  );
}

export function TaxonSearchInner({
  datasetKey = import.meta.env.PUBLIC_DEFAULT_CHECKLIST_KEY,
}: {
  datasetKey?: string;
}): React.ReactElement {
  const searchContext = useSearchContext();
  const { filters } = useFilters({ searchConfig, datasetKey });
  const defaultView = searchContext?.tabs?.[0] ?? 'table';
  const [view] = useStringParam({
    key: 'view',
    defaultValue: defaultView,
    hideDefault: true,
  });

  const visibleFilters = useMemo(() => {
    if (view === 'table') {
      return filters;
    } else if (view === 'tree') {
      return { taxonId: filters.taxonId };
    } else if (filters.q) {
      return { q: filters.q };
    } else {
      return {};
    }
  }, [filters, view]);

  return (
    <ChecklistKeyContext.Provider value={{ datasetKey }}>
      <UrlStoreProvider>
        <ErrorBoundary showReportButton>
          <EntityDrawer />
          <Card>
            {/* <TaxonViewTabs
                setView={() => {}}
                view={view}
                defaultView={defaultView}
                tabs={searchContext.tabs}
              /> */}
            <div className="g-p2">
              <FilterBarWithActions filters={visibleFilters} />
            </div>
          </Card>

          <ViewsByUrlParam
            defaultView={defaultView}
            entityDrawerPrefix="t"
            className="g-py-2"
          />
        </ErrorBoundary>
      </UrlStoreProvider>
    </ChecklistKeyContext.Provider>
  );
}

// DEBUG widget: side-by-side render counters. Both components are memo'd
// and take no props — the only difference is the hook used to read `view`.
//   - Baseline subscribes to react-router-dom's full searchParams context,
//     so it rerenders on every URL change (the existing behaviour).
//   - POC subscribes via the URL store, so it only rerenders when the
//     'view' param's value actually changes.
// Click "change q (filter)" repeatedly → baseline counter increments,
// POC counter stays put. Click view=table/view=tree → both increment.
// Remove this widget once the difference has been verified.
const RenderCounterBaseline = memo(function RenderCounterBaseline() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') ?? '(default)';
  const count = useRef(0);
  count.current += 1;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        marginRight: 8,
        background: '#fee',
        border: '1px solid #c00',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      baseline useSearchParams renders={count.current} view={view}
    </span>
  );
});

const RenderCounterPoc = memo(function RenderCounterPoc() {
  const view = useUrlParam('view') ?? '(default)';
  const count = useRef(0);
  count.current += 1;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        background: '#efe',
        border: '1px solid #0a0',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      POC useUrlParam renders={count.current} view={view}
    </span>
  );
});

function PocDebugBar() {
  const [, setSearchParams] = useSearchParams();
  const setParam = (key: string, value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { preventScrollReset: true }
    );
  return (
    <div
      style={{
        padding: 8,
        background: '#fff',
        borderBottom: '1px solid #ccc',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <RenderCounterBaseline />
      <RenderCounterPoc />
      <button onClick={() => setParam('view', 'table')}>view=table</button>
      <button onClick={() => setParam('view', 'tree')}>view=tree</button>
      <button onClick={() => setParam('q', String(Math.random()).slice(2, 8))}>
        change q (filter)
      </button>
    </div>
  );
}

// POC: per-key URL subscription. This leaf reads `view` directly from the
// URL store (useUrlParam) and is wrapped in memo so it doesn't rerender
// when its parent rerenders for unrelated URL changes (e.g. filter or
// pagination updates). It only rerenders when the `view` param itself
// changes — proving out per-key subscription via useSyncExternalStore.
export const ViewsByUrlParam = memo(function ViewsByUrlParam({
  defaultView,
  className,
  entityDrawerPrefix,
}: {
  defaultView?: string;
  className?: string;
  entityDrawerPrefix: string;
}) {
  const view = useUrlParam('view') ?? defaultView;
  return (
    <Views view={view} className={className} entityDrawerPrefix={entityDrawerPrefix} />
  );
});

export function Views({
  view,
  className,
  entityDrawerPrefix,
}: {
  view?: string;
  className?: string;
  entityDrawerPrefix: string;
}) {
  const fixedHeight = ['table'].includes(view ?? '');
  return (
    <ErrorBoundary invalidateOn={view}>
      <div className={className}>
        {fixedHeight && (
          <DynamicHeightDiv minPxHeight={500}>
            {view === 'table' && <Table entityDrawerPrefix={entityDrawerPrefix} />}
          </DynamicHeightDiv>
        )}
        {!fixedHeight && (
          <DynamicHeightDiv
            minPxHeight={500}
            onlySetMinHeight
            className="g-bg-white g-flex-1 g-border g-border-solid g-basis-full g-h-1 g-flex g-flex-col g-overflow-auto g-p-4"
          >
            {view === 'tree' && <SearchPageTree entityDrawerPrefix={entityDrawerPrefix} />}
          </DynamicHeightDiv>
        )}
      </div>
    </ErrorBoundary>
  );
}

export function TaxonViewTabs({
  view,
  defaultView,
  tabs = ['table', 'tree'],
}: {
  setView: (view: string) => void;
  defaultView?: string;
  view?: string;
  tabs?: string[];
}) {
  const { getParams } = useUpdateViewParams(['from', 'sort', 'limit', 'offset']); // Removes 'from' and 'sort'

  return (
    <Tabs
      disableAutoDetectActive
      className="g-border-none"
      links={tabs.map((tab) => ({
        isActive: view === tab,
        to: { search: getParams(tab, defaultView).toString() },
        children: <FormattedMessage id={`search.tabs.${tab}`} defaultMessage={tab} />,
      }))}
    />
  );
}
