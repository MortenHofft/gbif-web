import type { Plugin, Connect } from 'vite';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listProposals,
  findProposalDir,
  readProposal,
  writeStatus,
  ProposalStatus,
} from './proposals';
import { applyPatch, headSha, workingTreeDirty } from './git';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function readJsonBody(req: Connect.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: any, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function notFound(res: any) {
  res.statusCode = 404;
  res.end('Not found');
}

function contentTypeFor(file: string): string {
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

export function reviewApiPlugin(): Plugin {
  return {
    name: 'review-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/') && !url.startsWith('/shots/')) {
          return next();
        }

        try {
          // Serve screenshots: /shots/:proposalId/:filename
          if (url.startsWith('/shots/')) {
            const parts = url.replace(/^\/shots\//, '').split('?')[0].split('/');
            if (parts.length < 2) return notFound(res);
            const [proposalId, ...rest] = parts;
            const filename = rest.join('/');
            const dir = await findProposalDir(REPO_ROOT, proposalId);
            if (!dir) return notFound(res);
            const file = path.join(dir, filename);
            // Prevent escape
            if (!file.startsWith(dir)) return notFound(res);
            const stat = await fs.stat(file).catch(() => null);
            if (!stat?.isFile()) return notFound(res);
            res.setHeader('Content-Type', contentTypeFor(file));
            res.setHeader('Cache-Control', 'no-cache');
            createReadStream(file).pipe(res);
            return;
          }

          // GET /api/status
          if (url === '/api/status' && req.method === 'GET') {
            const [head, dirty] = await Promise.all([
              headSha(REPO_ROOT),
              workingTreeDirty(REPO_ROOT),
            ]);
            return sendJson(res, 200, { head, dirty, repoRoot: REPO_ROOT });
          }

          // GET /api/proposals
          if (url === '/api/proposals' && req.method === 'GET') {
            const proposals = await listProposals(REPO_ROOT);
            return sendJson(res, 200, proposals);
          }

          // GET /api/proposals/:id
          const detailMatch = url.match(/^\/api\/proposals\/([^/]+)$/);
          if (detailMatch && req.method === 'GET') {
            const dir = await findProposalDir(REPO_ROOT, detailMatch[1]);
            if (!dir) return notFound(res);
            const proposal = await readProposal(dir);
            return sendJson(res, 200, proposal);
          }

          // GET /api/proposals/:id/patch
          const patchMatch = url.match(/^\/api\/proposals\/([^/]+)\/patch$/);
          if (patchMatch && req.method === 'GET') {
            const dir = await findProposalDir(REPO_ROOT, patchMatch[1]);
            if (!dir) return notFound(res);
            const proposal = await readProposal(dir);
            const patchText = await fs.readFile(path.join(dir, proposal.meta.patch), 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain');
            res.end(patchText);
            return;
          }

          // POST /api/proposals/:id/approve  — apply patch, update status
          const approveMatch = url.match(/^\/api\/proposals\/([^/]+)\/approve$/);
          if (approveMatch && req.method === 'POST') {
            const dir = await findProposalDir(REPO_ROOT, approveMatch[1]);
            if (!dir) return notFound(res);
            const proposal = await readProposal(dir);
            const patchPath = path.join(dir, proposal.meta.patch);
            const result = await applyPatch(REPO_ROOT, patchPath);
            const now = new Date().toISOString();
            let status: ProposalStatus;
            if (result.ok) {
              status = {
                ...proposal.status,
                state: 'applied',
                decidedAt: now,
                appliedAt: now,
                conflict: null,
              };
            } else if ('conflictFiles' in result) {
              status = {
                ...proposal.status,
                state: 'conflicted',
                decidedAt: now,
                appliedAt: now,
                conflict: { files: result.conflictFiles, strategy: '3way' },
              };
            } else {
              return sendJson(res, 409, { error: result.error });
            }
            await writeStatus(dir, status);
            return sendJson(res, 200, { status, result });
          }

          // POST /api/proposals/:id/reject
          const rejectMatch = url.match(/^\/api\/proposals\/([^/]+)\/reject$/);
          if (rejectMatch && req.method === 'POST') {
            const dir = await findProposalDir(REPO_ROOT, rejectMatch[1]);
            if (!dir) return notFound(res);
            const proposal = await readProposal(dir);
            const body = await readJsonBody(req);
            const status: ProposalStatus = {
              ...proposal.status,
              state: 'rejected',
              decidedAt: new Date().toISOString(),
              notes: body.notes || proposal.status.notes,
            };
            await writeStatus(dir, status);
            return sendJson(res, 200, { status });
          }

          // POST /api/proposals/:id/regenerate  — mark superseded
          const regenMatch = url.match(/^\/api\/proposals\/([^/]+)\/regenerate$/);
          if (regenMatch && req.method === 'POST') {
            const dir = await findProposalDir(REPO_ROOT, regenMatch[1]);
            if (!dir) return notFound(res);
            const proposal = await readProposal(dir);
            const body = await readJsonBody(req);
            const status: ProposalStatus = {
              ...proposal.status,
              state: 'superseded',
              decidedAt: new Date().toISOString(),
              notes: body.notes || proposal.status.notes,
            };
            await writeStatus(dir, status);
            return sendJson(res, 200, { status });
          }

          // POST /api/proposals/:id/reset  — set back to pending (lets you retry)
          const resetMatch = url.match(/^\/api\/proposals\/([^/]+)\/reset$/);
          if (resetMatch && req.method === 'POST') {
            const dir = await findProposalDir(REPO_ROOT, resetMatch[1]);
            if (!dir) return notFound(res);
            const proposal = await readProposal(dir);
            const status: ProposalStatus = {
              ...proposal.status,
              state: 'pending',
              decidedAt: null,
              appliedAt: null,
              conflict: null,
            };
            await writeStatus(dir, status);
            return sendJson(res, 200, { status });
          }

          return notFound(res);
        } catch (e: any) {
          console.error('[review-api]', e);
          sendJson(res, 500, { error: e?.message || String(e) });
        }
      });
    },
  };
}
