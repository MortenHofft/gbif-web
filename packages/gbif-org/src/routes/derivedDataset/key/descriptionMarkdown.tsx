import { marked } from 'marked';
import pkg from 'isomorphic-dompurify';
const DOMPurify = pkg;

// Descriptions are user supplied, so we only allow a small set of markdown-generated tags and the href attribute
const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    'a',
    'p',
    'br',
    'strong',
    'em',
    'del',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
  ],
  ALLOWED_ATTR: ['href'],
  ALLOW_DATA_ATTR: false,
};

// Force every link to open in a new tab without giving the target page access to the opener
function addLinkAttributes(node: Element) {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
}

export function renderDescriptionHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  DOMPurify.addHook('afterSanitizeAttributes', addLinkAttributes);
  try {
    return DOMPurify.sanitize(html, SANITIZE_OPTIONS);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes');
  }
}

export function DescriptionMarkdown({ text }: { text: string }) {
  return (
    <div
      className="g-break-all g-bg-slate-100 g-p-2 g-rounded g-font-[monospace] [&_a]:g-underline [&_p:not(:last-child)]:g-mb-2 [&_ul]:g-list-disc [&_ol]:g-list-decimal [&_ul]:g-ps-5 [&_ol]:g-ps-5 [&_code]:g-bg-slate-200 [&_code]:g-rounded [&_code]:g-px-1 [&_pre]:g-bg-slate-800 [&_pre]:g-text-slate-100 [&_pre]:g-rounded [&_pre]:g-p-3 [&_pre]:g-overflow-x-auto [&_pre_code]:g-bg-transparent [&_pre_code]:g-p-0 [&_pre_code]:g-text-inherit"
      dangerouslySetInnerHTML={{ __html: renderDescriptionHtml(text) }}
    />
  );
}
