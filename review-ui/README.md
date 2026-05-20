# review-ui

A local admin tool for reviewing proposed changes to the website.

## What it does

You ask Claude to work on something (e.g. "tighten the touch targets in the nav").
Claude makes the change, runs Playwright to capture before/after screenshots,
saves the change as a patch under `.review/proposals/`, and **reverts** the
working tree so the change is queued for your review rather than already applied.

This UI lets you walk through that queue and decide on each proposal:

- **Approve & apply** — `git apply --3way` writes the change to your working tree (no commit). Review with HMR, commit when satisfied.
- **Reject** — marks the proposal rejected; the patch stays on disk for audit.
- **Mark superseded** — when you want Claude to redo the proposal against current HEAD.
- **Reset to pending** — undo a previous decision and re-evaluate.

If `--3way` leaves conflict markers, the proposal is marked `conflicted` and the
UI shows you which files to fix in your editor.

## Run it

```bash
cd review-ui
npm install
npm run dev
```

Then open <http://localhost:5180>. The Vite plugin in `server/plugin.ts`
exposes the backend at `/api/*` on the same port. There is no separate server
process to start.

## Keyboard shortcuts

| Key | Action               |
| --- | -------------------- |
| `j` | Next proposal        |
| `k` | Previous proposal    |
| `a` | Approve & apply      |
| `r` | Reject               |
| `g` | Mark superseded      |

(Shortcuts are inert while focus is in an input or textarea.)

## How proposals are structured

Each proposal is a directory under `.review/proposals/`. See
[`.review/README.md`](../.review/README.md) for the full schema — that file is
the instruction set you hand to Claude when asking it to produce proposals.

## Architecture

- **Frontend** — React + TypeScript + Vite (`src/`).
- **Backend** — a Vite middleware plugin (`server/plugin.ts`) that reads
  proposals off disk and shells out to `git` for patch operations. The
  filesystem is the database; there is no other state.
- **Repo root** is resolved as `..` from `review-ui/`. The plugin doesn't
  walk upward to find a git root, so don't move `review-ui/` elsewhere
  without updating that path in `server/plugin.ts`.

## API

| Method | Path                                  | Notes                                                                                |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/api/status`                         | HEAD sha, list of dirty paths                                                        |
| GET    | `/api/proposals`                      | All proposals (meta + status)                                                        |
| GET    | `/api/proposals/:id`                  | One proposal                                                                         |
| GET    | `/api/proposals/:id/patch`            | Raw unified diff                                                                     |
| POST   | `/api/proposals/:id/approve`          | Apply via `git apply --3way`. On conflict, state becomes `conflicted`, files listed. |
| POST   | `/api/proposals/:id/reject`           | Mark rejected. Optional `{ "notes": "..." }`                                         |
| POST   | `/api/proposals/:id/regenerate`       | Mark superseded                                                                      |
| POST   | `/api/proposals/:id/reset`            | Reset to `pending`                                                                   |
| GET    | `/shots/:proposalId/shots/foo.png`    | Static screenshot serving                                                            |

## Gitignore note

By default `.review/` is **not** ignored — proposals are committed alongside
the repo so the review queue is shareable / reviewable in PRs. If you prefer
they stay local, add `.review/` to `.gitignore`. Screenshots can get large;
consider Git LFS if you keep them tracked and they grow.
