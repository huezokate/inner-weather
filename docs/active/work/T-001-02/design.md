# T-001-02 · Design — reddit-live-feed

Decisions, grounded in `research.md`. One choice per question, with rejected options.

## D1 — Fetch transport: direct browser fetch vs. Vite dev proxy

**Options**
- **A. Direct `fetch("https://www.reddit.com/r/{sub}/hot.json?limit=4")`.** Simplest.
  Works in *some* browser/network combos. Research flags it is frequently 403/CORS-blocked
  for anonymous `localhost` origins, and a browser can't set a custom `User-Agent`.
- **B. Vite dev proxy.** Add `server.proxy` in `vite.config.ts` mapping a same-origin path
  (e.g. `/reddit/...`) to `https://www.reddit.com`, with `changeOrigin: true` and a
  `User-Agent` header injected server-side. Reddit sees a server-side request; the browser
  sees a same-origin response → no CORS, no 403.
- **C. Proxy only as fallback.** Try A, on failure retry via B.

**Decision: B (proxy via a base-URL switch), default-on in dev.** Reliability is the whole
point — a flaky feed undermines the demo. The proxy is the path Reddit is least likely to
block, and it lets us set a `User-Agent`. To keep production builds working (where there is
no Vite dev server), the fetch URL is computed from a base that is `/reddit` in dev
(`import.meta.env.DEV`) and the absolute `https://www.reddit.com` otherwise. C adds a
double-fetch and more failure surface for marginal benefit; rejected. A alone is too
unreliable to anchor the demo; rejected as the primary path but is effectively the prod
fallback inside the same base-switch.

## D2 — Thumbnail handling (the missing image field)

**Options**
- **A. Add `thumbnail?: string` to `FeedItem`** and render `<img>` when present.
- **B. Map Reddit thumbnail → `emoji` field** (won't work; emoji is a glyph not a URL).
- **C. Ignore thumbnails; rely on the per-kind emoji the card already shows.**

**Decision: A — add `thumbnail?: string` to `FeedItem`, optional and additive.** The ticket
explicitly says "thumbnail if present", and the field is genuinely missing (research C2).
Adding one optional field is low-risk, breaks nothing (curated items simply omit it), and
satisfies the criterion literally. Reddit thumbnails are only kept when they are real URLs
(`http`-prefixed) — the sentinel values `"self"`, `"default"`, `"nsfw"`, `"spoiler"`, `""`
are dropped. **App.tsx render stays emoji-first for this ticket** to avoid scope creep on
the demo-critical card layout; the field is populated now and an `<img>` can be wired in a
later UI ticket. (Decision: populate the data, keep render change minimal — a small
optional `<img>` is acceptable but the safe default is data-only. We will populate the
field and leave the card render unchanged to protect the demo.) Rejected B (type
mismatch) and C (fails the AC wording).

## D3 — Where the fetch logic lives

**Decision: new `src/sources/reddit.ts` exporting `fetchRedditLane(lane)` and a
`fetchReddit()` aggregator; `feed.ts` `fetchLiveFeed()` calls into it.** Matches CLAUDE.md's
source-layout convention (`sources/` holds live adapters) and the ticket's explicit "new
file `src/sources/reddit.ts`". Keeps `feed.ts` as the model/orchestration layer and the
adapter as the transport layer. Rejected inlining everything in `feed.ts` (muddies the
model file, diverges from the documented layout).

## D4 — Error isolation granularity

**Decision: try/catch per lane, returning `[]` for a failed lane; the aggregator
`Promise.allSettled`s all lanes so one network failure can't reject the whole batch; and
`fetchLiveFeed()` wraps the aggregator in a final try/catch returning `[]`.** Three nested
safety nets means: a single dead subreddit drops one lane; a total Reddit outage drops all
live content but HERO_FEED still renders. This directly satisfies AC#4 and the CLAUDE.md
guardrail. Rejected a single top-level try/catch (one failure would lose all 6 lanes
unnecessarily) and `Promise.all` (rejects on first failure).

## D5 — Dedup + cap strategy

**Decision: dedup by a normalized key of `url || title` (lowercased, trimmed), preserving
first occurrence; then `slice(0, 20)`.** Reddit cross-posts and the same external link can
appear in multiple lanes; url is the strongest identity, title is the fallback when url is
a self-post permalink. Cap at 20 per the ticket. Order before capping: keep lane order
(calm lanes first as listed) so a cap never starves the calm content the demo needs.
Rejected dedup-by-reddit-id (misses cross-domain duplicate links) and capping per-lane
(less predictable total).

## D6 — `id` uniqueness (React key safety)

**Decision: prefix Reddit ids as `reddit-{subreddit}-{post.id}`.** Research flags `id` is the
React key and override key shared across HERO_FEED (`h1`…`h12`) + live. Reddit post ids are
base-36 and won't collide with `h*`, but namespacing makes collisions impossible and the
source legible in DevTools. Rejected raw `post.id` (small collision/readability risk).

## D7 — NSFW / sticky / quality filtering

**Decision: drop posts where `over_18 === true` or `stickied === true`, and drop empty
titles.** Public defaults can include pinned mod posts and occasional NSFW; filtering keeps
the demo safe-for-stage and the content representative. Cheap, in-adapter, no extra calls.
Rejected no-filtering (stage risk) and elaborate quality scoring (out of scope; the LLM
classifier is a later ticket).

## D8 — Intensity assignment

**Decision: use the lane's prior intensity verbatim on every item from that lane** (per the
ticket: "`intensity` = the lane's prior"). The InsForge AI classifier that refines per-item
intensity is an explicitly separate, later ticket (`feed.ts` TODO + classifier note). Using
the prior keeps the shield behavior deterministic and demo-predictable. Rejected any
inline heuristic (unpredictable, out of scope).

## Net shape

`reddit.ts` exposes `fetchReddit(): Promise<FeedItem[]>` (allSettled over lanes, per-lane
try/catch, filter, map with namespaced id + lane intensity/kind, thumbnail when real URL).
`feed.ts` `fetchLiveFeed()` calls `fetchReddit()`, dedups, caps 20, returns — all inside a
final try/catch → `[]`. `FeedItem` gains `thumbnail?: string`. `vite.config.ts` gains a
`/reddit` dev proxy with `changeOrigin` + `User-Agent`. App.tsx render is left intact.
