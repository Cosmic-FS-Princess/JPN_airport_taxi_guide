// Every stand / runway / mode must route cleanly on RJBB without loops or sharp reversals.
import { readFileSync } from "node:fs";
import { Airport, dist, type Stand, type XY } from "../src/airport.ts";
import { plan, type PlanOption, type PlanRequest } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/rjbb.json", import.meta.url), "utf8")));
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
const defaultEntry: Record<string, string> = { "06R": "A14", "24L": "A1", "06L": "B14", "24R": "B1" };
const island2Groups = new Set(["T2", "N"]);
const island2Runways = new Set(["06L", "24R"]);

for (const f of FLOWS) {
  for (const [mode, runways] of [["arr", f.arr], ["dep", f.dep]] as const) {
    for (const runway of runways) {
      for (const stand of ap.data.stands) {
        const req: PlanRequest = { mode, flow: f.id, runway, stand: stand.ref };
        const opts = plan(ap, req);
        const label = `${mode} ${runway} spot ${stand.ref} (${stand.group})`;
        if (!opts.length) { fail(`no route: ${label}`); continue; }
        if (opts[0].missed.length) fail(`skipped ${opts[0].missed.join(",")}: ${label} — ${opts[0].summary}`);
        const needBridge = island2Groups.has(stand.group) !== island2Runways.has(runway);
        for (const o of opts) {
          if (o.length < 100) fail(`implausible length ${Math.round(o.length)}m: ${label}`);
          if (o.crossings.length) fail(`unexpected runway crossing ${o.crossings.join(",")}: ${label} — ${o.summary}`);
          const line = graphLine(o, req, stand);
          const reversal = maxReversal(line);
          if (reversal.degrees > 130 && angle(line[reversal.at - 1], line[reversal.at], line[reversal.at + 1]) > 105) {
            fail(`reverses ${reversal.degrees.toFixed(0)}°: ${label} — ${o.summary}`);
          }
          if (mode === "dep" && o.entry?.ref !== defaultEntry[runway]) {
            fail(`wrong standard entry ${o.entry?.ref}: ${label}`);
          }
          const have = refs(o);
          if (needBridge && !have.includes("J3") && !have.includes("J4")) {
            fail(`missing inter-island bridge J3/J4: ${label} — ${o.summary}`);
          }
        }
      }
    }
  }
}

for (const [runway, refsWanted] of Object.entries({
  "06R": ["A7", "A6", "A4", "A3", "A2", "A1"],
  "24L": ["A8", "A9", "A11", "A12", "A13", "A14"],
  "06L": ["B8", "B6", "B5", "B1"],
  "24R": ["B7", "B9", "B10", "B14"],
})) {
  const have = new Set(ap.exits(runway).map((e) => e.ref));
  for (const ref of refsWanted) if (!have.has(ref)) fail(`missing exit ${runway} ${ref}`);
}
for (const [runway, refsWanted] of Object.entries({
  "06R": ["A14", "A13", "A12"],
  "24L": ["A1", "A2", "A3"],
  "06L": ["B14", "B12"],
  "24R": ["B1", "B3"],
})) {
  const have = new Set(ap.junctions(runway).map((j) => j.ref));
  for (const ref of refsWanted) if (!have.has(ref)) fail(`missing entry ${runway} ${ref}`);
}

// Manual exits and intersection entries must also route cleanly.
for (const req of [
  { mode: "arr", flow: "N", runway: "06R", stand: "20", point: "A6L" },
  { mode: "arr", flow: "N", runway: "06R", stand: "88", point: "A7L" },
  { mode: "arr", flow: "S", runway: "24L", stand: "205", point: "A9R" },
  { mode: "arr", flow: "N", runway: "06L", stand: "20", point: "B6R" },
  { mode: "arr", flow: "S", runway: "24R", stand: "88", point: "B9L" },
  { mode: "dep", flow: "N", runway: "06L", stand: "20", point: "B12" },
  { mode: "dep", flow: "N", runway: "06R", stand: "20", point: "A13" },
  { mode: "dep", flow: "S", runway: "24R", stand: "88", point: "B3" },
  { mode: "dep", flow: "S", runway: "24L", stand: "20", point: "A2" },
] satisfies PlanRequest[]) {
  const opts = plan(ap, req);
  if (!opts.length) fail(`manual selection has no route: ${req.mode} ${req.runway} ${req.point}`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed across ${ap.data.stands.length} stands`);
  process.exitCode = 1;
} else {
  console.log(`RJBB: all ${ap.data.stands.length} stands route cleanly on every runway in both modes`);
}
