// Inner Weather — InsForge diary backend (the NASI "Memory" pillar).
// Persists each settled readiness score as a `diary` row so the app remembers your
// recent inner weather. Like every source adapter here, this module is fully
// error-isolated: if the keys are missing or any call fails, it transparently falls
// back to localStorage and NEVER throws — the demo floor (HERO_FEED + slider + flip)
// is never affected because App only calls writeDiary/readDiary.

import { createClient } from "@insforge/sdk";

/** One recorded reading. `id`/`created_at` are filled by the server (or echoed back). */
export interface DiaryEntry {
  id?: string;
  created_at?: string;
  readiness: number; // 1..100, the settled Oura/slider score
  tier: string; // tier.key: "SHARP" | "PERSEVERANCE" | "FOG"
  shielded_count: number; // how many feed cards the shield hid at that moment
  overrides: string[]; // feed-item ids the user chose to un-shield
}

const baseUrl = import.meta.env.VITE_INSFORGE_BASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined;

/** True only when both env vars are present — otherwise we run on localStorage alone. */
export const insforgeConfigured = Boolean(baseUrl && anonKey);

// Created once and reused. `null` when unconfigured so we never touch the network.
const client = insforgeConfigured ? createClient({ baseUrl, anonKey }) : null;

const TABLE = "diary";
const LOCAL_KEY = "inner-weather:diary";
const LOCAL_CAP = 30;

// ── localStorage safety net ────────────────────────────────────────────────
// Used when InsForge is unconfigured or a live call fails. Best-effort: a guarded
// read/write that can't throw into the caller.

function readLocal(): DiaryEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiaryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(entry: DiaryEntry): DiaryEntry {
  // Stamp the fields the server would have filled so the strip can render immediately.
  const stored: DiaryEntry = {
    ...entry,
    id: entry.id ?? `local-${Date.now()}`,
    created_at: entry.created_at ?? new Date().toISOString(),
  };
  try {
    const next = [stored, ...readLocal()].slice(0, LOCAL_CAP);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    // Storage full / disabled — the in-memory return value still keeps the UI alive.
  }
  return stored;
}

// ── Public helpers ─────────────────────────────────────────────────────────

/**
 * Persist one reading. Writes to InsForge when configured; on any failure (or when
 * unconfigured) falls back to localStorage. Always resolves with the stored entry.
 */
export async function writeDiary(entry: DiaryEntry): Promise<DiaryEntry> {
  if (client) {
    try {
      const { data, error } = await client.database
        .from(TABLE)
        .insert([entry])
        .select();
      if (!error && data && data[0]) return data[0] as DiaryEntry;
      console.warn("InsForge: diary insert failed, using localStorage", error);
    } catch (err) {
      console.warn("InsForge: diary insert threw, using localStorage", err);
    }
  }
  return writeLocal(entry);
}

/**
 * Recent readings, newest-first. Reads from InsForge when configured; on any failure
 * (or when unconfigured) falls back to localStorage. Always resolves (never rejects).
 */
export async function readDiary(limit = 12): Promise<DiaryEntry[]> {
  if (client) {
    try {
      const { data, error } = await client.database
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!error && Array.isArray(data)) return data as DiaryEntry[];
      console.warn("InsForge: diary read failed, using localStorage", error);
    } catch (err) {
      console.warn("InsForge: diary read threw, using localStorage", err);
    }
  }
  return readLocal().slice(0, limit);
}
