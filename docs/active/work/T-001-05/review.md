# T-001-05 — Review

Handoff summary for the InsForge AI intensity classifier. Read this instead of the diff.

## What changed

| File | Change | Lines |
|---|---|---|
| `src/lib/classify.ts` | **Created.** InsForge AI-gateway intensity classifier. | ~120 |
| `src/feed.ts` | **Edited.** Import + call `classifyIntensity(live)` in `fetchLiveFeed`; replaced `TODO(loop)` comment. | ~4 |

No deletions. No new dependencies. No `.env` changes. `App.tsx`, `tiers.ts`, `sources/*`,
`lib/insforge.ts` untouched.

## How it works

`fetchLiveFeed()` gathers Reddit + You.com items, dedupes, caps at 20, then passes them through
`classifyIntensity`. That function sends every live title (as `{id,title}`) in **one** batched
call to the InsForge AI gateway (`client.ai.chat.completions.create`, model
`openai/gpt-4o-mini`, temperature 0), asks for `[{id,intensity}]`, and overwrites each matched
item's `intensity` with the clamped 1–5 model score. Scores flow unchanged into the existing
`App.tsx` sort + `applyShield` — the flip demo needs no edit.

## Design choices worth knowing

- **SDK gateway, not raw OpenRouter.** This is a browser-only Vite app; the SDK docs warn never
  to ship `OPENROUTER_API_KEY` in a bundle. The gateway path authenticates with the public anon
  key (already in the bundle for the diary DB) and keeps the OpenRouter key server-side. The SDK
  labels this path "deprecated but supported"; it is the only browser-safe, dependency-free
  option. Isolated behind one function, so moving to a backend edge function later is a one-file
  change. (design.md, Decision 1.)
- **Total function.** Missing keys, unprovisioned gateway, failed call, prose/fenced/malformed
  JSON, or unknown ids all resolve to "return items unchanged" with a `console.info`/`console
  .warn`. It never throws, so `fetchLiveFeed`'s outer try/catch is just a backstop and the demo
  floor is structurally safe.
- **Id round-trip + clamp.** Scores are keyed by item id (order-independent, ignores
  hallucinated ids); every written intensity is `Math.round`+clamped to `[1,5]`, preserving the
  invariant the sort and shield depend on.

## Acceptance criteria

| Criterion | Status | Evidence |
|---|---|---|
| `classify.ts` exists; live items get 1–5 model scores when keys present | ✅ | File created; `parseScores`→`clampIntensity` guarantees integer 1–5. |
| Hero set intensities remain hand-tagged/unchanged | ✅ | `classifyIntensity` only ever receives the live list; `HERO_FEED` is never passed in. |
| Gateway unconfigured/failed → priors kept, skip noted, build passes | ✅ | `null` client + try/catch + `console.warn`/`info`; `tsc -b` exit 0. |
| Reddit + You.com lanes still populate; flip still works | ✅ | Classifier edits only `intensity`, never membership; App sort/shield unchanged. |
| `npx tsc -b` clean and dev server boots | ✅ | `tsc -b` exit 0; `vite` ready 112ms; `curl localhost:5173` → 200. |

## Verification performed

- `npx tsc -b` → exit 0 (clean).
- `npm run lint` (oxlint) → exit 0.
- `npm run dev` → Vite ready, HTTP 200 on `/`. No runtime exception from classify on boot.

No automated tests exist in this project (CLAUDE.md: "There is no test runner"); verification is
typecheck + lint + boot, per house policy.

## Test-coverage gaps (honest)

- **No live-gateway assertion.** I could not confirm a model is actually provisioned on this
  InsForge project (the ticket itself warns `cli ai setup` may still be needed; backend metadata
  exposes no AI/model status). The configured-but-working path was therefore **not** exercised
  end-to-end — only verified by code review + type safety. The fallback path (the more important
  one for demo safety) is fully covered by the totality of the function.
- **`parseScores` robustness is unit-reasoned, not unit-tested.** No test runner to assert
  fence-stripping / clamp / unknown-id behavior. Logic is small and defensive; worst case is
  "keep priors," which is safe.

## Open concerns / follow-ups (non-blocking)

1. **Confirm the gateway model at demo time.** If a model is configured, watch the console: live
   `i{n}` badges shifting away from the source priors confirms real scoring. If not, the warn
   fires and priors stand — still a valid demo, but it does not *show* the AI gateway live. If
   showing it live matters, run `cli ai setup` and confirm `openai/gpt-4o-mini` (or swap
   `CLASSIFY_MODEL`).
2. **Deprecated SDK path.** `client.ai.chat.completions.create` is the compatibility proxy. If
   InsForge ever removes it, migrate to an edge function that fronts OpenRouter — the isolation
   in `classify.ts` makes this a single-file swap.
3. **No git repo.** Could not commit (`git rev-parse` fails). Intended message recorded in
   progress.md. A human should `git init` / commit per the CLAUDE.md after-each-ticket rule.
4. **Second `createClient`.** `classify.ts` makes its own client rather than sharing
   `insforge.ts`'s. Intentional (per-adapter env-read idiom); harmless, but a future refactor
   could export one shared client if more AI features land.

## Risk assessment

Low. The change is additive and isolated; the worst runtime outcome is "live items keep the
intensities they already had," which is exactly today's behavior. The demo floor (HERO_FEED +
slider + flip) cannot be affected because the classifier never sees HERO_FEED and never throws.
