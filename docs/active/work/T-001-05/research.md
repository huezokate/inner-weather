# T-001-05 — Research: InsForge AI Intensity Classifier

Descriptive map of the codebase as it relates to replacing source-prior intensities on
live feed items with real model scores from the InsForge AI gateway.

## Ticket in one line

Build Plan Task 5. After `fetchLiveFeed()` gathers live items (Reddit + You.com), send their
titles to the InsForge AI gateway, get a 1–5 "how activating/agitating" score per item, and
overwrite each live item's `intensity` with that score. HERO_FEED stays hand-tagged. On any
failure or missing keys, keep the source-prior intensities. This is the *second* demonstration
of InsForge in the app (the first is the `diary` DB in `src/lib/insforge.ts`).

## The intensity contract

`intensity` is the spine of the whole app. `FeedItem.intensity` is `1 soothing … 5 agitating`
(`src/feed.ts:9-12`). It drives two things downstream, both in `App.tsx`:

- **Sort** (`src/App.tsx:50-54`): merged `[...HERO_FEED, ...live]` is sorted by intensity —
  descending in SHARP (`b.intensity - a.intensity`), ascending otherwise. This is the reorder
  half of the demo flip.
- **Shield** (`src/feed.ts:84-86`, called at `App.tsx:55`): `applyShield(sorted, ceiling)`
  marks `shielded: it.intensity > ceiling`. Ceilings come from `tiers.ts`: FOG=2,
  PERSEVERANCE=3, SHARP=5. This is the blur/un-blur half of the flip.

So any intensity we write must be an integer in `1..5`. A value of `0`, `6`, `NaN`, or a string
would silently corrupt both the sort order and the shield. Defensive clamping is mandatory.

## Where live items come from

`fetchLiveFeed()` (`src/feed.ts:69-81`) is the single integration point:

```
const [you, reddit] = await Promise.all([ fetchYouCom(), fetchReddit(REDDIT_LANES) ]);
return dedupe([...you, ...reddit]).slice(0, 20);
```

- Both adapters are **total** — they never reject; each returns `[]` on any failure
  (`reddit.ts:67-70`, `youcom.ts:90-102`). Failure isolation is already the house style.
- Output is deduped by `url||title` and **capped at 20 items**. So the classifier sees at most
  20 titles — a single small batch, not a per-item fan-out.
- Every live item already carries a **source-prior** intensity: Reddit from `REDDIT_LANES`
  (`feed.ts:44-51`, e.g. aww=1, unpopularopinion=5), You.com from `YOUCOM_QUERIES`
  (`youcom.ts:21-24`, calm=2, hot takes=5). These priors are the fallback the ticket refers to.
- `feed.ts:53-54` already has a `TODO(loop)` placeholder: `classifyIntensity(items) -> InsForge
  AI gateway, returns 1–5 per item`. This ticket fills exactly that hole.

`App.tsx:30` consumes it once on mount: `fetchLiveFeed().then(setLive).catch(() => {})`. The
classifier therefore runs inside the existing async chain — no new call site in App.

Live item ids are stable and unique: `reddit-{sub}-{postid}` (`reddit.ts:39`),
`you-{slug}-{i}` (`youcom.ts:57`). These ids are what we round-trip through the model so we can
map scores back to items.

## How InsForge is already wired

`src/lib/insforge.ts` is the existing InsForge integration (the `diary` table). Patterns to
mirror:

- Reads `import.meta.env.VITE_INSFORGE_BASE_URL` / `VITE_INSFORGE_ANON_KEY` (`insforge.ts:20-21`).
- `insforgeConfigured = Boolean(baseUrl && anonKey)` gate; client created **once** only when
  configured, else `null` so the network is never touched (`insforge.ts:24-27`).
- Every public method is total: try/catch around the SDK call, `console.warn` on failure, then a
  local fallback. Never throws into the caller.
- The `diary` table now exists in the backend (confirmed via backend metadata; T-001-04 created
  it). recordCount 0.

`package.json` deps: `@insforge/sdk ^1.4.3`, `react 19`, `react-dom 19`. **No `openai`
package** is installed. devDeps include `typescript ~6.0.2`, `vite ^8`, `oxlint`.

## InsForge AI gateway — what the SDK exposes

From the SDK typedefs (`@insforge/sdk/dist/client-DUmOm_3W.d.ts`):

- The client has `readonly ai: AI` (line 1083).
- `AI` → `chat: Chat` → `completions: ChatCompletions` →
  `create(params: ChatCompletionRequest): Promise<any>` (lines 578-658).
- Response is **OpenAI-shaped**: `completion.choices[0].message.content` is the text
  (documented in the SDK comments and the `fetch-sdk-docs ai` reference).
- `ChatCompletionRequest` (`@insforge/shared-schemas/.../ai-api.schema.d.ts:489`) requires
  `model: string` and `messages: [{ role: "user"|"assistant"|"system"|"tool", content }]`.
- Model ids use `provider/model` form, e.g. `openai/gpt-4o-mini`, `anthropic/claude-3.5-haiku`.

The official SDK docs (`fetch-sdk-docs ai typescript`) now steer new code toward calling
OpenRouter **directly** with a raw `OPENROUTER_API_KEY`, and explicitly **warn against putting
that key in a browser bundle**. They label `insforge.ai.chat.completions.create()` "deprecated"
but confirm it "still exists for compatibility," mapping to backend proxy routes. See design.md
for why the SDK gateway path is the right choice for a *keyless-in-browser* Vite demo.

## Constraints & assumptions

- **Demo floor is sacred** (CLAUDE.md guardrails). HERO_FEED + slider + flip must always work.
  Classifier touches live items only; on any failure live items keep their priors.
- **Browser-only app.** No backend route exists; Vite exposes only `VITE_`-prefixed vars. A raw
  OpenRouter key cannot be safely used client-side — rules out the "direct OpenRouter" path.
- **Gateway may not be provisioned.** Ticket warns we might still need `cli ai setup` / a model
  configured. Backend metadata shows no functions and gives no AI/model status, so we cannot
  assume a model is reachable — the call *must* be wrapped and the skip noted.
- **Not a git repository** (verified: `git rev-parse` fails). The RDSPI "commit incrementally"
  step cannot run; verification is `npx tsc -b` clean + dev server boots instead.
- At most ~20 titles per run → one batched request is enough; no rate-limit concern.
- `tsc -b` must stay clean: `Promise<any>` response means we own all response narrowing.
