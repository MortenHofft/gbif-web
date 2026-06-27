// Vercel serverless entry. The Express app is a valid (req, res) handler, so Vercel
// can use it directly. The app is pre-bundled to dist/server.mjs by `npm run build`
// (which Vercel runs via buildCommand) to avoid relying on Vercel's TS/JSX handling.
export { default } from '../dist/server.mjs';
