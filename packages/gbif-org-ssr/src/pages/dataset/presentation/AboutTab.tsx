import type { DatasetView } from '../transform';

// Pure presentation — receives the view model, renders markup. No data fetching here.
export function AboutTab({ view }: { view: DatasetView }) {
  return (
    <div class="space-y-8">
      <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Fact label="Created" value={view.createdLabel} />
        <Fact label="License" value={view.licenseLabel} href={view.license} />
        <Fact
          label="Homepage"
          value={view.homepage ? 'Publisher site' : null}
          href={view.homepage}
        />
        <Fact label="Geographic coverages" value={String(view.geographicCoverageCount)} />
        <Fact label="Taxonomic coverages" value={String(view.taxonomicCoverageCount)} />
      </dl>

      {view.descriptionHtml && (
        <section>
          <h2 class="mb-2 text-lg font-semibold">Description</h2>
          {/* Sanitized in transform.ts (TODO: dompurify). */}
          <div
            class="prose prose-sm max-w-none text-gray-800 [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: view.descriptionHtml }}
          />
        </section>
      )}

      {view.purpose && (
        <section>
          <h2 class="mb-2 text-lg font-semibold">Purpose</h2>
          <p class="text-gray-800">{view.purpose}</p>
        </section>
      )}
    </div>
  );
}

function Fact({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string | null;
}) {
  if (!value) return null;
  return (
    <div class="rounded-lg border bg-white p-4">
      <dt class="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd class="mt-1 text-sm font-medium">
        {href ? (
          <a class="text-emerald-700 hover:underline" href={href} rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
