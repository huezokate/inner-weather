# T-001-04 · Design — insforge-diary-backend

Options, tradeoffs, and decisions, grounded in Research. Five decision areas.

## D1 — Table provisioning & RLS

**Options**
- (a) `run-raw-sql` admin DDL now: `CREATE TABLE`, `ENABLE ROW LEVEL SECURITY`, GRANT +
  CREATE POLICY for `anon`/`authenticated`. One-time, reproducible, checked into the
  plan.
- (b) Leave RLS disabled and rely on table GRANTs only. Simpler but the ticket
  explicitly asks for "insert+select RLS for the anon role," and InsForge defaults to
  RLS-on conventions; a no-RLS table is a security smell even for a demo.
- (c) Use the InsForge dashboard UI by hand. Not reproducible, not in version control,
  can't be done from this session.

**Decision: (a).** Write the DDL via `run-raw-sql` with the admin key, in the Plan as a
copy-pasteable block. Research confirmed roles `anon` + `authenticated` exist and the
anon key authenticates as `anon`, so:
- `CREATE TABLE public.diary (id uuid pk default gen_random_uuid(), created_at
  timestamptz default now(), readiness int, tier text, shielded_count int, overrides
  jsonb)`.
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY`.
- `GRANT SELECT, INSERT ON public.diary TO anon, authenticated;` (RLS still gates rows;
  GRANT is the table-level prerequisite PostgREST needs).
- `CREATE POLICY diary_anon_select … FOR SELECT TO anon, authenticated USING (true);`
- `CREATE POLICY diary_anon_insert … FOR INSERT TO anon, authenticated WITH CHECK
  (true);`
- `NOTIFY pgrst, 'reload schema';` so PostgREST picks up the new table immediately.

`USING (true)` is acceptable: this is a public demo diary, no per-user secrecy required.
The optional auth path (D5) can later tighten to `auth.uid()` ownership without schema
change. **Rejected** stricter row-ownership policies now because there is no user_id
column in the ticket's schema and no auth requirement for the core demo.

## D2 — Client module shape (`src/lib/insforge.ts`)

**Options**
- (a) Export a singleton `insforge` client built from env vars, plus two guarded
  helpers `writeDiary(entry)` and `readDiary(limit)` that encapsulate the
  insert/select **and** the localStorage fallback. App imports only the helpers.
- (b) Export the raw client and let `App.tsx` call `.database.from(...)` directly.
  Spreads InsForge knowledge + fallback logic into the component.
- (c) A React hook `useDiary()`. Cleaner call-site but heavier; the repo has no other
  custom hooks and prefers plain async functions (Oura/Reddit adapters).

**Decision: (a).** Mirrors the existing adapter convention (`oura.ts`/`reddit.ts`: a
module that reads its env key, no-ops when absent, never throws). The helper boundary
keeps `App.tsx` ignorant of InsForge and of the fallback mechanics — App just calls
`writeDiary` / `readDiary` and gets data or a safe empty result. A module-level
`isConfigured` flag (both env vars present) decides live-vs-local. The client is created
lazily/once and reused.

`DiaryEntry` type lives here and is the contract: `{ id?, created_at?, readiness, tier,
shielded_count, overrides }`. `overrides` serialized as a string[] (the ids).

## D3 — Fallback strategy (the guardrail)

**Decision: localStorage as a transparent safety net, layered, never user-visible as an
error.**
- `writeDiary`: if not configured → write to localStorage only. If configured → attempt
  the InsForge insert; on `error` (or thrown/network) → fall back to localStorage and
  `console.warn`. Always also keep a local mirror? No — to avoid double-counting on
  read, **prefer remote when configured**, and only read local when remote is
  unconfigured or the remote read fails. (Local writes that happened during an outage
  are best-effort and may not reconcile — acceptable for a demo; documented as a known
  limitation.)
- `readDiary(limit)`: if configured → select recent rows ordered by `created_at desc`;
  on error → read from localStorage. If not configured → localStorage.
- localStorage key: `inner-weather:diary`, an array capped to the last ~30 entries.

This satisfies AC "a failed write/read falls back to localStorage so the demo never
breaks" and the CLAUDE.md "localStorage as a runtime safety net only" instruction.

## D4 — When to write & re-read (debounce)

The score changes continuously while dragging the slider (Research D-tension). Writing
per change would spam rows.

**Options**
- (a) Debounce a write effect keyed on `[score]` by ~800ms–1s: after the user stops
  moving, write one row capturing the settled `readiness`, `tier.key`,
  `shieldedCount`, and `overrides`. Re-read the strip after a successful write.
- (b) Write only on explicit events (flip button, Oura seed). Misses manual slider
  settles, which is the main interaction.
- (c) Write on every change, throttled. Still noisy; ordering races on the strip.

**Decision: (a) debounce ~900ms** (matches the existing `--morph` 900ms feel). One
`useEffect` with `setTimeout`/`clearTimeout` on `[score, tier.key, shieldedCount]`.
After a successful write, refresh the strip by re-reading (or optimistically prepend the
new entry to local state to avoid a round-trip flicker — chosen: optimistic prepend +
background read on mount). Skip the *initial* mount write so we don't log a spurious row
before the user (or Oura) has done anything — gate with a `didInit` ref, OR simply
let the first settled value write (a "session start" row is harmless and gives the strip
something to show). **Chosen:** allow the first debounced settle to write — it makes the
strip populate immediately in the demo, which is the desired wow ("memory"). Guard only
against writing the *exact same* readiness twice in a row (track `lastWritten`).

## D5 — Diary strip UI & optional auth

**Strip:** a horizontal row of compact "chips," one per recent entry (cap ~8 shown),
newest first or oldest→newest left-to-right (chosen: oldest→newest so it reads like a
forecast timeline). Each chip shows the readiness number and a tier-colored dot/bar.
Reuse `var(--accent)`, `var(--card)`, `var(--border)`, `var(--glow)`, and transition on
`var(--morph)` so it morphs with the flip. Placed between `.flip` and `.shield-count`.
Empty state: hide the strip entirely (no entries yet) to avoid a barren box on first
paint — it appears after the first write.

**Optional auth (D5b):** The ticket marks per-user auth as *optional* ("only if keys
present"). Decision: **defer/skip** wiring `signInWithPassword` UI for this ticket. The
RLS policies already include `authenticated`, so a future ticket can add an auth gate
without schema or policy changes. Implementing an auth form now adds UI surface and
failure modes that risk the demo floor for marginal value. Documented as a deliberate
non-goal; the public anon diary fully satisfies all required acceptance criteria.

## Rejected approaches (summary)

- **Admin client in the browser** — security violation; anon client only.
- **No RLS / GRANT-only** — fails the explicit AC and InsForge conventions.
- **Per-change writes** — row spam, strip races; debounce chosen.
- **Custom `useDiary` hook** — inconsistent with the repo's plain-async-adapter style.
- **Auth-gated diary now** — optional per ticket; deferred to protect the demo floor.

## Risk register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| InsForge API CORS blocks browser calls | low (SDK is browser-first) | verify live; if blocked, add a Vite `/insforge` proxy like Oura — but expect not needed |
| PostgREST doesn't see new table | medium | `NOTIFY pgrst, 'reload schema'` in DDL; verify with a live insert |
| RLS denies anon insert/select | medium (the classic gotcha) | explicit GRANT + policies for `anon`; verify round-trip live before calling done |
| Debounce writes a row on Oura seed flicker | low | `lastWritten` de-dupe guard |
