# T-001-04 · Plan — insforge-diary-backend

Ordered, independently-verifiable steps. No test runner exists; verification = DB
round-trip + `npx tsc -b` clean + `npm run lint` + dev boots. Commit after each step.

## Step 1 — Provision the `diary` table (DB infra)

Run as one `run-raw-sql` admin batch:

```sql
CREATE TABLE IF NOT EXISTS public.diary (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  readiness      integer NOT NULL,
  tier           text    NOT NULL,
  shielded_count integer NOT NULL DEFAULT 0,
  overrides      jsonb   NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.diary ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.diary TO anon, authenticated;
CREATE POLICY diary_select ON public.diary
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY diary_insert ON public.diary
  FOR INSERT TO anon, authenticated WITH CHECK (true);
NOTIFY pgrst, 'reload schema';
```

**Verify:** `get-table-schema diary` shows the 6 columns + RLS enabled + 2 policies.
Then a smoke insert/select:
```sql
INSERT INTO public.diary (readiness, tier, shielded_count, overrides)
VALUES (61, 'FOG', 4, '["h1"]'::jsonb) RETURNING *;
SELECT * FROM public.diary ORDER BY created_at DESC LIMIT 5;
```
Delete the smoke row afterward (`DELETE … WHERE tier='FOG' AND readiness=61` is too
broad — use the returned id) so it doesn't pollute the demo strip. **Commit:** none
(DB change, not a file) — note it in progress.md.

## Step 2 — `src/lib/insforge.ts`

Implement per structure.md:
- Read `VITE_INSFORGE_BASE_URL` / `VITE_INSFORGE_ANON_KEY`; `insforgeConfigured =
  !!(baseUrl && anonKey)`.
- Lazy `client` via `createClient({ baseUrl, anonKey })`.
- `DiaryEntry` interface.
- `readLocal()/writeLocal()` with `LOCAL_KEY="inner-weather:diary"`, cap 30.
- `writeDiary(entry)`: configured → `client.database.from('diary').insert([row])
  .select()`, check `error`; on error/exception → `writeLocal`. Unconfigured →
  `writeLocal`. Always returns the stored entry (remote row when available, else the
  local echo). Also mirror successful remote writes into local? No — keep remote as the
  source of truth when configured (avoids double counting); local is only the outage
  path.
- `readDiary(limit=12)`: configured → `select('*').order('created_at',{ascending:
  false}).limit(limit)`, check `error`; on error → `readLocal()`. Unconfigured →
  `readLocal()`. Returns `[]` on total failure.
- Use `import type` for SDK types if any are referenced, to satisfy
  `verbatimModuleSyntax`.

**Verify:** `npx tsc -b` clean (module may be unused until Step 3 — that's fine, it's
imported there; if a transient unused warning blocks, proceed to Step 3 before
typechecking). **Commit:** `feat: insforge diary client + localStorage fallback`.

## Step 3 — Wire `App.tsx`

- Add imports: `writeDiary, readDiary, type DiaryEntry`.
- Add `diary` state + `lastWritten` ref.
- Mount effect: `readDiary().then(setDiary).catch(() => {})`.
- Debounced write effect on `[score, tier.key, shieldedCount]`:
  - `const t = setTimeout(async () => { … }, 900); return () => clearTimeout(t);`
  - inside: if `score === lastWritten.current` return; build entry; `try { const stored
    = await writeDiary(entry); lastWritten.current = score; setDiary(prev => [stored,
    ...prev].slice(0, 12)); } catch {}`.
- JSX strip between `.flip` and `.shield-count`, guarded by `diary.length > 0`,
  chips rendered oldest→newest (`diary.slice().reverse()`), each with `data-tier`.

**Verify:** `npx tsc -b` clean; `npm run lint` clean; dev boots; in the browser, drag
the slider → after ~1s a new chip appears and a row lands in InsForge (confirm via
`SELECT … ORDER BY created_at DESC LIMIT 3`). **Commit:** `feat: debounced diary writes
+ weather diary strip`.

## Step 4 — `src/App.css`

Append `.diary`, `.diary-label`, `.diary-track`, `.diary-chip` (+ per-`data-tier` chip
accent). Reuse `var(--card/border/accent/glow/morph)`. No edits to existing selectors.

**Verify:** dev boots; the strip reads legibly in both Fog and Sharp; chips morph on
flip. **Commit:** `style: weather diary strip`.

## Step 5 — Acceptance pass & cleanup

Walk every AC:
- [ ] `src/lib/insforge.ts` exists, guarded for missing env vars → unset both vars
  mentally / confirm `insforgeConfigured` branch falls to localStorage.
- [ ] `diary` table provisioned with insert+select RLS for `anon` → Step 1 verify.
- [ ] Changing readiness writes a real row → Step 3 live check.
- [ ] Strip reads recent entries back from InsForge → mount read returns rows.
- [ ] Failed write/read → localStorage (code path inspected; force by checking the
  catch/`error` branches; optionally verify by temporarily pointing baseUrl at a bad
  host — not committed).
- [ ] Oura (T-001-01) still works; HERO_FEED + flip still work → unchanged code; smoke
  the flip.
- [ ] `npx tsc -b` clean + dev boots.

Remove the Step 1 smoke row if still present. Final **commit** only if cleanup changed
files; otherwise none.

## Testing strategy

- **No unit tests** (no runner per CLAUDE.md). Coverage is: the type system, the live
  DB round-trip, and manual browser verification of the write→chip→DB path.
- **Integration check** is the live insert/select via the SDK from the running dev app,
  plus an admin `SELECT` confirming the row persisted server-side (proves anon RLS works
  end-to-end, the riskiest part).
- **Fallback check** is by code inspection of the guarded branches; a non-committed
  bad-host experiment can confirm the localStorage path if time permits.

## Rollback

All app changes are additive and isolated to one new module + an additive App/CSS edit;
reverting the three commits restores the pre-ticket demo floor exactly. The `diary`
table can be left in place (harmless) or dropped via `DROP TABLE public.diary CASCADE`.
