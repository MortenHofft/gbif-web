import type { ComponentChildren } from 'preact';
import type { DatasetView } from '../transform';
import { TABS, type TabId } from './tabs';

type Props = {
  view: DatasetView;
  activeTab: TabId;
  children: ComponentChildren;
};

// Server-rendered shell shared by every dataset tab: header + tab nav + content slot.
export function DatasetLayout({ view, activeTab, children }: Props) {
  return (
    <div class="min-h-screen">
      <header class="bg-white border-b">
        <div class="mx-auto max-w-5xl px-4 py-6">
          <div class="flex items-start gap-4">
            {view.logoUrl && (
              <img
                src={view.logoUrl}
                alt=""
                class="h-14 w-14 rounded object-contain border bg-white"
              />
            )}
            <div class="min-w-0">
              <div class="text-xs font-medium uppercase tracking-wide text-emerald-700">
                {view.typeLabel}
              </div>
              <h1 class="mt-1 text-2xl font-semibold leading-tight">{view.title}</h1>
              {view.publisher.title && (
                <p class="mt-1 text-sm text-gray-600">
                  Published by{' '}
                  {view.publisher.key ? (
                    <a
                      class="text-emerald-700 hover:underline"
                      href={`/publisher/${view.publisher.key}`}
                    >
                      {view.publisher.title}
                    </a>
                  ) : (
                    view.publisher.title
                  )}
                </p>
              )}
            </div>
          </div>

          <nav class="mt-5 -mb-px flex gap-1" aria-label="Dataset sections">
            {TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <a
                  href={tab.path(view.key)}
                  aria-current={active ? 'page' : undefined}
                  class={
                    'rounded-t-md px-4 py-2 text-sm font-medium ' +
                    (active
                      ? 'border border-b-white -mb-px bg-white text-emerald-700'
                      : 'text-gray-600 hover:text-gray-900')
                  }
                >
                  {tab.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
