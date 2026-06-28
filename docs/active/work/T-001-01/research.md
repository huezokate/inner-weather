# T-001-01 · Research — live-oura-readiness

Descriptive map of the territory this ticket touches. No solutions here.

## Goal restated

The readiness `score` that drives the whole tier system is currently seeded by a
hardcoded default (`61`) and only ever changes via the manual slider. The ticket
wants the *real* daily Oura readiness score to set that value on load, while the
slider remains a live manual override afterward.

## How the score flows today

`src/App.tsx`
- Line 8: `const [score, setScore] = useState(61);` — the single source of truth.
  Default `61` is deliberate: it lands in the **Perseverance** band and the comment
  says it keeps the first impression "calm" so the Sharp flip is the wow. (Note: 61
  is actually below Perseverance's `min: 70`, so it resolves to **Fog** — see the
  Tiers section; the comment intent is "calm/Fog-ish".)
- Line 12: `const tier = tierForScore(score);` — score → tier on every render.
- Line 15–17: an effect mirrors `tier.key` onto `document.documentElement`
  `data-tier`, which is what themes the whole page (CSS keys off the attribute).
- Line 20–22: an existing `useEffect(() => { fetchLiveFeed().then(setLive)... }, [])`
  runs once on mount. This is the established pattern for "pull async data once on
  load" — Oura should follow the same shape.
- Lines 66–76: the slider `<input type="range" min={50} max={98}>` calls
  `setScore(Number(e.target.value))` on change. This is the manual override path.
- `flipToSharp()` (35–37) toggles score between 61 and 88 — the demo button.

So `score` has three would-be writers: the initial `useState`, the slider, and the
new Oura fetch. Ordering and override semantics between them is the central design
question (deferred to Design).

## Tier system — `src/tiers.ts`

- `tierForScore(score)`: `>=80 → SHARP (ceil 5)`, `>=70 → PERSEVERANCE (ceil 3)`,
  else `FOG (ceil 2)`. Floor 50, ceiling 98 is the assumed "human readiness range."
- Oura readiness scores are integers 1–100. **Constraint surfaced:** a real Oura
  score can be below 50 (a genuinely terrible night) or in the 50–69 gap. The tier
  function already clamps gracefully (anything <70 → Fog), but the *slider* min is
  50 — a real score of, say, 42 would sit below the slider's range. Worth noting;
  resolution is a Design call.
- `power()` normalizes 50→98 to 0..1; not directly relevant but shows the same
  "50 is the floor" assumption baked in two places.

## Feed / shield — `src/feed.ts`

Not modified by this ticket, but it is the consumer that makes the score *visible*:
- `applyShield(items, ceiling)` flags `intensity > ceiling` as `shielded`.
- `fetchLiveFeed()` is currently a stub returning `[]`. It is the precedent for
  "async source module wrapped so failure is invisible." Oura's adapter should read
  as a sibling of this pattern (and of the planned `src/sources/*` adapters).
- `HERO_FEED` is the curated demo floor. The ticket's guardrail: it must keep
  working if Oura fails. Since the feed never reads Oura directly (only via `score`
  → `tier.ceiling`), a failed Oura fetch simply leaves `score` at its default and
  the demo is unaffected. Low coupling — good.

## Source adapters — `src/sources/`

Per CLAUDE.md the layout *expects* `src/sources/oura.ts` (plus future `reddit.ts`,
`youcom.ts`). The directory does **not exist yet** — this ticket creates it and the
first file in it. There is no existing adapter to mirror in-tree; the ticket points
at `../../oura-mcp/src/provider/oura_provider.ts` as the reference, but that path
does **not exist** on disk (searched `wiz-hack/` to depth 3 — no `oura` anywhere).
So the adapter shape will come from the Oura API spec + the `fetchLiveFeed` house
style, not from a copied reference.

## Environment / config

`.env.local` (git-ignored):
- `VITE_OURA_TOKEN` — **filled** (32-char Personal Access Token). This is the key
  the ticket needs.
