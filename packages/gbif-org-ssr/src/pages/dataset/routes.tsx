import { Router, type Request, type Response } from 'express';
import { renderDocument, type IslandMount } from '../../lib/html';
import { loadDataset } from './loader';
import { toDatasetView, type DatasetView } from './transform';
import { DatasetLayout } from './presentation/DatasetLayout';
import { AboutTab } from './presentation/AboutTab';
import { DashboardTab, dashboardIslandProps } from './presentation/DashboardTab';
import type { TabId } from './presentation/tabs';
import type { VNode } from 'preact';

export const datasetRouter = Router();

// One place to run the loader → transform pipeline, then hand the view model to a
// tab renderer. Keeps every route handler down to "describe this tab".
async function renderTab(
  req: Request,
  res: Response,
  activeTab: TabId,
  renderContent: (view: DatasetView) => { content: VNode; islands?: IslandMount[] }
) {
  const key = req.params.key as string;
  const result = await loadDataset(key, AbortSignal.timeout(15_000));

  if (result.status === 'notFound') {
    res.status(404).type('html').send('<h1>Dataset not found</h1>');
    return;
  }
  if (result.status === 'error') {
    res.status(502).type('html').send('<h1>Failed to load dataset</h1>');
    return;
  }

  const view = toDatasetView(result.dataset);
  const { content, islands } = renderContent(view);

  res.set('Cache-Control', 'public, max-age=600, must-revalidate');
  res.type('html').send(
    renderDocument({
      title: `${view.title} — GBIF`,
      description: view.descriptionHtml ? undefined : view.typeLabel,
      islands,
      body: (
        <DatasetLayout view={view} activeTab={activeTab}>
          {content}
        </DatasetLayout>
      ),
    })
  );
}

// /dataset/:key  → About tab (default)
datasetRouter.get('/:key', (req, res) =>
  renderTab(req, res, 'about', (view) => ({ content: <AboutTab view={view} /> }))
);

// /dataset/:key/dashboard → Dashboard tab (charts via client island)
datasetRouter.get('/:key/dashboard', (req, res) =>
  renderTab(req, res, 'dashboard', (view) => ({
    content: <DashboardTab view={view} />,
    islands: [{ name: 'dashboard-charts', props: dashboardIslandProps(view) }],
  }))
);
