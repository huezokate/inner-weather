// Vercel serverless proxy for Oura daily readiness. Keeps the Personal Access Token off the
// client: the browser calls /api/oura?start_date=…&end_date=… same-origin and we inject the
// Bearer token server-side. Mirrors the dev-only Vite proxy. Set OURA_TOKEN in Vercel env.
export const config = { runtime: "edge" };

const EMPTY = JSON.stringify({ data: [] });
const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

export default async function handler(req: Request): Promise<Response> {
  const token = process.env.OURA_TOKEN;
  if (!token) return json(EMPTY);

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start_date") ?? "";
  const end = searchParams.get("end_date") ?? "";

  try {
    const upstream = `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${encodeURIComponent(
      start
    )}&end_date=${encodeURIComponent(end)}`;
    const r = await fetch(upstream, { headers: { Authorization: `Bearer ${token}` } });
    return json(await r.text(), r.ok ? 200 : r.status);
  } catch {
    return json(EMPTY);
  }
}
