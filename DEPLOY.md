# Deploying Inner Weather (Vercel)

Inner Weather is a Vite SPA **plus three serverless functions** (`api/youcom.ts`,
`api/oura.ts`, `api/reddit.ts`). The functions are the production replacement for the
dev-only Vite proxies: the browser calls `/api/*` same-origin (no CORS) and the function
injects the secret key server-side, so **no API key ever ships in the client bundle**.

## 1. Import the repo

1. Vercel → **Add New… → Project** → import `huezokate/inner-weather`.
2. **Framework Preset: Vite** (auto-detected). Build `npm run build`, output `dist`,
   install `npm install`. The `api/` directory is picked up automatically as Edge functions.

## 2. Environment variables (the important part)

Set these in **Project → Settings → Environment Variables** (all environments).
**Copy the values from your local `.env.local`** — they aren't in the repo.

| Vercel variable | Value (from `.env.local`) | Scope | Why |
|---|---|---|---|
| `YOU_API_KEY` | the value of `VITE_YOU_API_KEY` | **server only** | read by `api/youcom.ts`; **no** `VITE_` prefix so it's never bundled |
| `OURA_TOKEN` | the value of `VITE_OURA_TOKEN` | **server only** | read by `api/oura.ts`; **no** `VITE_` prefix |
| `VITE_INSFORGE_BASE_URL` | same | client (bundled) | InsForge base URL |
| `VITE_INSFORGE_ANON_KEY` | same | client (bundled) | anon key is public by design, gated by RLS |

**Do NOT set** `VITE_YOU_API_KEY` or `VITE_OURA_TOKEN` in Vercel — the `VITE_` prefix would
inline them into the public bundle. Prod uses the un-prefixed `YOU_API_KEY` / `OURA_TOKEN`
above. The admin `INSFORGE_API_KEY` is **not** needed on Vercel and must never be added to
client code or the deploy env.

## 3. Deploy

Hit **Deploy**. Every push to `main` redeploys automatically.

## 4. What works where

| Source | Local (`npm run dev`) | Vercel (prod) | Notes |
|---|---|---|---|
| Curated HERO_FEED + slider + flip | ✅ | ✅ | the demo floor, zero keys |
| You.com live lane | ✅ Vite proxy | ✅ `/api/youcom` | the $1K integration |
| Oura readiness | ✅ Vite proxy | ✅ `/api/oura` | sets the tier on load |
| InsForge weather diary | ✅ | ✅ | anon key + RLS, client-side |
| Reddit lanes | ⚠️ often 403 | ⚠️ often 403 | Reddit blocks datacenter/anon IPs; lane falls back to empty, demo floor unaffected. Candidate for a Hacker News / RSS swap. |

## 5. Pre-deploy sanity

```bash
npx tsc -b        # clean
npm run build     # succeeds → dist/
# confirm no secret VALUES are in the bundle (names alone are harmless):
grep -rl "ydc-sk-\|Bearer " dist || echo "no raw key values in bundle ✅"
```

Also confirm the InsForge `diary` table still has RLS + the anon `SELECT`/`INSERT` policies
(provisioned in T-001-04).

## Other hosts

Netlify/Cloudflare work too — the `api/` functions would need that platform's function format
(`netlify/functions/*` + `netlify.toml`, or a Worker). Vercel is the supported path here.
