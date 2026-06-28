# T-001-06 · Research — polish-and-demo

Map of the codebase as it stands going into the final polish ticket. Descriptive only:
what exists, where, and how the flip "wow" is wired today. No solutions proposed here.

## Ticket in one line

Final hackathon polish. Tune the Sharp↔Fog flip so shielded cards visibly un-blur and
reorder; craft one beautiful Fog and one beautiful Sharp state on the hero set; record
`inner-weather-flip.gif`; draft the ≤3-min demo script into `../INNER_WEATHER_CONCEPT.md`
§1; document deploy (secrets off-client). Touches `App.tsx` + `feed.ts`, so it runs last,
after T-001-04 (diary backend) and T-001-05 (AI classifier) — both landed.

## Dependency state (both satisfied)

- **T-001-04** created `src/lib/insforge.ts` (`writeDiary`/`readDiary`, localStorage net),
  the live InsForge `diary` table, and wired the diary strip + `.diary*` CSS. Its review
  reports tsc/lint/boot clean and a verified anon RLS round-trip.
- **T-001-05** created `src/lib/classify.ts` and calls `classifyIntensity(live)` inside
  `fetchLiveFeed()`. Total function — falls back to source priors on any failure.

## The morph + flip pipeline (the wow path)

The demo's wow is the Sharp↔Fog flip. It is driven by one number, `score`, and themed
entirely with CSS custom properties. Trace:

1. **`src/App.tsx`** holds `const [score, setScore] = useState(61)` (defaults to Fog so
   the calm first impression precedes the reveal). `tierForScore(score)` → `tier`.
2. An effect sets `document.documentElement.setAttribute("data-tier", tier.key)`
   (App.tsx:24–26). That single attribute swaps the whole token set.
3. **`src/index.css`** defines three atomic token blocks keyed on `[data-tier="FOG|
   PERSEVERANCE|SHARP"]` (lines 23–43): `--bg/--fg/--card/--accent*/--border*/--glow*/
   --fog-opacity/--rain-opacity/--grid-opacity`. `:root` seeds Fog defaults.
4. `--morph: 900ms cubic-bezier(0.2,0.8,0.2,1)` (index.css:17) is the shared morph
   duration. `body`, `.atmos .grid/.fog/.rain`, `.score`, `.badge`, `.flip`, `.card`,
   `.diary-chip` all `transition … var(--morph)`, so changing `data-tier` cross-fades the
   entire page in lockstep.
5. **The flip button** `flipToSharp()` (App.tsx:83–85) toggles `score` between 88 (Sharp)
   and 61 (Fog). Label flips at the 80 threshold (App.tsx:129–131). The slider
   (min 50 / max 98) is the manual override; `userTouched` ref guards against a late Oura
   response clobbering a user drag.

## How shielding + reordering work today

- **`src/feed.ts`** — `FeedItem { id, intensity 1–5, kind, title, source, emoji?, url?,
  thumbnail? }`. `HERO_FEED` is 12 hand-tagged curated items (the demo floor). `applyShield
  (items, ceiling)` maps each item to `{ ...it, shielded: it.intensity > ceiling }`.
- **`src/tiers.ts`** — `TIERS` with ceilings Fog 2 / Perseverance 3 / Sharp 5; `min`
  thresholds 50 / 70 / 80. `tierForScore` is a simple threshold ladder. **Guardrail: do
  not add tiers or change ceilings.**
- **App.tsx `items` memo (49–56)** — concatenates `[...HERO_FEED, ...live]`, then sorts:
  Sharp sorts **descending** by intensity (hot takes rise to the top), every calmer tier
  sorts **ascending** (soothing leads). Then `applyShield(sorted, tier.ceiling)`.
- **Render (158–179)** — each item is an `<article className={card + (shielded?" shielded":
  "")}>` keyed by `it.id`. Because the key is stable, React **moves** the same DOM node
  when the sort order changes rather than remounting it.

### What "un-blur and reorder" looks like in the DOM right now

On a Fog→Sharp flip two things change in the same commit:
- `data-tier` flips FOG→SHARP → the page tokens morph over 900ms.
- The `items` array re-sorts (ascending→descending) **and** ceilings rise 2→5, so the
  high-intensity cards lose their `shielded` class.

