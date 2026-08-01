// Ramp invariant harness (mirrors f13/scripts/f13-sanity.ts): samples the whole
// morph axis and asserts every gated text pair holds WCAG AA. Run after any
// change to src/lib/weatherRamp.ts:  npx tsx scripts/ramp-sanity.ts
import { rampVars } from "../src/lib/weatherRamp";
import { wcagContrast, formatHex } from "culori";

let worst = { pair: "", ratio: 99, t: 0 };
for (let i = 0; i <= 200; i++) {
  const t = i / 200;
  const v = rampVars(t);
  for (const [fg, bg, label] of [
    [v["--fg"], v["--bg"], "fg/bg"],
    [v["--fg"], v["--card"], "fg/card"],
    [v["--accent"], v["--bg"], "accent/bg"],
    [v["--accent"], v["--card"], "accent/card"],
  ] as const) {
    const r = wcagContrast(fg, bg);
    if (r < worst.ratio) worst = { pair: label, ratio: r, t };
  }
}
console.log(`worst pair across 201 samples: ${worst.pair} ${worst.ratio.toFixed(2)}:1 at t=${worst.t}`);
for (const t of [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1]) {
  const v = rampVars(t);
  console.log(t.toFixed(2), "bg", formatHex(v["--bg"]), "fg", formatHex(v["--fg"]), "accent", formatHex(v["--accent"]), "|", v["--bg"]);
}
if (worst.ratio < 4.5) {
  console.error("GATE BREACH — a text pair fell below AA");
  process.exit(1);
}
console.log("gate holds: every sampled frame ≥ 4.5:1");
