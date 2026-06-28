# T-001-01 · Structure — live-oura-readiness

The blueprint: exact files, interfaces, and ordering. No implementation, just shape.

## Change set overview

| File | Action | Why |
|------|--------|-----|
| `src/sources/oura.ts` | **create** | New Oura adapter (D1, D2) |
| `vite.config.ts` | **modify** | Add dev proxy for `/oura` (D3) |
| `src/App.tsx` | **modify** | Seed `score` from Oura on mount; slider-wins gate (D4) |

No deletions. No changes to `tiers.ts`, `feed.ts`, or any CSS (D6 — tiers/feed untouched).

---

## 1. `src/sources/oura.ts` (new)

Self-contained source adapter, sibling in spirit to `fetchLiveFeed()` in `feed.ts`.

**Public interface**
```ts
export async function fetchOuraReadiness(): Promise<number | null>
```

**Internal organization (top → bottom)**
- A small module constant for the base path: `const OURA_BASE = "/oura/v2/usercollection"`
  (relative → goes through the Vite proxy; same-origin, no CORS).
- Token read: `const token = import.meta.env.VITE_OURA_TOKEN as string | undefined`.
- Date helper: a local `function toISODate(d: Date): string` returning `YYYY-MM-DD`
  (use `toISOString().slice(0,10)` — UTC day is fine for a demo).
- `fetchOuraReadiness`:
  1. If `!token` → return `null` immediately (D7). One `console.info` line.
  2. Compute `end = today`, `start = today − 7 days` (D5), format both.
  3. `try`:
     - `fetch(`${OURA_BASE}/daily_readiness?start_date=${start}&end_date=${end}`,
       `{ headers: { Authorization: `Bearer ${token}` } })`.
     - If `!res.ok` → `console.warn` with status → return `null`.
     - Parse JSON as the response type below.
     - From `data`, scan from the end for the first entry with a numeric `score`;
       return it, else `null`.
  4. `catch (err)` → `console.warn("Oura readiness fetch failed", err)` → return `null`.

**Local types (not exported; keep adapter's surface minimal)**
```ts
interface OuraReadinessEntry { id: string; day: string; score: number | null }
interface OuraReadinessResponse { data: OuraReadinessEntry[]; next_token: string | null }
```
Only the fields we read are typed; extra fields in the payload are ignored. Use
`import`-free local interfaces (no cross-file type imports needed).

**Constraints honored**
- `verbatimModuleSyntax`: no `import type` needed (no imported types). Plain
  `export async function`.
- `noUnusedLocals`/`Params`: every local is used; catch binding `err` is logged.
- Return type explicit (`Promise<number | null>`) for clarity and tsc.

---

## 2. `vite.config.ts` (modify)

Add a `server.proxy` block (D3). Resulting shape:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/oura': {
        target: 'https://api.ouraring.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oura/, ''),
      },
    },
  },
})
```

- `changeOrigin: true` so Oura sees its own Host.
- `rewrite` strips the `/oura` prefix so `/oura/v2/...` → `https://api.ouraring.com/v2/...`.
- The adapter's `Authorization` header passes through untouched.
- No other config touched.

---

## 3. `src/App.tsx` (modify)

Three localized edits; the component's structure and JSX are otherwise unchanged.

**a) Imports**
- Add `useRef` to the existing React import.
- Add `import { fetchOuraReadiness } from "./sources/oura";` next to the existing
  `./feed` and `./tiers` imports.

**b) Slider-wins gate**
- Add a ref near the existing state hooks:
  `const userTouched = useRef(false);`
- This avoids a re-render (vs. state) and is read synchronously by the Oura effect.

**c) Oura seeding effect** (new `useEffect`, placed alongside the existing live-feed
effect, both run once on mount):
```ts
useEffect(() => {
  fetchOuraReadiness().then((s) => {
    if (s != null && !userTouched.current) setScore(s);
  });
}, []);
```
- Gate: only apply if the user hasn't interacted (D4) and Oura returned a number.
- No `.catch` needed (adapter never rejects), but a trailing `.catch(() => {})` is
  acceptable for symmetry with the existing `fetchLiveFeed` call. Decision: omit it
  to keep noise down since the adapter is non-throwing; or mirror existing style with
  it. **Pick: mirror existing style** → add `.catch(() => {})` for consistency.

**d) Slider onChange — mark touched**
- Existing: `onChange={(e) => setScore(Number(e.target.value))}`.
- New: also set the flag:
  `onChange={(e) => { userTouched.current = true; setScore(Number(e.target.value)); }}`.

**Untouched in App.tsx:** `flipToSharp` (stays independent of the touch gate per
D4), `override`, the feed memo, all JSX/markup, the `data-tier` effect.

---

## Ordering of changes (matters for verifiable increments)

1. **Proxy first** (`vite.config.ts`) — infra; harmless on its own, restart dev to
   pick it up.
2. **Adapter** (`src/sources/oura.ts`) — pure addition; `tsc` clean on its own
   (unused export is fine; `noUnusedLocals` is about locals, not exports).
3. **Wire-up** (`src/App.tsx`) — connects adapter to state; this is where behavior
   changes. After this, full verification (tsc + boot + observe score on load + drag
   slider to confirm override + flip still works).

Each step keeps the build green; step 3 is the only one that alters runtime behavior.

## Interface contract (the one seam)

`App` ⇄ `oura.ts` communicate solely through:
`fetchOuraReadiness(): Promise<number | null>` — `number` = a readiness score to seed,
`null` = "no usable data, keep current score." No exceptions cross the boundary.
This single, total contract is what guarantees the demo floor (HERO_FEED + slider +
flip) is structurally insulated from anything Oura does.