`.card.shielded` (index.css:141) is `filter: blur(7px) saturate(0.6); transform:
scale(0.97); opacity: 0.85`. `.card` transitions `filter 600ms ease, transform 600ms ease`
(index.css:133), so removing the class **animates the un-blur in place**. But the **grid
reorder is instantaneous**: the DOM node jumps to its new grid cell with no positional
animation, because CSS grid order changes are not transitionable and nothing implements a
FLIP. So today a card un-blurs smoothly but *teleports* to the top — the concept's "cards
un-blur and **rise** to the top" (CONCEPT §1) is only half-realized.

## Atmosphere layers

`.atmos` (App.tsx:93–97) is three fixed, pointer-events-none layers: `.grid` (faint
lines, opacity `--grid-opacity`), `.fog` (radial vignette, `--fog-opacity`), `.rain`
(animated `repeating-linear-gradient`, `--rain-opacity`, `rainfall` keyframe). Sharp zeroes
fog+rain and brightens the grid; Fog is heavy rain + 72% fog. All three transition opacity
on `--morph`, so the weather itself morphs on the flip.

## CSS loading — a latent bug found during research

**`src/App.css` is orphaned.** `src/main.tsx` imports only `./index.css`; `App.tsx`
imports no CSS. Nothing imports `App.css` (verified by grep). Therefore:
- The dead Vite-starter selectors in App.css (`.counter`, `.hero`, `#center`,
  `#next-steps`, `#docs`, `#spacer`, `.ticks`) are inert — harmless but noise.
- **The `.diary*` rules T-001-04 added to App.css never load.** The diary strip currently
  renders as unstyled default `<span>`s. This directly undercuts "one beautiful Fog/Sharp
  state," since the diary strip is on-screen in both. A polish-ticket concern.

## Live-source + classifier wiring (context, mostly untouched here)

`fetchLiveFeed()` (feed.ts:70–83) runs `fetchYouCom()` + `fetchReddit()` concurrently
(both total — return `[]` on failure), dedupes, caps at 20, then `classifyIntensity()`.
The whole thing is wrapped so a live failure yields `[]` and the hero set stands alone.
`vite.config.ts` proxies `/reddit`, `/oura`, `/youcom` to dodge CORS — **dev/preview
only**, which is central to the deploy/secrets AC.

## Env + secrets posture (for the deploy AC)

`.env.local` holds `VITE_YOU_API_KEY`, `VITE_OURA_TOKEN`, `VITE_INSFORGE_BASE_URL`,
`VITE_INSFORGE_ANON_KEY` (all `VITE_`-prefixed → **bundled into client JS**), plus a
non-prefixed admin `INSFORGE_API_KEY` (not bundled). For a public deploy the You.com and
Oura keys (and the proxy) must move server-side; the InsForge **anon** key is designed to
be public but relies on RLS. The dev proxies in `vite.config.ts` do not exist in a static
`vite build`, so any public build must replace them with a serverless function.

## Tooling / constraints

- Build: `npm run build` (`tsc -b && vite build`); typecheck `npx tsc -b`; lint `npm run
  lint` (oxlint). **No test runner** — verification is tsc clean + dev boots (house policy).
- React 19, Vite 8, TS ~6.0, `verbatimModuleSyntax` + `noUnusedLocals/Parameters` +
  `erasableSyntaxOnly` strict flags (type-only imports required).
- **Not a git repository** (`git rev-parse` fails). CLAUDE.md's "commit after each ticket"
  cannot be honored here; artifacts are the durable record. Note for Plan/Implement.
- GIF recording needs the `gif_creator` browser tool against a running dev server in a
  Chrome tab with the extension connected — availability is environmental, not guaranteed.

## Constraints carried into Design

- The HERO_FEED + slider + flip **must always work**; every enhancement must be additive
  and fall back to current behavior on any failure.
- Keep exactly 3 tiers, ceilings 2/3/5. Touch only `App.tsx`, `feed.ts`, CSS, the concept
  doc, and new docs. Do not regress tsc/lint/boot.
