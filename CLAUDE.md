# CLAUDE.md

## Project

inner-weather (React + Vite + TS) — a "weather forecast for your nervous system":
an Oura readiness score sets a daily *tier* (Fog / Perseverance / Sharp, ceilings 2/3/5)
that shields high-intensity content. The Sharp↔Fog flip (cards un-blur and reorder) is
the demo wow. Concept: `../INNER_WEATHER_CONCEPT.md`. Build plan: `BUILD_PLAN.md`.

### Build and Test

```bash
npm run dev        # vite dev server → localhost:5173
npm run build      # tsc -b && vite build
npx tsc -b         # typecheck only — must be clean after every ticket
npm run lint       # oxlint
```

There is no test runner; verify via `npx tsc -b` clean + dev server boots.

### Source Layout

```
src:
  App.tsx       # mounts feed, holds readiness `score` + manual slider override, renders tiers
  feed.ts       # FeedItem model, HERO_FEED (curated demo floor), REDDIT_LANES, fetchLiveFeed(), applyShield()
  tiers.ts      # the 3 tiers + ceilings
  sources/      # (created by tickets) live source adapters: oura.ts, reddit.ts, youcom.ts
  lib/          # (created by tickets) insforge.ts (DB), classify.ts (AI intensity)
```

### Guardrails (from BUILD_PLAN.md)

- The curated **HERO_FEED + slider + flip must ALWAYS work** — it's the demo floor.
  Wrap every live fetch in try/catch and fall back. Never let a live source break the demo.
- Keep exactly 3 tiers, ceilings 2 / 3 / 5. Don't add tiers.
- Read `.env.local`. If an integration's key is empty, **skip that integration and leave
  its fallback active** — do not fail the build. Currently filled & verified: You.com, Oura,
  and InsForge (base URL + anon key + admin `INSFORGE_API_KEY`) — all run live. The InsForge
  `diary` table isn't provisioned yet (T-001-04 creates it). Keep localStorage as a runtime
  safety net only.
- Public sources only — no OAuth into personal social accounts.
- After each ticket: `npx tsc -b` clean, dev boots, commit with a one-line message.

### Directory Conventions

```
docs/active/tickets/    # Ticket files (markdown with YAML frontmatter)
docs/active/stories/    # Story files (same frontmatter pattern)
docs/active/work/       # Work artifacts, one subdirectory per ticket ID
```

---

The RDSPI workflow definition is in docs/knowledge/rdspi-workflow.md and is injected into agent context by lisa automatically.
