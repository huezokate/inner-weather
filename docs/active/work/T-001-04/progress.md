# T-001-04 · Progress — insforge-diary-backend

Live execution log. What's done, deviations, and verification evidence.

## Status: COMPLETE — all plan steps executed and verified.

## Step 1 — Provision `diary` table ✅

Ran the DDL batch via `run-raw-sql` (admin): `CREATE TABLE public.diary` (6 cols),
`ENABLE ROW LEVEL SECURITY`, `GRANT SELECT, INSERT TO anon, authenticated`, two
policies (`diary_select` SELECT, `diary_insert` INSERT), `NOTIFY pgrst,'reload schema'`.

**Verified live:**
- `get-table-schema diary`: 6 columns match spec (`id uuid pk default gen_random_uuid`,
  `created_at timestamptz default now`, `readiness int`, `tier text`, `shielded_count int
  default 0`, `overrides jsonb default '[]'`), `rlsEnabled: true`, both policies present
  with roles `{anon,authenticated}`.
- Admin smoke insert/select round-tripped, then deleted.
- **Anon-role end-to-end via REST** (the riskiest part — the RLS gotcha) using the real
  `VITE_INSFORGE_ANON_KEY`:
  - `GET /api/database/records/diary?select=*&limit=3` → **HTTP 200**
  - `POST /api/database/records/diary` (insert) → **HTTP 201**, row returned.
  This proves the anon key the browser uses can both read and write under RLS.
- Cleaned up all test rows. Final `SELECT count(*)` → **0** (clean start for the demo).

No file committed for this step (DB infra), per plan.

## Step 2 — `src/lib/insforge.ts` ✅

Created the guarded client + helpers exactly per structure.md:
- `insforgeConfigured` = both env vars present; `client` = `createClient({baseUrl,
  anonKey})` once, else `null` (never touches network when unconfigured).
- `DiaryEntry` interface is the App↔backend contract.
- `writeDiary(entry)`: live insert when configured; on `error`/throw → `writeLocal`;
  unconfigured → `writeLocal`. Always resolves with the stored entry.
- `readDiary(limit=12)`: live `select('*').order('created_at',{ascending:false})
  .limit()`; on `error`/throw → `readLocal`; unconfigured → `readLocal`.
- localStorage net: key `inner-weather:diary`, cap 30, fully guarded (can't throw).
- Boundary held: this is the only module importing `@insforge/sdk`. Admin key never
  referenced.

Deviation: none. (`@insforge/sdk` was already installed, so the plan's `npm i` was a
no-op as anticipated in research.)

## Step 3 — `src/App.tsx` ✅

- Imported `writeDiary, readDiary, type DiaryEntry`.
- Added `diary` state + `lastWritten` ref.
- Mount effect `readDiary().then(setDiary)` (error-isolated like its neighbors).
- Debounced (900ms) write effect on `[score, tier.key, shieldedCount, overrides]`:
  skips when `score === lastWritten`, writes the settled entry, stamps `lastWritten`,
  optimistically prepends the stored row to `diary` (capped 12). Placed *after*
  `shieldedCount` is declared so it can read it.
- JSX strip between `.flip` and `.shield-count`, hidden when empty, chips rendered
  oldest→newest (`.slice().reverse()`), each tagged `data-tier` + a `title` tooltip.

Deviation from plan: added `overrides` to the effect dependency array (plan listed
`[score, tier.key, shieldedCount]`). Reason: the effect reads `overrides`, so omitting
it would be a stale-closure/exhaustive-deps issue. The `lastWritten` de-dupe guard
prevents this from causing duplicate rows when only `score` is unchanged.

## Step 4 — `src/App.css` ✅

Appended `.diary`, `.diary-label`, `.diary-track` (horizontal scroll, hidden
scrollbar), `.diary-chip` (pill on `var(--card)`/`var(--border)`/`var(--glow)`,
`transition: all var(--morph)`), plus per-`[data-tier]` chip accents (Fog magenta,
Perseverance green, Sharp neon) so each chip is colored by the tier it recorded and the
strip morphs on the flip. Additive only — no existing selectors touched.

## Verification summary

| Check | Result |
|-------|--------|
| `npx tsc -b` | **clean**, exit 0 (strict flags satisfied) |
| `npm run lint` (oxlint) | **clean** |
| `npm run dev` boots | **HTTP 200** in ~2s |
| anon RLS read/write | **200 / 201** via REST with the real anon key |
| table state | **0 rows** (clean demo start) |
| tiers/feed/flip untouched | yes — no edits to `tiers.ts`/`feed.ts`/`index.css` |

## Not done (deliberate, per design)

- Optional per-user auth (`signInWithPassword`) — ticket marks it optional; deferred to
  protect the demo floor. RLS already includes `authenticated`, so a later ticket can
  add it with no schema change.
