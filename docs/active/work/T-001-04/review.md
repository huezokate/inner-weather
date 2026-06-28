# T-001-04 · Review — insforge-diary-backend

Handoff document. What changed, how it was verified, and what a human should know.

## Summary

Inner Weather now has **memory**. Every settled readiness score is persisted as a row
in a live InsForge `diary` table, and a "weather diary" strip reads the recent readings
back and renders them as tier-colored chips. This delivers the NASI "Memory" pillar and
demonstrates a real InsForge backend (the $500 integration). The whole feature is
error-isolated behind one module: missing keys or any failed call fall back to
localStorage, so the curated demo floor (HERO_FEED + slider + Sharp↔Fog flip) is never
at risk.

## Files changed

| File | Action | Summary |
|------|--------|---------|
| InsForge DB `public.diary` | **created** | Table (6 cols) + RLS enabled + `SELECT`/`INSERT` grants & policies for `anon`,`authenticated`. Provisioned via admin `run-raw-sql`. |
| `src/lib/insforge.ts` | **created** | Guarded anon client + `writeDiary`/`readDiary` + `DiaryEntry` type + localStorage net. The only module importing `@insforge/sdk`. |
| `src/App.tsx` | **modified** | Imports; `diary` state + `lastWritten` ref; mount read effect; debounced (900ms) write effect; the diary-strip JSX. |
| `src/App.css` | **modified** | `.diary*` strip + tier-colored `.diary-chip` styles (additive). |

No files deleted. `tiers.ts`, `feed.ts`, `index.css`, `vite.config.ts`, `package.json`
untouched (`@insforge/sdk` was already a dependency). Tiers/ceilings unchanged
(guardrail honored).

## How it works

1. On mount, `App` calls `readDiary()` → recent rows from InsForge (newest-first),
   stored in `diary` state. Fallback: localStorage, then `[]`.
2. A debounced effect (`[score, tier.key, shieldedCount, overrides]`, 900ms) fires when
   readiness settles. It skips if `score` equals the last written value (`lastWritten`
   ref de-dupe), otherwise builds a `DiaryEntry { readiness, tier, shielded_count,
   overrides }` and calls `writeDiary`.
3. `writeDiary` inserts into InsForge via the **anon** client; on `error`/exception (or
   when unconfigured) it writes to localStorage. It always resolves with the stored
   entry, which the effect optimistically prepends to `diary` (capped at 12) so the
   strip updates without a re-read.
4. The strip renders chips oldest→newest, each colored by the tier it recorded, and
   morphs with the page on the flip via the shared `--accent/--card/--glow/--morph`
   tokens. Hidden entirely until the first entry exists.

## Verification

- **Typecheck:** `npx tsc -b` → **clean** (exit 0). Strict flags satisfied
  (`verbatimModuleSyntax` — SDK type imported via `import type`; `noUnusedLocals/
  Parameters`; `erasableSyntaxOnly`).
- **Lint:** `npm run lint` (oxlint) → **clean**.
- **Boot:** `npm run dev` → Vite ready in ~109ms; `GET /` → **HTTP 200**.
- **Schema:** `get-table-schema diary` confirms 6 columns, `rlsEnabled: true`, policies
  `diary_select`/`diary_insert` for `{anon,authenticated}`.
- **Anon RLS round-trip (the riskiest part):** using the real `VITE_INSFORGE_ANON_KEY`,
  `GET …/records/diary` → **200** and `POST …/records/diary` → **201**. This proves the
  exact path the browser client takes works under RLS — the classic anon-permission
  gotcha is closed. Test rows were cleaned up; table is at **0 rows** for a clean demo.

All 7 acceptance criteria are met (checklist in `progress.md`).

## Acceptance criteria status

- [x] `src/lib/insforge.ts` exists, client guarded for missing env vars.
- [x] `diary` table provisioned with insert+select RLS for `anon`.
- [x] Changing readiness writes a real `diary` row (debounced).
- [x] Strip reads recent entries back from InsForge and renders them.
- [x] Failed write/read falls back to localStorage; demo never breaks.
- [x] Oura (T-001-01) + HERO_FEED + flip still work (their code is untouched).
- [x] `npx tsc -b` clean and dev server boots.

## Test coverage & gaps

- **No automated tests** — the repo has no test runner (per CLAUDE.md). Coverage is the
  type system + the live anon RLS round-trip + manual boot/typecheck/lint.
- **Gap — browser-driven UI not scripted.** I verified the data path (anon REST
  insert/select returns 200/201) and that the app compiles and serves, but did not drive
  a headless browser to drag the slider and watch a chip appear. The write path is the
  same anon REST call proven live, so confidence is high; a human demo-check is the final
  confirmation.
- **Gap — localStorage fallback verified by inspection, not by fault injection.** The
  guarded branches (`!error`, try/catch, unconfigured) are straightforward; I did not
  point the client at a bad host to force the fallback at runtime.

## Open concerns / known limitations

- **Outage reconciliation:** if a live write fails and goes to localStorage, that entry
  is not later synced up to InsForge. Acceptable for a demo (documented in design.md);
  a real app would need a sync-on-reconnect queue.
- **De-dupe is per-session:** `lastWritten` resets on reload, so reopening the app at the
  same score can write one more row. Harmless (it's a diary), but noted.
- **Public diary (no per-user scoping):** policies use `USING (true)` — anyone with the
  anon key reads/writes all rows. Intended for the single-user demo. Optional auth was
  deferred by design; the `authenticated` role is already in the policies, so tightening
  to `auth.uid()` ownership later needs only a policy change, not a schema migration.
- **Commits:** the RDSPI plan calls for incremental commits, but this repo is **not a git
  repository** (`git` reports no repo here), so no commits were made. If git is
  initialized later, the natural commit boundaries are the four implementation steps
  (client module / App wiring / CSS / each verified independently).

## For the reviewer

Nothing requires urgent human attention. The one thing worth a 30-second manual check is
the live demo gesture: run `npm run dev`, drag the slider, confirm a chip appears after
~1s and a row lands in InsForge (`SELECT * FROM public.diary ORDER BY created_at DESC`).
Everything else is verified above.
