import { PaginationFooter } from 'new-gbif-org-ts';

// The page-number footer under occurrence/dataset/publisher search result
// tables (see src/routes/dataset/search/datasetSearch.tsx).
export const FirstPage = () => (
  <PaginationFooter offset={0} limit={20} count={307616900} onChange={() => {}} />
);

export const MiddlePage = () => (
  <PaginationFooter offset={480} limit={20} count={307616900} onChange={() => {}} />
);

export const LastPage = () => (
  <PaginationFooter offset={60} limit={20} count={80} onChange={() => {}} />
);

export const FewPages = () => (
  <PaginationFooter offset={20} limit={20} count={60} onChange={() => {}} />
);
