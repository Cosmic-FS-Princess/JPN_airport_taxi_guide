// Every stand / runway / mode must route without skipping the standard taxiways.
import { readFileSync } from "node:fs";
import { Airport, dist, type Stand, type XY } from "../src/airport.ts";
import { plan, exitKey, type PlanOption, type PlanRequest } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/rjoo.json", import.meta.url), "utf8")));
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
const refs = (o: PlanOption) => o.steps.map((s) => s.ref).filter(Boolean);
const required: Record<string, string[]> = {
  "arr:32L": ["W9"], "arr:32R": [], "arr:14L": ["B4"], "arr:14R": ["W3", "B3", "B4", "C1", "E1"],
  "dep:32L": ["E1", "C1", "B4", "B3", "B2", "W2"], "dep:32R": ["E1", "C1"],
  "dep:14L": ["C7"], "dep:14R": ["C6", "W10"],
};
const defaultExit: Record<string, string> = { "32L": "W9R", "32R": "", "14L": "B4R", "14R": "W3L" };
const defaultEntry: Record<string, string> = { "32L": "W2", "32R": "C1", "14L": "C7", "14R": "W10" };
const crossingRunways = new Set(["32L", "14R"]);

for (const f of FLOWS) {
  for (const [mode, runways] of [["arr", f.arr], ["dep", f.dep]] as const) {
    for (const runway of runways) {
      for (const stand of ap.data.stands) {
        const req: PlanRequest = { mode, flow: f.id, runway, stand: stand.ref };
        const opts = plan(ap, req);
        const label = `${mode} ${runway} spot ${stand.ref}`;
        if (!opts.length) { fail(`no route: ${label}`); continue; }
        for (const o of opts) {
          if (o.missed.length) fail(`skipped ${o.missed.join(",")}: ${label}`);
          if (o.length < 100) fail(`implausible length ${Math.round(o.length)}m: ${label}`);
          const line = graphLine(o, req, stand);
          const reversal = maxReversal(line);
          // A wide taxiway curve may reverse the net heading; a cusp may not.
          if (reversal.degrees > 130 && angle(line[reversal.at - 1], line[reversal.at], line[reversal.at + 1]) > 105) {
            fail(`reverses ${reversal.degrees.toFixed(0)}°: ${label} — ${o.summary}`);
          }
          const have = refs(o);
          for (const ref of required[`${mode}:${runway}`]) {
            if (!have.includes(ref)) fail(`missing ${ref}: ${label} — ${o.summary}`);
          }
          if (mode === "arr" && runway === "32L") {
            const gateway = parseInt(stand.ref, 10) <= 20 ? "C4" : "C5";
            if (!have.includes(gateway)) fail(`missing ${gateway}: ${label} — ${o.summary}`);
          }
          if (mode === "arr" && defaultExit[runway] && exitKey(o.exit!) !== defaultExit[runway]) fail(`wrong standard exit: ${label}`);
          if (mode === "dep" && o.entry?.ref !== defaultEntry[runway]) fail(`wrong standard entry: ${label}`);
          const crossesA = o.crossings.includes("14L/32R");
          if (crossesA !== crossingRunways.has(runway)) fail(`wrong runway crossing: ${label} — ${o.crossings.join(",") || "none"}`);
        }
      }
    }
  }
}

for (const [runway, refsWanted] of Object.entries({
  "32L": ["W4", "W6", "W8", "W9"], "32R": ["C5", "C4", "C6", "W10", "C7"],
  "14L": ["B4"], "14R": ["W7", "W5", "W3", "W2", "W1"],
})) {
  const have = new Set(ap.exits(runway).map((e) => e.ref));
  for (const ref of refsWanted) if (!have.has(ref)) fail(`missing exit ${runway} ${ref}`);
}
for (const [runway, ref] of Object.entries(defaultEntry)) {
  if (!ap.junctions(runway).some((j) => j.ref === ref)) fail(`missing entry ${runway} ${ref}`);
}

// Manual non-standard exits and entries must fall back to a usable shortest route.
for (const req of [
  { mode: "arr", flow: "N", runway: "32L", stand: "1", point: "W4R" },
  { mode: "arr", flow: "S", runway: "14R", stand: "20", point: "W5L" },
  { mode: "dep", flow: "N", runway: "32L", stand: "1", point: "W1" },
  { mode: "dep", flow: "N", runway: "32R", stand: "1", point: "B4" },
  { mode: "dep", flow: "S", runway: "14L", stand: "84", point: "C6" },
  { mode: "dep", flow: "S", runway: "14R", stand: "1", point: "W9" },
] satisfies PlanRequest[]) {
  const opts = plan(ap, req);
  if (!opts.length || opts[0].missed.length) fail(`manual selection has no clean route: ${req.mode} ${req.runway} ${req.point}`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed across ${ap.data.stands.length} stands`);
  process.exitCode = 1;
} else {
  console.log(`RJOO: all ${ap.data.stands.length} stands route cleanly on every runway in both modes`);
}
