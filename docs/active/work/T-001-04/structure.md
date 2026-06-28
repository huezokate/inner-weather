# T-001-04 · Structure — insforge-diary-backend

The blueprint: files touched, interfaces, boundaries, ordering. Not code.

## File-level change set

| File | Action | Why |
|------|--------|-----|
| InsForge DB (`public.diary`) | **create** (DDL via `run-raw-sql`, admin) | Provision table + RLS + grants. Infrastructure, not app code. |
| `src/lib/insforge.ts` | **create** | Guarded client + `writeDiary`/`readDiary` helpers + localStorage fallback + `DiaryEntry` type. |
| `src/App.tsx` | **modify** | Debounced write effect, mount read, render the diary strip. |
| `src/App.css` | **modify** | `.diary` strip + `.diary-chip` styles, tier-token driven. |
| `package.json` | **no change** | `@insforge/sdk` already present (verified). |
| `tiers.ts`, `feed.ts`, `index.css`, `vite.config.ts` | **no change** | Untouched (guardrail: tiers/ceilings fixed; CORS expected fine). |

No deletions.

## `src/lib/insforge.ts` — public interface

```
// types
export interface DiaryEntry {
  id?: string;
  created_at?: string;
  readiness: number;     // 1..100
  tier: string;          // tier.key: "SHARP" | "PERSEVERANCE" | "FOG"
  shielded_count: number;
  overrides: string[];   // feed-item ids the user un-shielded
}

// config flag (both env vars present)
export const insforgeConfigured: boolean;

// helpers (never throw; always resolve)
export async function writeDiary(entry: DiaryEntry): Promise<DiaryEntry>;
//   live insert when configured, else/at-failure localStorage. Returns the stored
//   entry (with id/created_at filled when available).
export async function readDiary(limit?: number): Promise<DiaryEntry[]>;
//   recent entries, newest-first from source; [] on total failure. Default limit 12.
```

Internal (not exported):
- `client` — lazily created `createClient({ baseUrl, anonKey })` from
  `import.meta.env.VITE_INSFORGE_BASE_URL` / `VITE_INSFORGE_ANON_KEY`. Created once,
  reused. `null` when unconfigured.
- `LOCAL_KEY = "inner-weather:diary"`, `LOCAL_CAP = 30`.
- `readLocal()` / `writeLocal(entry)` — parse/guard localStorage, cap length.
- All InsForge calls check the `{ data, error }` shape and treat `error` as a fallback
  trigger; everything wrapped in try/catch as a second net.

**Boundary:** this module is the *only* place that imports `@insforge/sdk` or touches
localStorage for the diary. `App.tsx` imports only `writeDiary`, `readDiary`,
`insforgeConfigured`, and the `DiaryEntry` type. Mirrors `sources/oura.ts` adapter
convention (env-guarded, never throws).

## `src/App.tsx` — modifications

New imports (top): `import { writeDiary, readDiary, type DiaryEntry } from "./lib/insforge"`.

New state/refs (near existing state, ~line 11):
- `const [diary, setDiary] = useState<DiaryEntry[]>([])` — entries rendered in the strip.
- `const lastWritten = useRef<number | null>(null)` — de-dupe guard (last readiness written).

New effects:
1. **Mount read** (alongside the existing feed/Oura effects, ~line 26):
   `readDiary().then(setDiary).catch(() => {})`. Error-isolated like its neighbors.
2. **Debounced write** keyed on `[score, tier.key, shieldedCount]`:
   - `setTimeout(~900ms)`; on fire, if `score === lastWritten.current` → skip.
   - else build `DiaryEntry { readiness: score, tier: tier.key, shielded_count:
     shieldedCount, overrides: [...overrides] }`, `await writeDiary(entry)`, set
     `lastWritten.current = score`, and **optimistically** `setDiary(prev => [stored,
     ...prev].slice(0, 12))`.
   - cleanup `clearTimeout` on re-run/unmount. Fully `try/catch`-guarded so a write
     failure can't break render.
   - Note: `shieldedCount` is computed at ~line 48 *after* `items`; the effect must be
     declared after that or read the value via a ref/recompute. **Ordering:** place the
     write effect below the `shieldedCount` declaration (effects may reference values
     declared earlier in the function body).

New render block (JSX), inserted between the `.flip` button (~line 98) and
`.shield-count` (~line 100):
```
{diary.length > 0 && (
  <div className="diary" aria-label="weather diary">
    <span className="diary-label">weather diary</span>
    <div className="diary-track">
      {diary.slice().reverse().map((d) => (
        <span key={d.id ?? d.created_at} className="diary-chip"
              data-tier={d.tier} title={`${d.readiness} · ${d.tier}`}>
          {d.readiness}
        </span>
      ))}
    </div>
  </div>
)}
```
`.slice().reverse()` renders oldest→newest left-to-right (read is newest-first).
`data-tier` on the chip lets each chip pick up that tier's accent token.

## `src/App.css` — additions (append; reuse tokens)

- `.diary` — container, margin between flip and shield-count.
- `.diary-label` — tiny uppercase caption like `.mode-tag`.
- `.diary-track` — flex row, gap, `overflow-x:auto`, wraps the chips.
- `.diary-chip` — pill: `background: var(--card)`, `border: var(--border-w) solid
  var(--border)`, `box-shadow: 0 0 var(--glow) …`, `transition: all var(--morph)`. A
  per-chip accent comes from a scoped `[data-tier]` rule reusing the index.css accent
  values (or a small local map) so chips are color-coded by the tier they recorded.

No changes to existing selectors; additive only.

## Ordering of changes (dependency order)

1. **Provision DB** (DDL + RLS + grants + schema reload). Verify with a manual
   `INSERT … RETURNING` + `SELECT` via `run-raw-sql`. Nothing else works until the
   table accepts anon I/O.
2. **`src/lib/insforge.ts`** — client + helpers + fallback + types. Typecheck in
   isolation (unused-export warnings tolerated until App wires it).
3. **`src/App.tsx`** — imports, state, two effects, JSX strip.
4. **`src/App.css`** — strip styling.
5. **Verify** — `npx tsc -b` clean, `npm run lint`, dev boots, live round-trip
   (change score → row appears in InsForge → strip renders it; then simulate failure
   path conceptually via the guards).

## Interface contracts / invariants

- `writeDiary`/`readDiary` **never reject** — App's `.catch` is belt-and-suspenders.
- App never imports `@insforge/sdk` directly (boundary).
- The admin `INSFORGE_API_KEY` never appears in any `src/**` file (only the anon key,
  via `VITE_INSFORGE_ANON_KEY`).
- Tiers/ceilings unchanged; HERO_FEED/slider/flip code paths untouched.
- Strip is hidden when empty (no barren box pre-first-write).
