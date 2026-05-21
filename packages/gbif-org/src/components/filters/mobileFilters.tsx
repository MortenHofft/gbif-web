import { Button } from '@/components/ui/button';
import { Dialog, DialogBottomSheetContent, DialogTrigger } from '@/components/ui/dialog';
import { FilterContext } from '@/contexts/filter';
import { cn } from '@/utils/shadcn';
import { useContext, useMemo } from 'react';
import { LuSettings2 as FilterIcon } from 'react-icons/lu';
import { Filters, FilterSetting, getFilterSummary } from './filterTools';
import { MobileFilterDrawerContent } from './mobileFilterDrawer';
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl';
import { useSearchContext } from '@/contexts/search';

interface MobileFiltersProps {
  filters: Filters;
  groups?: string[];
  className?: string;
}

export function MobileFilters({ filters, groups, className }: MobileFiltersProps) {
  const filterContext = useContext(FilterContext);
  const searchContext = useSearchContext();
  const intl = useIntl();

  const { inlineFilters, otherFilters } = useMemo(() => {
    const enabledFilters = { ...filters };
    searchContext?.excludedFilters?.forEach((filter) => {
      delete enabledFilters[filter];
    });

    // Extract inline filters (q and eventFiltering) to show them outside the drawer
    const inlineFilters: FilterSetting[] = [];
    const highlightedFilters = searchContext?.highlightedFilters || [];

    if (highlightedFilters.includes('q') && enabledFilters.q) {
      inlineFilters.push(enabledFilters.q);
      delete enabledFilters.q;
    }

    // eventFiltering is always inline when present
    if (enabledFilters.eventFiltering) {
      inlineFilters.push(enabledFilters.eventFiltering);
      delete enabledFilters.eventFiltering;
    }

    return {
      inlineFilters,
      otherFilters: enabledFilters,
    };
  }, [filters, searchContext]);

  const activeFilterCount = useMemo(() => {
    if (!filterContext) return 0;

    // Count all active filters
    const otherFilterHandles = Object.keys(otherFilters);
    return otherFilterHandles.reduce((count, handle) => {
      const summary = getFilterSummary(filterContext.filter, handle);
      return count + summary.defaultCount;
    }, 0);
  }, [filterContext, otherFilters]);

  return (
    <div className={cn('g-flex g-flex-1 g-flex-row g-items-center g-gap-1', className)}>
      {inlineFilters.map((filter) => (
        <filter.Button key={filter.handle} />
      ))}
      {Object.keys(otherFilters).length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              aria-label={intl.formatMessage(
                {
                  id: 'filterSupport.filtersWithCount',
                  defaultMessage: 'Filters ({count} active)',
                },
                { count: activeFilterCount }
              )}
              className="g-relative g-h-11 g-min-w-11 g-px-3 g-gap-1.5 g-text-slate-600"
            >
              <FilterIcon className="g-text-base" aria-hidden="true" />
              <span className="g-text-sm g-font-medium">
                <FormattedMessage id="filterSupport.filters" defaultMessage="Filters" />
              </span>
              {activeFilterCount > 0 && (
                <span
                  aria-hidden="true"
                  className="g-bg-primary-500 g-text-white g-text-xs g-rounded-full g-min-w-5 g-h-5 g-px-1 g-inline-flex g-items-center g-justify-center g-font-medium"
                >
                  <FormattedNumber value={activeFilterCount} />
                </span>
              )}
            </Button>
          </DialogTrigger>
          <DialogBottomSheetContent
            className="g-w-full g-p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <MobileFilterDrawerContent filters={otherFilters} groups={groups} />
          </DialogBottomSheetContent>
        </Dialog>
      )}
    </div>
  );
}
