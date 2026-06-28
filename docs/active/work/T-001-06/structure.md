# T-001-06 · Structure — polish-and-demo

The blueprint: exact files created / modified / deleted, the shape of each change, and the
order that matters. Not code — the contract the Plan executes against.

## File-level change set

| File | Action | What |
|---|---|---|
| `src/App.tsx` | **modify** | Add the FLIP reorder hook; pass `--i` visual index to each card. |
| `src/index.css` | **modify** | Fold in `.diary*` rules; add stagger delay + reduced-motion; tune un-blur timing/blur. |
| `src/App.css` | **delete** | Orphaned (never imported). Diary rules relocated to `index.css`. |
| `../INNER_WEATHER_CONCEPT.md` | **modify** | Append `### ≤3-min demo script` inside §1. |
| `DEPLOY.md` | **create** | Build + static-host steps; mandatory secrets-off-client section. |
| `inner-weather-flip.gif` | **create (best-effort)** | Recorded flip, or a recipe doc if the browser bridge is absent. |
| `feed.ts` | **none** | Confirmed no change needed — visual index is a render concern in App.tsx. |

No change to `tiers.ts`, `sources/*`, `lib/*`, `vite.config.ts`, `package.json` (zero new
deps — WAAPI is native).

## `src/App.tsx` — shape of the change

### New: `useFlipReorder(items)` hook (module-scoped, above `App`)

A small custom hook that owns the FLIP. Interface and internals:

```
function useFlipReorder(orderKey: string): (el: HTMLElement | null, id: string) => void
```

- Holds `const positions = useRef(new Map<string, DOMRect>())`.
- Holds `const nodes = useRef(new Map<string, HTMLElement>())`.
- Returns a stable **ref callback** `register(el, id)` that records/forgets the live node
  in `nodes`.
- A `useLayoutEffect(() => { … }, [orderKey])` runs after every commit whose id-order
  changed:
  1. Guard: bail early if `prefers-reduced-motion: reduce` matches, or if no prior
     positions exist (first paint).
  2. For each `[id, el]` in `nodes`: read `next = el.getBoundingClientRect()`; look up
     `prev` from `positions`. If both exist and `(dx,dy)` is non-trivial (> 1px), call
     `el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"translate(0,0)"}],
     {duration:520, easing:"cubic-bezier(0.2,0.8,0.2,1)", composite:"add"})`.
  3. After measuring, repopulate `positions` with the new rects for the next flip.
  - Entire body wrapped in `try/catch`; feature-detect `el.animate`. Any failure → no-op,
    cards already in final position (today's behavior).

Rationale recap (Design 1): `composite:"add"` preserves the CSS `scale(0.97)`; the slide is
decorative; reduced-motion and unsupported browsers fall straight through to instant
reorder.

### Wiring inside `App`

- Compute a stable order key from the memoized `items`:
  `const orderKey = items.map(i => i.id).join(",")` (cheap; ≤ ~32 ids).
- `const register = useFlipReorder(orderKey)`.
- In the feed `map`, give each `<article>`:
  - `ref={(el) => register(el, it.id)}` — registers the node for measurement.
  - `style={{ ["--i" as string]: visualIndex }}` where `visualIndex` is the card's index in
    the rendered list (use the `map` index). Drives the CSS stagger.
- No other JSX changes. Keys stay `key={it.id}` (required for React to *move* nodes so the
  FLIP has a stable element to animate).

TS notes (strict flags): the `--i` custom property needs a cast
(`style={{ "--i": i } as React.CSSProperties}`); the ref callback returns `void`; no unused
locals. `React.CSSProperties` import via the existing `react` import surface.

## `src/index.css` — shape of the change

Three edits, all additive or cosmetic:

1. **Relocate diary styles.** Append the `.diary`, `.diary-label`, `.diary-track`(+webkit
   scrollbar), `.diary-chip`, and the three `.diary-chip[data-tier=…]` rules **verbatim**
   from App.css into a clearly-commented "weather diary strip" block. They reference
   `--card/--accent/--border*/--glow/--morph`, already defined in index.css — so they
   morph with the page once loaded.

2. **Stagger + reduced-motion.** Change `.card`'s transition so the un-blur portion carries
   a per-card delay:
   - `.card { … transition: all var(--morph), filter 700ms ease var(--i-delay,0ms),
     transform 700ms ease var(--i-delay,0ms); }`
   - Define `--i-delay: calc(var(--i, 0) * 45ms);` on `.card` (so cards without the inline
     var still get 0ms).
   - Add `@media (prefers-reduced-motion: reduce) { .card { transition-duration: 0.001ms;
     } .atmos .rain { animation: none; } }` for accessibility + calmer capture.

3. **Projector contrast.** `.card.shielded { filter: blur(8px) saturate(0.55); … }` (was
   `blur(7px) saturate(0.6)`). Cosmetic only.

`:root`/tier token blocks, ceilings, atmosphere, layout — unchanged.

## `../INNER_WEATHER_CONCEPT.md` — shape of the change

Insert a new subsection at the **end of §1**, before the `---` that opens §2:

```
### ≤3-min demo script (judge walkthrough)
0:00 … open in Fog …            (set the scene, name readiness 61 · Fog)
0:30 … point at a shielded card …
1:00 … tap "What if I were Sharp?" → the snap …
1:30 … "Same feed. Your nervous system decides what gets through." …
2:00 … InsForge proof: diary strip + AI intensity scores …
2:40 … close on the NASI line …
```

Reuses §1's existing Fog→Sharp wording verbatim so spoken script == doc. Nothing else in
the concept changes.

## `DEPLOY.md` (new, repo root) — shape

Sections:
1. **Build** — `npm run build` → `dist/`; `npm run preview` to smoke-test the static build.
2. **Host** — Netlify (drag `dist/` or connect repo, SPA redirect) **or** GitHub Pages
   (`base` note for project pages); match Kate's existing setup.
3. **⚠ Secrets before any public deploy** (the gate): the `vite.config.ts` `/reddit`,
   `/oura`, `/youcom` proxies are **dev/preview only** and disappear in a static build;
   `VITE_*` keys are inlined into the bundle. Move You.com + Oura behind a serverless
   function (Netlify Function / Cloudflare Worker), call that from the client, drop the
   `VITE_` keys from the deploy env. InsForge **anon** key stays client-side (RLS-protected)
   — note the admin `INSFORGE_API_KEY` must **never** ship.
4. **Checklist** — tsc clean, build succeeds, no `VITE_YOU_API_KEY`/`VITE_OURA_TOKEN` in
   `dist/` grep, diary RLS verified.

## Ordering (matters)

1. **CSS first** — relocate diary rules into `index.css`, then delete `App.css`. (Do the
   move before the delete so styling is never absent even mid-edit.)
2. **App.tsx** — add the hook + ref + `--i`. Depends on the CSS `--i`/`--i-delay` existing,
   so land the CSS stagger rule in the same pass.
3. **Typecheck/lint/boot gate** — `npx tsc -b`, `npm run lint`, dev boots. Must be clean
   before docs, so the wow is proven before writing about it.
4. **Docs** — CONCEPT §1 demo script, then `DEPLOY.md`.
5. **GIF** — boot dev server, attempt capture; else write the recipe.
6. **`npm run build`** — prove the production build compiles (AC).

## Interfaces / boundaries preserved

- `FeedItem`, `applyShield`, `tierForScore`, `TIERS`, `writeDiary/readDiary`,
  `classifyIntensity` — signatures unchanged. This ticket is presentation-layer only.
- The flip remains a pure function of `score`; the FLIP hook observes render output and
  never feeds back into state (no new render loops).
