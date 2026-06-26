// TRANSFORMATION + LOGIC — pure, presentation-free, unit-testable. Turns the raw
// GraphQL shape into a view model the Preact components render verbatim (no data
// massaging in the components).
import type { RawDataset } from './query';

export type DatasetView = {
  key: string;
  title: string;
  type: string;
  typeLabel: string;
  isChecklist: boolean;
  publisher: { key: string | null; title: string | null };
  descriptionHtml: string | null;
  purpose: string | null;
  homepage: string | null;
  logoUrl: string | null;
  license: string | null;
  licenseLabel: string | null;
  createdLabel: string | null;
  geographicCoverageCount: number;
  taxonomicCoverageCount: number;
};

const TYPE_LABELS: Record<string, string> = {
  OCCURRENCE: 'Occurrence dataset',
  CHECKLIST: 'Checklist dataset',
  SAMPLING_EVENT: 'Sampling-event dataset',
  METADATA: 'Metadata-only dataset',
};

const dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'long' });

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dateFmt.format(d);
}

function licenseLabel(url: string | null): string | null {
  if (!url) return null;
  const m = /creativecommons\.org\/(?:licenses|publicdomain)\/([a-z0-9-]+)/i.exec(url);
  if (m && m[1]) return m[1].toUpperCase().startsWith('ZERO') ? 'CC0' : `CC ${m[1].toUpperCase()}`;
  return url;
}

// Minimal HTML hardening for publisher-supplied description. NOT a full sanitizer —
// strips script/style/iframe and inline event handlers so the slice can render the
// rich text safely. TODO: replace with isomorphic-dompurify (already a dep in gbif-org).
function sanitizeHtml(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<\s*(script|style|iframe)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
}

export function toDatasetView(d: RawDataset): DatasetView {
  return {
    key: d.key,
    title: d.title,
    type: d.type,
    typeLabel: TYPE_LABELS[d.type] ?? d.type,
    isChecklist: d.type === 'CHECKLIST',
    publisher: { key: d.publishingOrganizationKey, title: d.publishingOrganizationTitle },
    descriptionHtml: sanitizeHtml(d.description),
    purpose: d.purpose,
    homepage: d.homepage,
    logoUrl: d.logoUrl,
    license: d.license,
    licenseLabel: licenseLabel(d.license),
    createdLabel: formatDate(d.created),
    geographicCoverageCount: d.geographicCoverages?.length ?? 0,
    taxonomicCoverageCount: d.taxonomicCoverages?.length ?? 0,
  };
}
