# T-001-02 · Review — reddit-live-feed

Handoff document. What changed, how it was verified, and what a human still needs to check.

## Summary

Wired real public Reddit posts into the live feed. `fetchLiveFeed()` now fetches each
`REDDIT_LANES` subreddit's `hot.json`, maps posts to `FeedItem` using the lane's intensity
prior and kind, dedupes, and caps the result at 20 — appended to (never replacing) the
curated `HERO_FEED`. All fetching is triple-error-isolated so the demo floor is never at
risk. A Vite dev proxy routes Reddit through the dev server to avoid CORS.

## Files changed

| File | Action | Notes |
| --- | --- | --- |
| `src/sources/reddit.ts` | **created** | Reddit adapter: types, `fetchReddit`, per-lane fetch/map, filters, dedupe-friendly ids. ~75 lines. |
| `src/feed.ts` | **modified** | Added `thumbnail?: string` to `FeedItem`; imported `fetchReddit`; implemented `fetchLiveFeed()` with `dedupe` + cap-20 + try/catch fallback; trimmed the stale Reddit TODO. |
| `vite.config.ts` | **modified** | Added `server.proxy["/reddit"]` (changeOrigin, rewrite, User-Agent). An `/oura` proxy was added in parallel by another ticket and coexists. |
| `src/App.tsx` | unchanged | Render stays emoji-first; new items get the `🗞️` fallback. |

## Acceptance criteria status

| AC | Status | Evidence |
| --- | --- | --- |
| 1. `reddit.ts` exists; `fetchLiveFeed()` returns real posts | **Code ✅ / live ⚠️** | Adapter implemented and typechecks; live fetch blocked by Reddit IP-403 in this env (see Open concerns). |
| 2. Posts appear; calm under ceiling, hottake shielded in Fog | **Code ✅ / live ⚠️** | Lane intensities (1/1/2/3/5/5) feed `applyShield` directly; correct by construction. Not visually confirmable here (no Reddit response). |
| 3. Live feed deduped and capped (~20) | **✅** | `dedupe()` (normalized `url||title`, first-wins) + `.slice(0, 20)` in `fetchLiveFeed`. |
| 4. Failed lane/fetch falls back cleanly; HERO_FEED + flip work | **✅ (proven)** | The env's Reddit 403 exercises exactly this: every lane → `[]`, app renders 12 curated cards, no uncaught error. |
| 5. `npx tsc -b` clean; dev boots | **✅** | `tsc -b` exit 0; oxlint clean; dev boots; `GET /` → 200. |

## Test coverage

- **No automated tests** — project has no test runner (per CLAUDE.md). Verification was
  typecheck + lint + dev-server boot + HTTP probes.
- **Verified:** typecheck clean, lint clean, dev boots and serves the app (200), and the
  total-failure fallback path (Reddit 403 → curated-only render, no error).
- **Gaps:** the pure helpers (`isImageUrl`, `toFeedItem`, `dedupe`, the `t3`/NSFW/sticky
  filter) are unit-testable but untested for lack of a runner. They are small and
  side-effect-free; if a runner is added later, they are the first candidates. The
  happy-path mapping of a real Reddit payload → `FeedItem[]` was not executed end-to-end
  here (no reachable payload).

## Open concerns / for human attention

1. **⚠️ Reddit IP-block (the one real open item).** Reddit returns **403 from this
   network** for every JSON host/UA tried (`www`/`old`/`api`, plain + browser + dev-proxy
   User-Agents). This is Reddit's anti-anonymous-access throttling, not a bug. **Action:**
   load the app on the demo network and confirm reddit-sourced cards appear and shield/flip
   correctly. If the demo network is also blocked, options: (a) set a User-Agent/OAuth token
   Reddit accepts on the proxy, (b) front it with a small serverless relay, or (c) the app
   already degrades gracefully to HERO_FEED — acceptable for the demo floor but loses the
   "real content exercises the shield" goal. No code change is needed to *try* a better
   network; the transport is correct.
2. **Production transport.** In a real `vite build` there is no dev server, so
   `REDDIT_BASE` falls back to `https://www.reddit.com` directly — which will hit the same
   CORS/403 wall in a browser. The proxy only helps `dev`/`preview`. For a deployed build a
   server-side relay would be required. Out of scope for this ticket (demo is dev-served),
   noted for whoever deploys.
3. **Thumbnails populated but not rendered.** `FeedItem.thumbnail` is now filled from real
   Reddit image URLs, but `App.tsx` still renders the per-kind emoji (deliberate, to keep
   the demo-critical card layout untouched — see design D2). A later UI ticket can render
   `<img src={thumbnail}>` when present. Not a regression; the field is ready.
4. **Intensity is the lane prior, not per-item.** By design (D8) — the InsForge LLM
   classifier that refines per-item intensity is a separate, later ticket. Hottake subs are
   uniformly intensity 5, which is correct and predictable for the shield demo.

## Risk assessment

Low. Every change is additive or guarded: `FeedItem.thumbnail` is optional, the proxy only
affects dev, and `fetchLiveFeed()` cannot throw (final try/catch → `[]`). The worst case —
Reddit entirely unreachable — is the verified-working path and leaves the curated demo,
slider, and Sharp↔Fog flip fully intact.
