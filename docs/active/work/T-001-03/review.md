# T-001-03 · Review — youcom-live-lane

Handoff document. What changed, how it was verified, and what a human still needs to check.

## Summary

Added the You.com live lane — the $1K prize integration. A new adapter
`src/sources/youcom.ts` runs two You.com Search queries (one calm, one trending), maps the
`results.web[]` entries to `FeedItem`s labeled `you.com` using per-query intensity priors, and
folds them into `fetchLiveFeed()` ahead of the Reddit results — reusing the existing dedupe +
~20 cap. A `/youcom` Vite dev proxy routes the call same-origin to dodge the API's CORS block.
Every fetch is error-isolated (empty key, failed query, bad JSON → `[]`), so the curated
demo floor (HERO_FEED + slider + flip) can never break. Verified live: the proxy returns real
current web results through the dev server.

## Files changed

| File | Action | Notes |
| --- | --- | --- |
| `src/sources/youcom.ts` | **created** | ~105 lines. `YOUCOM_QUERIES`, types, `isImageUrl`/`slug`/`toFeedItem`, per-query `fetchQuery`, total `fetchYouCom`. |
| `vite.config.ts` | **modified** | Added `server.proxy["/youcom"]` (target `ydc-index.io`, changeOrigin, rewrite). Coexists with `/reddit` + `/oura`. |
| `src/feed.ts` | **modified** | Imported `fetchYouCom`; `fetchLiveFeed()` now merges You.com (first) + Reddit via `Promise.all`, then `dedupe(...).slice(0,20)`; removed stale You.com TODO line. |
| `src/App.tsx` | unchanged | Render path already handles emoji-less, thumbnail-bearing items (🗞️ fallback). |
| `FeedItem` model | unchanged | `thumbnail` already existed (T-001-02); You.com reuses it — no model change. |

## Acceptance criteria status

| AC | Status | Evidence |
| --- | --- | --- |
| 1. `youcom.ts` exists; both calm + trending queries run behind try/catch | **✅** | File created; `fetchQuery` per-query try/catch + `Promise.allSettled` + empty-key guard + outer try/catch. |
| 2. Real web results show labeled `you.com`, shielded by tier | **✅ (transport proven live)** | Dev-server `/youcom` probe returned 5 real results; `source:"you.com"`, calm prior 2 (clears all ceilings), trending prior 5 (shielded in FOG/PERS, surfaces in SHARP). |
| 3. Reddit lane still works; dedupe + cap hold | **✅** | `fetchReddit(REDDIT_LANES)` untouched; same `dedupe()` + `.slice(0,20)` reused; You.com merely concatenated ahead of it. |
| 4. Missing key / failure falls back cleanly; HERO_FEED + flip work | **✅** | Empty key → `console.info` + `[]`; any query failure → `[]`; `fetchLiveFeed` outer try/catch → `[]`. Demo floor structurally untouched. |
| 5. `npx tsc -b` clean; dev boots | **✅** | `tsc -b` exit 0; oxlint exit 0; dev boots ~130ms; `GET /` → 200. |

## Test coverage

- **No automated tests** — project has no test runner (CLAUDE.md). Verification was typecheck
  + lint + dev-server boot + a live end-to-end proxy probe.
- **Verified live (not just by construction):** the `/youcom` dev proxy forwards `X-API-Key`
  and returns real You.com web results (5 for the calm query) through `localhost:5173` — so
  the full dev transport path (proxy → API → JSON shape) is proven, not assumed. This is a
  stronger result than T-001-02's Reddit lane, which was IP-403'd in its env.
- **Gaps:** the pure helpers (`isImageUrl`, `slug`, `toFeedItem`) and the
  `results.web[] → FeedItem[]` mapping are unit-testable but untested for lack of a runner —
  first candidates if one is added. The visual shield/flip on You.com cards was reasoned from
  the priors (2 always-through, 5 SHARP-only) and the unchanged `applyShield`/sort path, not
  captured as a screenshot here.

## Open concerns / for human attention

1. **⚠️ Key exposure (run-summary item, per ticket).** `VITE_YOU_API_KEY` is inlined into the
   client bundle by Vite. Fine for the **dev-served local demo**. For any **public deploy**,
   move the You.com call behind a serverless function / server proxy so the key isn't shipped
   to browsers. No code change needed for the demo; flagged for whoever deploys.
2. **Production transport.** In a real `vite build` there's no dev server, so `YOUCOM_BASE`
   falls back to `https://ydc-index.io` directly and hits the same CORS wall the proxy solves.
   The dev/preview proxy is the supported demo path (same situation as Reddit/Oura).
3. **Intensity is the query prior, not per-item.** By design — the InsForge LLM classifier that
   refines per-item intensity is a separate later ticket (the remaining `TODO(loop)` in
   `feed.ts`). Trending results are uniformly intensity 5, which is correct and predictable for
   the shield demo.
4. **`thumbnail`/`body` populated but not rendered.** You.com fills `thumbnail` (when the API
   returns a real image URL) and `body`, but `App.tsx` stays emoji-first (🗞️ for You.com cards)
   to keep the demo-critical layout untouched. Fields are ready for a later UI ticket; not a
   regression.
5. **Cap ordering is intentional.** You.com leads the merged array so its (≤10) results survive
   `.slice(0, 20)` even when Reddit returns a full ~24 (Design D5). If a future ticket wants a
   balanced mix, interleave before the cap.

## Risk assessment

Low. Every change is additive or guarded: the proxy only affects dev, `FeedItem` is unchanged,
and both `fetchYouCom` and `fetchLiveFeed` are total (cannot throw — final try/catch → `[]`).
The worst case — You.com entirely unreachable or key removed — degrades to Reddit + the curated
HERO_FEED with the slider and Sharp↔Fog flip fully intact. Unlike the Reddit lane, the You.com
transport is confirmed working live in this environment.
