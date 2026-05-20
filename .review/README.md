# Producing review proposals

This document is the contract between the human reviewer and the LLM
(Claude) producing changes. When you (the LLM) are asked to work on a
section of the site under this workflow, **do not commit or leave the
change applied**. Instead, package it as a proposal under
`.review/proposals/<id>/`, revert the working tree, and stop.

The reviewer then walks the queue in the `review-ui` admin tool and
either approves (which applies the patch to the working tree) or
rejects.

## Workflow for a single proposal

For each atomic change the user asks for:

1. **Confirm scope.** One proposal = one focused change. Prefer touching
   a single folder. If the request spans multiple concerns, split it
   into multiple proposals with separate ids.

2. **Capture base.** Record current HEAD sha — you'll need it for
   `meta.json` and for any later regeneration.

3. **Decide screenshots.** Pick the pages, viewports, and interactive
   states that demonstrate the change. Common patterns:
   - Homepage / desktop (1440×900)
   - Homepage / mobile (375×812)
   - The specific page or component being changed, at each viewport
     that matters
   - Any interactive state worth showing (drawer open, modal open,
     hover, focus, error state)

4. **Capture "before" screenshots.** Make sure the dev server is
   running. For each shot, navigate to the URL, set viewport, run the
   optional setup step (e.g. click the nav toggle), and save the PNG
   to `.review/proposals/<id>/shots/<shotId>.before.png`.

5. **Make the change.** Edit the code. Keep the diff minimal and
   focused on the requested scope. Don't drag in unrelated cleanup.

6. **Wait for HMR** to update the running app, then capture **"after"
   screenshots** at the same shot ids → `<shotId>.after.png`.

7. **Diff the working tree** with `git diff --no-color > change.patch`
   and save it as `.review/proposals/<id>/change.patch`.

8. **Write `meta.json`** following the schema below.

9. **Write `status.json`** with state `pending`.

10. **Revert the working tree** with `git restore .` (or equivalent —
    do NOT touch `.review/`). Confirm `git status` shows only the new
    `.review/proposals/<id>/` directory.

11. **Stop.** Tell the reviewer the proposal id is ready.

If the user asks for several changes, repeat the loop for each one,
incrementing the numeric prefix in the id.

## Directory layout

```
.review/proposals/
  001-touch-target-nav-button/
    change.patch              # output of `git diff --no-color`
    meta.json                 # written once; immutable
    status.json               # mutable; reviewer-controlled
    shots/
      homepage-mobile.before.png
      homepage-mobile.after.png
      homepage-desktop.before.png
      homepage-desktop.after.png
```

## ID convention

`NNN-kebab-case-summary`

- `NNN` is a zero-padded sequence number, incrementing across all
  proposals in the repo regardless of state.
- The summary is short, lowercase, hyphen-separated. Aim for under
  40 characters total.
- The directory name **must equal** the `id` field in `meta.json`.

## `meta.json` schema

Immutable once written. Reviewer never edits this.

```json
{
  "id": "001-touch-target-nav-button",
  "title": "Increase tap target for primary nav button",
  "rationale": "The mobile nav button is currently 32px, below the WCAG 2.5.5 (AAA) recommendation of 44px. This raises it to 48px and adjusts horizontal padding to preserve visual proportions. No behavioural change.",
  "createdAt": "2026-05-20T10:30:00Z",
  "author": "claude",
  "baseSha": "abc123def456...",
  "baseBranch": "main",
  "tags": ["a11y", "mobile", "nav"],
  "patch": "change.patch",
  "files": [
    { "path": "packages/gbif-org/src/components/nav/NavButton.tsx", "additions": 4, "deletions": 2 },
    { "path": "packages/gbif-org/src/components/nav/NavButton.module.css", "additions": 6, "deletions": 3 }
  ],
  "shots": [
    {
      "id": "homepage-mobile",
      "label": "Homepage — Mobile",
      "url": "/",
      "viewport": { "width": 375, "height": 812 },
      "setup": null,
      "before": "shots/homepage-mobile.before.png",
      "after": "shots/homepage-mobile.after.png"
    },
    {
      "id": "search-mobile-nav-open",
      "label": "Search — Mobile, nav drawer open",
      "url": "/search",
      "viewport": { "width": 375, "height": 812 },
      "setup": "click [data-testid=nav-toggle]",
      "before": "shots/search-mobile-nav-open.before.png",
      "after": "shots/search-mobile-nav-open.after.png"
    }
  ]
}
```

