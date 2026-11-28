// Every stand / runway / mode must route cleanly on ROAH without skipping standard taxiways or looping.
import { readFileSync } from "node:fs";
import { Airport, dist, type Stand, type XY } from "../src/airport.ts";
import { plan, type PlanOption, type PlanRequest } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/roah.json", import.meta.url), "utf8")));
const standPoints = (s: Stand): XY[] => {
  const pts: XY[] = [];
  for (let i = 0; i < s.path.length; i += 2) pts.push([s.path[i], s.path[i + 1]]);
  return pts;
};
const graphLine = (o: PlanOption, req: PlanRequest, stand: Stand) => {
  const leadIn = standPoints(stand).length - 1;
  return req.mode === "arr" ? o.line.slice(0, o.line.length - leadIn) : o.line.slice(leadIn);
};

const bearing = (a: XY, b: XY) => Math.atan2(b[0] - a[0], b[1] - a[1]);
function heading(pts: XY[], i: number, dir: 1 | -1, span: number) {
  let j = i, acc = 0;
  while (acc < span && j + dir >= 0 && j + dir < pts.length) {
    acc += dist(pts[j], pts[j + dir]);
    j += dir;
  }
  return dir === 1 ? bearing(pts[i], pts[j]) : bearing(pts[j], pts[i]);
}
function angle(a: XY, b: XY, c: XY) {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
  const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (l < 1e-9) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / l))) * 180) / Math.PI;
}
function maxReversal(pts: XY[]) {
  let worst = { degrees: 0, at: 0 };
  for (let i = 1; i < pts.length - 1; i++) {
    if (dist(pts[0], pts[i]) < 90 || dist(pts[i], pts[pts.length - 1]) < 90) continue;
    let d = Math.abs(((heading(pts, i, 1, 90) - heading(pts, i, -1, 90)) * 180) / Math.PI) % 360;
    if (d > 180) d = 360 - d;
    if (d > worst.degrees) worst = { degrees: d, at: i };
  }
  return worst;
}

let failures = 0;
const fail = (message: string) => { failures++; console.log(`FAIL ${message}`); };
const defaultEntry: Record<string, string> = { "18L": "E1", "36R": "E10", "18R": "T1", "36L": "T9" };
const crossingRunways = new Set(["18R", "36L"]);

for (const f of FLOWS) {
  for (const [mode, runways] of [["arr", f.arr], ["dep", f.dep]] as const) {
    for (const runway of runways) {
      for (const stand of ap.data.stands) {
        const req: PlanRequest = { mode, flow: f.id, runway, stand: stand.ref };
        const opts = plan(ap, req);
        const label = `${mode} ${runway} spot ${stand.ref} (${stand.group})`;
        if (!opts.length) { fail(`no route: ${label}`); continue; }
        if (opts[0].missed.length) fail(`skipped ${opts[0].missed.join(",")}: ${label} — ${opts[0].summary}`);
        for (const o of opts) {
          if (o.length < 100) fail(`implausible length ${Math.round(o.length)}m: ${label}`);
          const line = graphLine(o, req, stand);
          const reversal = maxReversal(line);
          if (reversal.degrees > 130 && angle(line[reversal.at - 1], line[reversal.at], line[reversal.at + 1]) > 105) {
            fail(`reverses ${reversal.degrees.toFixed(0)}°: ${label} — ${o.summary}`);
          }
          if (mode === "dep" && o.entry?.ref !== defaultEntry[runway]) {
            fail(`wrong standard entry ${o.entry?.ref}: ${label}`);
          }
          const crosses1 = o.crossings.includes("18L/36R");
          if (crosses1 !== crossingRunways.has(runway)) {
            fail(`wrong runway crossing: ${label} — ${o.crossings.join(",") || "none"}`);
          }
        }
      }
    }
  }
}

for (const [runway, refsWanted] of Object.entries({
  "36L": ["T4", "T3", "T1"],
  "18R": ["T5", "T6", "T7", "T8", "T9"],
  "36R": ["E5", "E4", "E3", "E2", "E1"],
  "18L": ["E6", "E7", "E8", "E8S", "E9", "E10"],
})) {
  const have = new Set(ap.exits(runway).map((e) => e.ref));
  for (const ref of refsWanted) if (!have.has(ref)) fail(`missing exit ${runway} ${ref}`);
}
for (const [runway, refsWanted] of Object.entries({
  "36R": ["E10", "E9", "E8"],
  "18L": ["E1", "E2", "E3"],
  "36L": ["T9", "T8", "T7"],
  "18R": ["T1", "T2", "T3"],
})) {
  const have = new Set(ap.junctions(runway).map((j) => j.ref));
  for (const ref of refsWanted) if (!have.has(ref)) fail(`missing entry ${runway} ${ref}`);
}

// Manual exits and intersection entries must route cleanly.
for (const req of [
  { mode: "arr", flow: "N", runway: "36L", stand: "25", point: "T3R" },
  { mode: "arr", flow: "N", runway: "36R", stand: "35", point: "E4R" },
  { mode: "arr", flow: "S", runway: "18R", stand: "42", point: "T6L" },
  { mode: "arr", flow: "S", runway: "18L", stand: "62", point: "E8L" },
  { mode: "dep", flow: "N", runway: "36R", stand: "25", point: "E9" },
  { mode: "dep", flow: "N", runway: "36L", stand: "25", point: "T8" },
  { mode: "dep", flow: "S", runway: "18L", stand: "25", point: "E3" },
  { mode: "dep", flow: "S", runway: "18R", stand: "25", point: "T2" },
] satisfies PlanRequest[]) {
  const opts = plan(ap, req);
  if (!opts.length) fail(`manual selection has no route: ${req.mode} ${req.runway} ${req.point}`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed across ${ap.data.stands.length} stands`);
  process.exitCode = 1;
} else {
  console.log(`ROAH: all ${ap.data.stands.length} stands route cleanly on every runway in both modes`);
}