- `VITE_YOU_API_KEY` filled; `VITE_INSFORGE_BASE_URL` / `VITE_INSFORGE_ANON_KEY`
  filled too (CLAUDE.md says InsForge is empty, but the file has values — out of
  scope here either way).
- Vite only exposes `VITE_`-prefixed vars to the client via `import.meta.env`.
  `tsconfig.app.json` has `"types": ["vite/client"]`, so `import.meta.env.VITE_*`
  is typed as `string | undefined` (actually `string` for known + `any`/`string`
  for custom). Either way, an empty/absent token must be guarded at runtime.

`vite.config.ts` — minimal: just the React plugin. **No `server.proxy` configured.**
The ticket flags Oura CORS as a risk and prescribes adding a dev proxy here if the
browser call is blocked.

## CORS reality (the key risk)

Oura's `api.ouraring.com` is an API host, not configured for browser CORS for
arbitrary origins. A direct `fetch` from `localhost:5173` is likely to be blocked
by the browser (no `Access-Control-Allow-Origin`). The standard mitigations in a
Vite app: a dev-server proxy (`server.proxy`) that the browser hits same-origin and
Vite forwards server-side (no CORS), rewriting `/oura/*` → `https://api.ouraring.com/*`.
This is exactly what the ticket pre-describes. Note: a dev proxy only helps in
`vite dev` / `vite preview`; a production static build would still face CORS — but
this is a hackathon demo run via `npm run dev`, so dev-proxy is sufficient.

## Oura API v2 facts (from the spec, no in-repo reference)

- Endpoint: `GET https://api.ouraring.com/v2/usercollection/daily_readiness`
  with query params `start_date` and `end_date` (YYYY-MM-DD).
- Auth: header `Authorization: Bearer <PAT>`.
- Response shape: `{ data: Array<{ id, day, score: number|null, timestamp, ... }>,
  next_token: string|null }`. `score` is 1–100 (can be `null` if not yet computed).
- For a single day, `data` may be empty (e.g. before the ring syncs / morning not
  processed). The ticket says "take the latest `.data[].score`" — implies handling
  an array that could be `[]` or have a null score.
- Querying just `today` can legitimately return nothing early in the day. A widened
  window (e.g. last few days, take most recent) is a robustness option — flagged for
  Design, not decided here.

## TypeScript / tooling constraints

`tsconfig.app.json` is strict in ways that shape the implementation:
- `verbatimModuleSyntax: true` → type-only imports must use `import type`.
- `erasableSyntaxOnly: true` → no enums / non-erasable TS constructs.
- `noUnusedLocals` / `noUnusedParameters` → no dead vars (a caught-but-unused error
  in a `catch` must be omitted or used).
- `noEmit`, bundler resolution, `allowImportingTsExtensions` — import siblings work
  with or without `.ts`; existing code imports `./feed` (no extension).
- Verification gate (CLAUDE.md): `npx tsc -b` must be clean; dev server must boot.
  No test runner exists — verification is typecheck + manual boot.

## Guardrails that bound any solution

1. HERO_FEED + slider + flip must ALWAYS work — Oura wrapped in try/catch, fall back.
2. Exactly 3 tiers, ceilings 2/3/5 — do not touch.
3. If `VITE_OURA_TOKEN` empty → skip fetch entirely, slider stays sole source, note
   it in the run summary. Never fail the build.
4. Public sources only — a PAT is fine (it's the user's own token, not an OAuth flow
   into a third-party social account).

## Open questions for Design

- Override semantics: how do we ensure the slider still "wins" after the Oura value
  lands, given React state and an async fetch that may resolve after first paint?
- Direct fetch vs. dev proxy first — do we proactively proxy, or try direct and
  document the proxy fallback?
- Date window: today-only vs. a small look-back to survive an unsynced morning.
- Out-of-slider-range scores (e.g. <50): clamp, widen slider, or accept.
