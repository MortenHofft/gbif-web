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
      className="g-prose g-max-w-none [&_a]:g-underline [&_pre]:g-bg-slate-800 [&_pre]:g-text-slate-100 [&_pre]:g-rounded [&_pre]:g-p-3 [&_pre_code]:g-bg-transparent [&_pre_code]:g-text-inherit"
      dangerouslySetInnerHTML={{ __html: renderDescriptionHtml(text) }}
    />
  );
}
