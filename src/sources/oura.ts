// Inner Weather — Oura daily-readiness source adapter.
// Pulls the user's real readiness score so the tier reflects their actual state on
// load. Personal Access Token in VITE_OURA_TOKEN. Every fetch is error-isolated:
// any failure (missing token, network, non-2xx, bad/empty data) returns null and the
// app keeps its current score — the demo floor (HERO_FEED + slider + flip) is never
// affected because the feed only reads `score`, never Oura directly.

// Dev: Vite proxy (/oura → api.ouraring.com) dodges CORS, client sends the token. Prod: a
// same-origin Vercel function (/api/oura) injects the token server-side so it never ships in
// the bundle. See api/oura.ts and vite.config.ts.
const DEV = import.meta.env.DEV;

interface OuraReadinessEntry {
  id: string;
  day: string;
  score: number | null;
}

interface OuraReadinessResponse {
  data?: OuraReadinessEntry[];
  next_token?: string | null;
}

/** YYYY-MM-DD in UTC — granular enough for a daily readiness window. */
function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Latest daily readiness score (1–100), or null if unavailable for any reason.
 * Queries a 7-day window so a not-yet-synced morning doesn't yield an empty result,
 * then takes the most recent entry with a numeric score (Oura returns ascending days).
 */
export async function fetchOuraReadiness(): Promise<number | null> {
  // Dev needs the client token (sent through the Vite proxy); in prod the token lives only in
  // the serverless function, so an empty client token is expected there — only skip in dev.
  const token = (import.meta.env.VITE_OURA_TOKEN as string | undefined) ?? "";
  if (DEV && !token) {
    console.info("Oura: VITE_OURA_TOKEN not set — skipping, slider stays the source.");
    return null;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const qs = `start_date=${toISODate(start)}&end_date=${toISODate(end)}`;
  const url = DEV
    ? `/oura/v2/usercollection/daily_readiness?${qs}`
    : `/api/oura?${qs}`;

  try {
    const res = await fetch(url, DEV ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
    if (!res.ok) {
      console.warn(`Oura: readiness request failed (${res.status})`);
      return null;
    }
    const json = (await res.json()) as OuraReadinessResponse;
    const entries = json.data ?? [];
    // Scan from the most recent day backward for the first usable score.
    for (let i = entries.length - 1; i >= 0; i--) {
      const score = entries[i]?.score;
      if (typeof score === "number") return score;
    }
    return null;
  } catch (err) {
    console.warn("Oura: readiness fetch failed", err);
    return null;
  }
}
