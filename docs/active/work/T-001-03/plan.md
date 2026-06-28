# T-001-03 · Plan — youcom-live-lane

Ordered, independently verifiable steps. No git in this repo, so "commit" = a clean
`npx tsc -b` checkpoint. Each step lists its verification.

## Step 1 — Add the `/youcom` Vite dev proxy

**File:** `vite.config.ts`
**Change:** add a third `proxy` entry beside `/reddit` and `/oura`:

```ts
'/youcom': {
  target: 'https://ydc-index.io',
  changeOrigin: true,
  rewrite: (p) => p.replace(/^\/youcom/, ''),
},
```

**Why first:** the adapter's dev path (`/youcom/v1/search`) only resolves once this exists.
**Verify:** `npx tsc -b` clean (config is typed via `@types/node`). Proxy reachability is
confirmed end-to-end in Step 4.

## Step 2 — Create `src/sources/youcom.ts`

**File:** `src/sources/youcom.ts` (new), per Structure.
**Contents:**
- House-style header comment (provenance, key, error isolation, demo-floor promise).
- `type-only` import of `FeedItem` from `../feed`.
- `YouComQuery` interface + exported `YOUCOM_QUERIES` (calm prior 2 / trending prior 5).
- `YOUCOM_BASE` (dev → `/youcom`, build → `https://ydc-index.io`).
- `RawYouComResult` + `YouComResponse` interfaces (no `any`).
- Helpers: `isImageUrl`, `slug`, `toFeedItem`.
- `fetchQuery(q, key)` — one query, `X-API-Key` header, try/catch → `[]`.
- `fetchYouCom()` — empty-key guard → `[]`; `Promise.allSettled` over the two queries;
  flatMap fulfilled; outer try/catch → `[]`.

**Verify:** `npx tsc -b` clean (file typechecks standalone — it's not yet imported, so this
proves the adapter compiles in isolation). `npm run lint` clean.

## Step 3 — Merge into `fetchLiveFeed()`

**File:** `src/feed.ts`
**Changes:**
1. `import { fetchYouCom } from "./sources/youcom";` beside the Reddit import.
2. Remove the stale `fetchYouCom(...)` line from the `TODO(loop)` block (keep
   `classifyIntensity`).
3. Replace `fetchLiveFeed()` body with the `Promise.all([fetchYouCom(), fetchReddit(...)])`
   → `dedupe([...you, ...reddit]).slice(0, 20)` version (You.com first; outer try/catch → `[]`).

**Verify:** `npx tsc -b` clean. `npm run lint` clean. Confirms the wiring typechecks and the
Reddit path is preserved.

## Step 4 — Live + behavioral verification

1. **Endpoint sanity (already done in Research):** `curl` of `ydc-index.io/v1/search` with the
   key returned HTTP 200 + `results.web[]`. Re-probe if needed.
2. **Dev boot:** `npm run dev`; confirm the server starts and `GET /` → 200.
3. **Proxy path:** `curl` the dev server's `/youcom/v1/search?...` with `X-API-Key` and
   confirm it returns the You.com JSON (proves Step 1's proxy forwards correctly).
4. **Feed presence:** confirm `you.com`-sourced cards appear in the rendered feed (meta line
   `i2 · you.com` / `i5 · you.com`).
5. **Shield/flip:** in FOG (default score 61) the trending (`i5`) You.com card is shielded;
   click "What if I were Sharp?" → it un-blurs and reorders toward the top. The calm (`i2`)
   card is visible in every tier.
6. **Fallback proof:** temporarily blanking the key (or an offline run) yields `[]` from the
   lane with no uncaught error — HERO_FEED + Reddit + flip still render.

## Step 5 — Final gate + artifacts

- `npx tsc -b` → exit 0.
- `npm run lint` → clean.
- Write `progress.md` (during Implement) and `review.md` (Review phase).
- Run summary must call out: **key exposure** (VITE_ key in bundle → needs a proxy/serverless
  hop for any public deploy) and **prod transport** (no dev proxy in a real build → CORS wall,
  demo is dev-served).

## Testing strategy

- **No unit tests** — project has no test runner (CLAUDE.md). Pure helpers (`isImageUrl`,
  `slug`, `toFeedItem`) are unit-testable and would be first candidates if a runner is added.
- **Integration = manual:** typecheck + lint + dev boot + live proxy probe + visual feed/flip
  check + fallback check (Step 4).
- **Verification criteria (= Acceptance Criteria):**
  - `youcom.ts` exists; both queries run behind try/catch. *(Step 2)*
  - Real web results labeled `you.com`, shielded by tier. *(Step 4.4–4.5)*
  - Reddit lane still works; dedupe + cap hold. *(Step 3 preserves; Step 4.4)*
  - Missing key / failure falls back cleanly; HERO_FEED + flip work. *(Step 4.6)*
  - `npx tsc -b` clean; dev boots. *(Steps 1–4)*

## Risk & rollback

Low risk — every change is additive or guarded. `fetchYouCom` is total; the `fetchLiveFeed`
outer try/catch is preserved; `App.tsx`/`FeedItem`/`tiers.ts` untouched. Rollback = revert the
three files; the demo floor is unaffected throughout.

## Step order rationale

Proxy → adapter → merge → verify. Each step typechecks on its own, so a failure is localized.
The adapter is built and compiled before it's wired in, keeping the Reddit pipeline green until
the final merge.
