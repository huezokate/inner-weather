// Vercel serverless proxy for Reddit's public JSON. No secret — this exists to set a real
// User-Agent server-side and dodge browser CORS. NOTE: Reddit 403s many datacenter IPs
// (incl. serverless), so this lane may come back empty in prod; the client treats [] as
// "no live reddit" and the demo floor (HERO_FEED) is unaffected.
export const config = { runtime: "edge" };

const EMPTY = JSON.stringify({ data: { children: [] } });
const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const sub = (searchParams.get("sub") ?? "").replace(/[^a-zA-Z0-9_]/g, "");
  const limit = searchParams.get("limit") ?? "4";
  if (!sub) return json(EMPTY);

  try {
    const upstream = `https://www.reddit.com/r/${sub}/hot.json?limit=${encodeURIComponent(limit)}`;
    const r = await fetch(upstream, {
      headers: { "User-Agent": "inner-weather/0.1 (+https://github.com/huezokate/inner-weather)" },
    });
    if (!r.ok) return json(EMPTY);
    return json(await r.text());
  } catch {
    return json(EMPTY);
  }
}
