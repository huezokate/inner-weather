# T-001-05 — Plan: ordered implementation steps

No test runner exists (CLAUDE.md). Verification = `npx tsc -b` clean + dev server boots + manual
reasoning against acceptance criteria. **Not a git repo** (research.md), so the "commit
incrementally" step is replaced by a `tsc -b` checkpoint after each code step; the commit note
is recorded in progress.md instead of an actual commit.

## Step 1 — Create `src/lib/classify.ts`

Write the file per structure.md:
- env reads + `classifyConfigured` + single `client` (null when unconfigured)
- `CLASSIFY_MODEL`, `SYSTEM_PROMPT`
- helpers: `clampIntensity`, `extractJsonArray`, `buildUserPrompt`, `parseScores`
- `classifyIntensity(items)` — total, batched single gateway call, defensive parse, overwrite
  matched ids only.

**Verify:** `npx tsc -b` clean (file compiles standalone; depends only on `FeedItem` type +
installed SDK). No runtime call yet since `feed.ts` doesn't import it.

**Done when:** classify.ts exists and typechecks; all paths return `FeedItem[]` and none throw.

## Step 2 — Wire it into `src/feed.ts`

- Add `import { classifyIntensity } from "./lib/classify";`.
- Replace the `TODO(loop)` classifier comment with a "now wired" note.
- In `fetchLiveFeed()`: assign the deduped/capped list to `live`, `return classifyIntensity(live)`.

**Verify:** `npx tsc -b` clean. The outer try/catch still compiles and still guards.

**Done when:** `fetchLiveFeed` returns the classified list; HERO_FEED path is untouched.

## Step 3 — Full typecheck + lint

- `npx tsc -b` → must be clean (zero errors).
- `npm run lint` (oxlint) → no new errors introduced by the two files.

**Done when:** both clean.

## Step 4 — Boot the dev server & sanity-observe

- `npm run dev`, load `localhost:5173`.
- Expected console signals (any one is acceptable, all are non-fatal):
  - Configured + gateway up → live items render; their `i{n}` badge may differ from the source
    prior (model refined it).
  - Gateway not provisioned / call fails → `console.warn("classify: gateway call failed …")` and
    live items keep their prior `i{n}`. **Feed still renders; flip still works.**
  - Keys missing → `console.info` skip note; priors stand.
- Confirm the slider still flips SHARP↔FOG (HERO_FEED un-blurs/reorders) regardless of classifier
  outcome.

**Done when:** dev boots with no runtime exception from classify; demo floor intact in all three
cases above.

## Verification matrix → acceptance criteria

| Acceptance criterion | How verified |
|---|---|
| `classify.ts` exists; live items get 1–5 model scores when keys present | Step 1 + Step 4 (configured case); clamp guarantees 1–5 |
| Hero set intensities remain hand-tagged/unchanged | Structure: HERO_FEED never passed to classifier; code review |
| Gateway unconfigured/failed → priors kept, skip noted, build passes | Steps 1–3: total fn + `console.warn/info`; `tsc -b` clean |
| Reddit + You.com lanes still populate; flip still works | Step 4 manual; classifier only edits `intensity`, not membership |
| `npx tsc -b` clean and dev server boots | Steps 3 & 4 |

## Risk / mitigation

- **Gateway not provisioned (likely).** Mitigated by design: total function, fallback to priors,
  `console.warn`. Demo unaffected. This is the *expected* path and is explicitly acceptable per
  the ticket.
- **`Promise<any>` response shape drift.** Mitigated by optional chaining
  `completion?.choices?.[0]?.message?.content` + `parseScores` guards. Bad shape → empty Map →
  priors kept.
- **Model returns prose / fenced JSON / wrong ids.** Mitigated by `extractJsonArray`, array
  guard, id-keyed Map (unknown ids ignored), clamp.
- **Second `createClient` instance.** Accepted (house idiom of per-adapter env reads); no shared
  mutable state, so no conflict with `insforge.ts`'s client.

## Rollback

Revert is trivial and isolated: delete `src/lib/classify.ts` and undo the 3-line `feed.ts` edit.
`App.tsx` and all other files are untouched, so the demo floor returns to source-prior
intensities with zero side effects.
