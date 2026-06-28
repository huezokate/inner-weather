# T-001-04 · Research — insforge-diary-backend

Descriptive map of the territory this ticket touches. No solutions here.

## Goal restated

Persist the readiness signal **over time** so the app has memory (the NASI "Memory"
pillar) and demonstrates a live InsForge backend (the $500 prize integration). Two
moving parts: (1) on each settled readiness score, write a `diary` row to InsForge;
(2) render a small "weather diary" strip of recent readings read back from InsForge.
A localStorage fallback must keep the demo alive if any call fails.

## How readiness flows today — `src/App.tsx`

The whole app is a single function component. Relevant state:
- Line 9: `const [score, setScore] = useState(61)` — the single source of truth that
  drives the tier, the theme, the shield, and the feed ordering.
- Line 10: `overrides` — a `Set<string>` of feed-item ids the user tapped to unshield.
- Line 11: `live` — live feed items appended to `HERO_FEED`.
- Line 14: `userTouched` ref — gate so a late Oura response can't clobber a slider drag
  (added by T-001-01).
- Line 16: `const tier = tierForScore(score)` — recomputed every render.
- Lines 19–21: effect mirrors `tier.key` → `document.documentElement[data-tier]`.
- Lines 24–26: effect runs `fetchLiveFeed().then(setLive)` once on mount — the
  established "pull async data once" pattern.
- Lines 31–37: effect seeds `score` from `fetchOuraReadiness()` once, gated by
  `userTouched` (T-001-01). Both async effects are error-isolated with `.catch(() => {})`.
- Lines 39–46: `items` memo — merges hero+live, sorts by intensity (Sharp ↑, else ↓),
  applies the shield by `tier.ceiling`.
- Line 48: `shieldedCount` — count of items shielded and not overridden. This is the
  natural value for the `shielded_count` diary column.
- Lines 50–52: `flipToSharp()` — the demo button that toggles `score` between 61↔88.

**Writers of `score`:** initial `useState`, the slider `onChange` (lines 88–91), Oura
seed, and `flipToSharp`. A diary write must react to *any* settle of `score`, so it
belongs in an effect keyed on `score` (and ideally `tier`/`shieldedCount`), not wired
into each writer. The score changes rapidly while dragging the slider — **debounce is
required** so we don't write a row per pixel. This is the central design tension.

## Tier system — `src/tiers.ts`

`tierForScore`: `>=80 SHARP (ceil 5)`, `>=70 PERSEVERANCE (ceil 3)`, else `FOG (ceil 2)`.
`tier.key` (`"SHARP" | "PERSEVERANCE" | "FOG"`) is the obvious value for the `tier`
text column; `tier.label` is the human form. Untouched by this ticket (guardrail: keep
3 tiers, ceilings 2/3/5).

## Feed model — `src/feed.ts`

Defines `FeedItem`, `HERO_FEED` (the demo floor), `fetchLiveFeed()`, `applyShield()`.
Not modified by this ticket, but `applyShield` produces the `shielded` flag that feeds
`shieldedCount`. The `overrides` Set in App is the source for the `overrides jsonb`
column (ticket asks to persist it).

## Existing integration pattern — `src/sources/oura.ts`, `reddit.ts`

The codebase has a **consistent adapter shape** to mirror:
- A module under `src/sources/` (this ticket puts its module under `src/lib/` per
  CLAUDE.md's stated layout: `lib/insforge.ts`).
- Reads its key from `import.meta.env.VITE_*`; if absent, logs `console.info` and
  returns a benign value (null / []) — **never throws**.
- Every network call wrapped in try/catch; failure returns the fallback. This is the
  "demo floor never breaks" guardrail expressed in code.
- Oura needed a Vite dev proxy for CORS. **Open question for Design:** does InsForge's
  API send permissive CORS headers for browser origins, or is a proxy needed too?
  (The ticket says the base URL `/api/health` is reachable; the SDK is browser-first,
  so CORS is expected to be fine — to be confirmed live.)

## InsForge backend — current live state (verified this session)

- `@insforge/sdk@^1.4.3` is **already in `package.json` and installed** in
  `node_modules`. The ticket's `npm i @insforge/sdk` step is effectively done.
- `createClient({ baseUrl, anonKey })` is the public/anon client; `createAdminClient
  ({ baseUrl, apiKey })` is admin-only (trusted server code). The browser app must use
  `createClient` with the **anon** key — never the admin `ik_…` key in the bundle.
- SDK shape: `client.database.from('diary').insert([{…}]).select()` and
  `.select().order('created_at',{ascending:false}).limit(n)`. All calls return
  `{ data, error }` — **no throw on API error**, so callers must check `error`.
- `get-backend-metadata` (live): `database.tables: []` — **the `diary` table does not
  exist yet.** Provisioning it is part of this ticket.
- `pg_roles` (queried live): the PostgREST roles `anon` and `authenticated` exist
  (Supabase-style). The anon key authenticates requests as the **`anon`** role.
  Therefore RLS policies + table GRANTs must target `anon` (and `authenticated` for the
  optional auth path) or the client gets permission-denied — the classic RLS gotcha the
  ticket warns about.
- No `create-table` MCP tool exists. Schema is managed via **`run-raw-sql`** (admin) +
  `get-table-schema` to verify. So table + RLS provisioning is hand-written DDL.

## Environment & config

`.env.local` (git-ignored) holds: `VITE_INSFORGE_BASE_URL`
(`https://gkeqi24f.us-east.insforge.app`), `VITE_INSFORGE_ANON_KEY`, and the admin
`INSFORGE_API_KEY` (`ik_…`, **not** `VITE_`-prefixed, so it is *not* exposed to the
client bundle — correct). `.insforge/project.json` mirrors project id + appkey + api
key. Vite only exposes `VITE_`-prefixed vars to the client (confirmed in `.env.local`
comments and the Oura/Reddit adapters).

## Styling surface — `src/App.css`, `src/index.css`

`index.css` defines the per-tier CSS custom properties (`--accent`, `--card`, `--glow`,
`--border`, `--morph` timing) swapped atomically by `[data-tier=…]`. `App.css` styles
`.header/.readout/.control/.flip/.feed/.card`. A new "weather diary" strip should reuse
these tokens (`var(--accent)`, `var(--card)`, `var(--border)`, `var(--glow)`,
transitions on `var(--morph)`) so it morphs with the tier flip like everything else.
There is a natural slot for it between the `.flip` button and the `.shield-count`/feed.

## Constraints & assumptions surfaced

- **Guardrail:** HERO_FEED + slider + flip must always work. A failed/missing InsForge
  call must fall back (localStorage) and never throw into render.
- **Guardrail:** keys may be absent — `insforge.ts` must no-op gracefully when
  `VITE_INSFORGE_BASE_URL`/`VITE_INSFORGE_ANON_KEY` are empty.
- The admin key must never reach the client; table provisioning is a one-time admin
  action done now (via `run-raw-sql`), not app code.
- No test runner exists; verification is `npx tsc -b` clean + dev boots + a live
  insert/select round-trip.
- `tsconfig.app.json` is strict (`verbatimModuleSyntax`, `erasableSyntaxOnly`,
  `noUnusedLocals/Parameters`) — type-only imports must use `import type`, and the SDK
  client/types must satisfy these flags.
- Open question (Design): debounce strategy and which fields trigger a write; whether
  to write on the flip too; how many diary entries to show and their visual form.
