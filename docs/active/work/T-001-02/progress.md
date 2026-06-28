# T-001-02 · Progress — reddit-live-feed

Implementation log. (Workspace is not a git repo, so steps were landed in sequence with
`npx tsc -b` kept clean between them rather than committed; commit messages noted in
`plan.md` for when this lands in a repo.)

## Completed steps

- **Step 1 — Vite dev proxy.** `vite.config.ts`: added `server.proxy["/reddit"]` →
  `https://www.reddit.com` with `changeOrigin`, `rewrite` stripping `/reddit`, and a
  `User-Agent` header. ✅
- **Step 2 — `thumbnail?` field.** `src/feed.ts`: added `thumbnail?: string` to `FeedItem`
  (additive, optional; curated items omit it). ✅
- **Step 3 — Reddit adapter.** Created `src/sources/reddit.ts`: `RedditLane`,
  `RawRedditPost`, `RedditListing` types; `REDDIT_BASE` dev/prod switch; `isImageUrl`,
  `toFeedItem`, `fetchLane`, `fetchReddit`. Per-lane try/catch → `[]`; `Promise.allSettled`
  aggregation; filters `t3` / `over_18` / `stickied` / empty title; namespaced ids
  `reddit-{sub}-{id}`. ✅
- **Step 4 — wire `fetchLiveFeed()`.** `src/feed.ts`: imported `fetchReddit`; replaced the
  placeholder with try/catch → `fetchReddit(REDDIT_LANES)` → `dedupe` → `slice(0, 20)` →
  `[]` fallback. Added `dedupe` helper (normalized `url||title`, first wins). Trimmed the
  stale Reddit `TODO(loop)` bullet; kept You.com/classifier bullets. ✅
- **Step 5 — verification.** See below. ✅ (with one environmental caveat)

## Verification results

- `npx tsc -b` → **exit 0, clean.** ✅
- `npm run lint` (oxlint) → **clean, no new errors.** ✅
- `npm run dev` → **boots clean** (Vite 8.1.0); `GET /` → 200, `GET /src/main.tsx` → 200. ✅
- App renders on HERO_FEED; slider + Sharp↔Fog flip unaffected (no App.tsx change). ✅

## Deviation / important finding — Reddit IP-block (AC1/AC2 live content)

Reddit's public JSON is **HTTP 403 from this network/IP across every variant tried**:
`www.reddit.com/r/{sub}/hot.json`, `old.reddit.com`, `api.reddit.com`, and `/r/{sub}.json`
— with a plain UA, a full Chrome browser UA, and the dev-proxy UA alike. This is Reddit's
well-known anti-anonymous-access block (datacenter/rate-limit level), **not a code defect**.

Consequence:
- **AC4 (graceful fallback) is verified by this exact condition.** A 403 makes `res.ok`
  false → `fetchLane` returns `[]` → `fetchReddit` yields `[]` → `fetchLiveFeed` returns
  `[]` → the app renders all 12 HERO_FEED cards; slider + flip work; **no uncaught error**.
  The demo floor is provably intact under total Reddit failure.
- **AC1/AC2 (real posts appear, shielded correctly) could NOT be confirmed live here**
  because no Reddit response is reachable from this environment. The code path is correct
  by construction (mapping, lane intensity → shield, namespaced ids) and will populate the
  feed on any network where Reddit's JSON is reachable (e.g. the demo machine, or behind a
  proxy/UA Reddit accepts). This is flagged as the one open item for human verification in
  `review.md`.

No deviation from the planned *code*; the only deviation is that live-content verification
is environmentally blocked. The proxy + base-switch remain the right transport: on a
network where Reddit answers, the same code returns real posts with zero further changes.

## Remaining

Nothing in code. One human-side check: load the app on a network where Reddit's JSON is
reachable and confirm reddit-sourced cards appear and shield/flip as designed.
