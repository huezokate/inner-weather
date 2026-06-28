// Vercel serverless proxy for the You.com Search API (the $1K integration).
// Keeps the key OFF the client: the browser calls /api/youcom?query=…&count=… same-origin
// (no CORS), and we inject the secret X-API-Key server-side. Mirrors the dev-only Vite proxy
// in vite.config.ts, so prod behaves like `npm run dev`. Set YOU_API_KEY in Vercel env.
export const config = { runtime: "edge" };

const EMPTY = JSON.stringify({ results: { web: [] } });
const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.YOU_API_KEY;
  if (!key) return json(EMPTY); // not configured → empty lane, demo floor holds

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";
  const count = searchParams.get("count") ?? "5";
  if (!query) return json(EMPTY);

  try {
    const upstream = `https://ydc-index.io/v1/search?query=${encodeURIComponent(
      query
    )}&count=${encodeURIComponent(count)}`;
    const r = await fetch(upstream, { headers: { "X-API-Key": key } });
    return json(await r.text(), r.ok ? 200 : r.status);
  } catch {
    return json(EMPTY);
  }
}
