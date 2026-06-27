// Local / Node-host entry: start a long-running HTTP server.
// (On Vercel the app is used as a serverless handler instead — see api/index.js.)
import app from './app';
import { config } from './lib/config';

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`gbif-org-ssr listening on http://localhost:${config.port}`);
});