### Field guide

- **`title`** — one line. What the change does, not why.
- **`rationale`** — 1–4 sentences. The "why." Include any constraints
  or trade-offs the reviewer needs to weigh.
- **`createdAt`** — ISO 8601 UTC.
- **`baseSha` / `baseBranch`** — output of `git rev-parse HEAD` and
  `git rev-parse --abbrev-ref HEAD` at the moment the patch was
  generated. The reviewer uses `baseSha` to know how stale the
  proposal might be.
- **`tags`** — short keywords. Useful ones: `a11y`, `perf`, `bug`,
  `polish`, `mobile`, `i18n`, `docs`, plus an area tag like `nav`,
  `search`, `occurrence`.
- **`patch`** — almost always `"change.patch"`. The field exists so
  the UI doesn't assume the filename.
- **`files`** — duplicate of what's in the patch, hoisted out so the
  list view can filter by path without parsing every diff. Counts are
  per-file added/deleted line counts (the right column of
  `git diff --stat`). **Keep this in sync with the patch.**
- **`shots`** — array. May be empty for code-only changes (e.g. a
  comment fix, a non-rendering refactor) but try to include at least
  one shot whenever the change affects rendered output.
- **`shot.id`** — kebab-case, unique within the proposal.
- **`shot.label`** — human-readable, shown above the screenshot pair.
- **`shot.url`** — path on the dev server.
- **`shot.viewport`** — width/height in CSS pixels.
- **`shot.setup`** — optional. Freeform string describing what was
  done before capture (e.g. `click [data-testid=nav-toggle]`, or
  `scroll to footer`). For now this is documentation only; the UI
  shows it to the reviewer and you replay it by hand on regeneration.
- **`shot.before` / `shot.after`** — paths **relative to the proposal
  directory**.

## `status.json` schema

Mutable. Initial value:

```json
{
  "state": "pending",
  "decidedAt": null,
  "appliedAt": null,
  "conflict": null,
  "notes": ""
}
```

The reviewer (via the UI) transitions `state` through:

| State         | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `pending`     | Awaiting review                                                    |
| `applied`     | Patch was applied to the working tree (not committed)              |
| `conflicted`  | 3-way apply left conflict markers — files listed in `conflict`     |
| `rejected`    | Reviewer declined                                                  |
| `superseded`  | Reviewer asked for a regeneration against current HEAD             |
| `approved`    | Reserved — currently the UI goes straight from `pending` → `applied` |

**You do not write to `status.json` after the initial pending entry.**
The UI owns it from that point on.

## Regeneration

If a proposal is marked `superseded`, the user will typically ask you
to redo it. When you do:

1. Pick a new numeric id (do **not** reuse the old one).
2. Reference the superseded proposal in `rationale` if helpful for
   audit (e.g. "Supersedes 001 — rebased onto current HEAD after the
   nav refactor.").
3. Re-capture screenshots from scratch against current code.
4. Otherwise follow the normal workflow.

The superseded directory stays in place as an audit trail.

## Patch hygiene

- Use `git diff --no-color`. Do not pipe through any post-processor.
- The patch must apply with `git apply --3way` from the repo root.
- If you find yourself editing the patch by hand, stop and regenerate
  it from a clean working tree instead — hand-edited patches are a
  reliable source of "looks fine but won't apply" bugs.
- Don't include changes to `.review/` itself in the patch. The patch
  is supposed to represent the website change only.

## Splitting proposals

If a single user request would touch unrelated concerns (e.g. "make
the nav buttons bigger and also fix the broken footer link"), split
it into separate proposals with consecutive ids. The reviewer can
then approve or reject each independently. Cohesive multi-file
changes that share a single rationale (e.g. component + its stylesheet
+ its story) stay in one proposal.

## Common mistakes to avoid

- ❌ Leaving the change applied to the working tree.
- ❌ Committing the change.
- ❌ Forgetting to revert before stopping (`git status` should show
  only the new `.review/proposals/<id>/` files).
- ❌ Including unrelated drive-by edits in the patch.
- ❌ `files` count out of sync with the actual patch.
- ❌ Screenshots taken at different viewports for before vs after.
- ❌ Reusing a shot id across multiple shots in the same proposal.
- ❌ Editing an existing proposal in place. If the change is wrong,
  the reviewer rejects or marks superseded; you make a new proposal.
