# Deploying Inner Weather

Inner Weather is a static Vite SPA. The local demo runs fine with keys in `.env.local`, but
**a public deploy must move secrets off the client first** — read the ⚠ section before
publishing anything.

## 1. Build

```bash
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve dist/ locally to smoke-test the production build
```

`dist/` is a fully static bundle (HTML/CSS/JS) — host it anywhere static.

## 2. Host (match Kate's other projects)

**Netlify**
- Drag-and-drop `dist/` at app.netlify.com, **or** connect the repo with
  build command `npm run build` and publish directory `dist`.
- Add an SPA fallback so client routes resolve — `public/_redirects`:
  ```
  /*  /index.html  200
  ```

**GitHub Pages**
- Push `dist/` to a `gh-pages` branch (e.g. via `gh-pages` CLI or an Action).
- For a **project** page served under `/<repo>/`, set Vite's base:
  ```ts
  // vite.config.ts
  export default defineConfig({ base: "/inner-weather/", /* …plugins, server… */ })
  ```
  (A user/org page at the domain root needs no base.)

## 3. ⚠ Secrets — required before any public deploy

This is a guardrail, not a nicety. Two things break going from `npm run dev` to a public
static build:

1. **The dev proxies disappear.** `vite.config.ts` proxies `/reddit`, `/oura`, `/youcom`
   to dodge CORS. Those exist **only** in `vite dev`/`vite preview` — a static `dist/` has
   no server, so those paths 404 in production. Reddit (public JSON) and the You.com / Oura
   calls must instead go through a real backend.
2. **`VITE_`-prefixed env vars are inlined into the bundle.** Vite bakes every `VITE_*`
   value into the shipped JS. So `VITE_YOU_API_KEY` (the You.com key) and `VITE_OURA_TOKEN`
   (a personal Oura token) would be **publicly readable** in `dist/`. Do not ship them.

**Do this before publishing:**

- Move **You.com** and **Oura** behind a serverless function (Netlify Function, Cloudflare
  Worker, or similar). The function holds the key in a server-side env var and proxies the
  request; the client calls your function's URL instead of the third party. Drop
  `VITE_YOU_API_KEY` and `VITE_OURA_TOKEN` from the deploy environment entirely. This also
  solves the CORS/proxy gap from (1) in one move.
- **InsForge anon key** (`VITE_INSFORGE_ANON_KEY`, `VITE_INSFORGE_BASE_URL`) **may** stay
  client-side — the anon key is designed to be public and is gated by RLS (the `diary`
  table's `SELECT`/`INSERT` policies for `anon`). Confirm RLS is still enabled before
  deploying.
- The admin **`INSFORGE_API_KEY`** is **not** `VITE_`-prefixed, so it is never bundled —
  keep it that way. It must **never** appear in client code or the deploy env.

If You.com / Oura aren't wired to a function yet, deploy with those integrations disabled
(missing keys → the app falls back to the curated HERO_FEED + slider, which is the demo
floor and works with zero keys). The flip wow needs no live source.

## 4. Pre-deploy checklist

```bash
npx tsc -b                                   # clean
npm run build                                # succeeds
grep -rl "VITE_YOU_API_KEY\|VITE_OURA_TOKEN" dist || echo "no raw key names in bundle"
# ^ a literal-name grep is a sanity check, not proof — the *values* are what leak.
#   The real guarantee is: those VITE_ vars are absent from the deploy env (step 3).
```

Also verify the InsForge `diary` table still has RLS enabled and the anon `SELECT`/`INSERT`
policies in place (T-001-04 provisioned these).
