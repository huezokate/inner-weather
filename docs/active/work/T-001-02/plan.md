# T-001-02 · Plan — reddit-live-feed

Ordered, independently-verifiable steps. No git repo in this workspace, so "commit
incrementally" becomes "land each step and keep `npx tsc -b` clean between them"; the
commit-message line is noted per step for when this lands in a repo.

## Step 1 — Vite dev proxy for Reddit

- Edit `vite.config.ts`: add `server.proxy["/reddit"]` → `https://www.reddit.com` with
  `changeOrigin`, `rewrite` stripping `/reddit`, and a `User-Agent` header.
- **Verify:** `npx tsc -b` clean (config is typed via `@types/node`). Restart dev server;
  `curl -s 'http://localhost:5173/reddit/r/aww/hot.json?limit=1'` returns Reddit JSON, not
  a CORS/403 error.
- **Commit msg:** `T-001-02: add Reddit dev proxy to vite config`

## Step 2 — Add `thumbnail?` to `FeedItem`

- Edit `src/feed.ts`: add `thumbnail?: string;` to the interface (after `url?`).
- **Verify:** `npx tsc -b` clean. No behavior change; HERO_FEED + flip unaffected.
- **Commit msg:** `T-001-02: add optional thumbnail field to FeedItem`

## Step 3 — Create the Reddit adapter

- Create `src/sources/reddit.ts` with: `RedditLane`, `RawRedditPost`, `RedditListing`
  types; `REDDIT_BASE` dev/prod switch; `isImageUrl`; `toFeedItem`; `fetchLane`;
  `fetchReddit`. Type-only import of `FeedItem` from `../feed`.
- Per-lane try/catch returns `[]`; `fetchReddit` uses `Promise.allSettled`.
- Filters: `kind === "t3"`, drop `over_18`, `stickied`, empty title.
- **Verify:** `npx tsc -b` clean (strict — fully typed over the JSON, no implicit `any`).
- **Commit msg:** `T-001-02: add reddit source adapter`

## Step 4 — Wire `fetchLiveFeed()`

- Edit `src/feed.ts`: import `fetchReddit`; replace the placeholder body with the
  try/catch → `fetchReddit(REDDIT_LANES)` → `dedupe` → `capLive(…, 20)` → `[]` fallback.
  Add local `dedupe` (key = `(url||title).toLowerCase().trim()`, first wins) and `capLive`
  (`slice(0, n)`). Trim the stale Reddit `TODO(loop)` bullet; keep You.com/classifier ones.
- **Verify:** `npx tsc -b` clean.
- **Commit msg:** `T-001-02: implement fetchLiveFeed via reddit adapter`

## Step 5 — Integration verification (manual; no test runner)

Verification criteria, mapped to Acceptance Criteria:

1. **AC1 — adapter exists, real posts.** `npm run dev`; load `localhost:5173`. Cards beyond
   the 12 curated `h*` appear with `· reddit` in the meta line. Confirm in DevTools Network
   that `/reddit/r/{sub}/hot.json` calls return 200.
2. **AC2 — shield behavior.** Slider at default 61 (FOG, ceiling 2): `unpopularopinion` and
   `rant` (intensity 5) cards are frosted/shielded; `aww`/`EarthPorn` (1) and `CozyPlaces`
   (2) are visible. Click "What if I were Sharp?" → flip to 88 (SHARP, ceiling 5): hottake
   reddit cards un-blur and sort to the top. This is the demo wow with *real* content.
3. **AC3 — dedup + cap.** In React DevTools (or a temporary `console.log(live.length)`),
   `live` ≤ 20 and no two cards share a normalized `url||title`. Remove any temp log after.
4. **AC4 — graceful fallback.** Simulate failure: temporarily point `REDDIT_BASE` at a bad
   path or go offline → page still renders all 12 HERO_FEED cards; slider + flip still work;
   no uncaught error in console. Revert the simulation.
5. **AC5 — clean build.** `npx tsc -b` exits 0; `npm run dev` boots without errors;
   `npm run lint` (oxlint) has no new errors.

## Testing strategy

- **No unit tests** — project has no test runner (CLAUDE.md). Verification is typecheck +
  manual dev-server observation, per the steps above.
- **Pure helpers** (`isImageUrl`, `dedupe`, `capLive`) are written to be trivially correct
  and side-effect-free so they can be unit-tested later if a runner is added; noted as a
  gap in Review rather than blocking this ticket.
- **Network is the risk surface.** The proxy (Step 1) is verified independently via `curl`
  before the adapter depends on it, so a proxy problem is isolated from an adapter problem.

## Rollback / safety

Every step is additive or behind try/catch. If any live behavior misbehaves on stage,
`fetchLiveFeed()` returning `[]` (or reverting Step 4 alone) restores the pure HERO_FEED
demo with zero other changes. The demo floor is never at risk.

## Deviations protocol

Any deviation from this plan gets recorded in `progress.md` with rationale before
proceeding (per RDSPI Implement rules).
