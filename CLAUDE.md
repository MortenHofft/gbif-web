# gbif-web

Monorepo (Lerna) for GBIF web code. Packages live in `packages/`:

- `gbif-org` – GBIF.org and hosted portals (Vite, React, SSR). Dev: `npm run develop`.
- `graphql-api` – GraphQL layer over the GBIF REST and Elasticsearch APIs. Dev: `npm run develop`, tests: `npm test`.
- `es-api` – Elasticsearch API wrapper. Needs the GBIF VPN. Dev: `npm start`.
- `react-components` – legacy component library, being deprecated.

Node version is set per package in `.nvmrc` (24.x). Each package needs an `.env`; the canonical config lives in
`gbif-configuration/gbif-web`.

## Conventions

- Prettier + ESLint, 2-space indent, 120 char lines.
- Commits are authored by Morten Høfft. No AI attribution anywhere in commits, PRs or comments.
- This file and `.claude/` come from the `ai-config` branch and are gitignored. Never `git add -f` them.
