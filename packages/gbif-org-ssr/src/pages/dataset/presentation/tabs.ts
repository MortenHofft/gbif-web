// Tab registry. Each tab is its own Express route (like the existing gbif.org site),
// so the URL is the source of truth and tabs are plain server-rendered pages.
export type TabId = 'about' | 'dashboard';

export const TABS: Array<{ id: TabId; label: string; path: (key: string) => string }> = [
  { id: 'about', label: 'About', path: (key) => `/dataset/${key}` },
  { id: 'dashboard', label: 'Dashboard', path: (key) => `/dataset/${key}/dashboard` },
];
