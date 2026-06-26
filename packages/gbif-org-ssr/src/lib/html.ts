import { renderToString } from 'preact-render-to-string';
import type { VNode } from 'preact';
import { config } from './config';

// A request to mount a client island on the page. `name` matches both the built
// bundle (/islands/<name>.js) and the placeholder element (data-island="<name>").
export type IslandMount = { name: string; props?: unknown };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// JSON embedded in <script> must not contain a literal `</script>` or a `<!--`,
// so escape `<` — standard safe-JSON-in-HTML handling.
function safeJson(value: unknown): string {
  return JSON.stringify(value ?? {}).replace(/</g, '\\u003c');
}

// Renders a complete HTML document: the server-rendered body, the Tailwind stylesheet,
// a small client-config global, and one <script type=module> per requested island.
export function renderDocument(opts: {
  title: string;
  description?: string;
  body: VNode;
  islands?: IslandMount[];
}): string {
  const bodyHtml = renderToString(opts.body);

  const islandTags = (opts.islands ?? [])
    .map(
      (i) => `
    <script type="application/json" id="island-props-${i.name}">${safeJson(i.props)}</script>
    <script type="module" src="/islands/${i.name}.js"></script>`
    )
    .join('');

  const clientConfig = safeJson({ graphqlEndpoint: config.graphqlEndpointClient });

  return `<!doctype html>
<html lang="${config.defaultLocale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(opts.title)}</title>
    ${opts.description ? `<meta name="description" content="${escapeHtml(opts.description)}" />` : ''}
    <link rel="stylesheet" href="/app.css" />
    <script>window.__GBIF__ = ${clientConfig};</script>
  </head>
  <body class="bg-gray-50 text-gray-900">
    <div id="app">${bodyHtml}</div>${islandTags}
  </body>
</html>`;
}
