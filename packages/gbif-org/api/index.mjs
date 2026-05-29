import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureApp } from '../gbif/createApp.mjs';

// On Vercel the serverless function runs with an unpredictable working directory, but the
// production app reads several files relative to the package root (dist/gbif/client,
// dist/gbif/client/gbif/index.html, public, ...). Pin the cwd to the package root so those
// reads — and Vite's loadEnv — behave exactly as they do under `npm run start` locally.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(packageRoot);

const app = express();

// configureApp is async (it can create a Vite dev server in development); in production it only
// wires synchronous middleware/routes, but we still await it once at cold start before serving.
const ready = configureApp(app, { isProduction: true });

export default async function handler(req, res) {
  await ready;
  return app(req, res);
}
