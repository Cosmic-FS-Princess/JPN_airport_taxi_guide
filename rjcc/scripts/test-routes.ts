// Every stand / runway / mode must route cleanly on RJCC without skipping standard taxiways or looping.
import { readFileSync } from "node:fs";
import { Airport } from "../src/airport.ts";
import { plan, type PlanRequest } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";
import { angle, graphLine, maxReversal } from "../../src/shared/test-helpers.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/rjcc.json", import.meta.url), "utf8")));

let failures = 0;
const fail = (message: string) => { failures++; console.log(`FAIL ${message}`); };
const defaultEntry: Record<string, string> = { "01L": "A12", "01R": "B12", "19R": "A2", "19L": "B3" };
const crossingRunways = new Set(["01R", "19L"]);

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
          const line = graphLine(o.line, req.mode, stand);
          const reversal = maxReversal(line);
          if (reversal.degrees > 130 && angle(line[reversal.at - 1], line[reversal.at], line[reversal.at + 1]) > 105) {
            fail(`reverses ${reversal.degrees.toFixed(0)}°: ${label} — ${o.summary}`);
          }
          if (mode === "dep" && o.entry?.ref !== defaultEntry[runway]) {
            fail(`wrong standard entry ${o.entry?.ref}: ${label}`);
          }
          const crossesA = o.crossings.includes("01L/19R");
          if (crossesA !== crossingRunways.has(runway)) {
            fail(`wrong runway crossing: ${label} — ${o.crossings.join(",") || "none"}`);
          }
        }
      }
    }
  }
}

for (const [runway, refsWanted] of Object.entries({
  "01R": ["B7", "B5", "B4", "B3"],
  "19L": ["B7", "B9", "B10", "B11", "B12"],
  "01L": ["A7", "A6", "A5", "A4", "A3", "A2"],
  "19R": ["A7", "A8", "A9", "A9S", "A10", "A11", "A12"],
})) {
  const have = new Set(ap.exits(runway).map((e) => e.ref));
  for (const ref of refsWanted) if (!have.has(ref)) fail(`missing exit ${runway} ${ref}`);
}
for (const [runway, refsWanted] of Object.entries({
  "01L": ["A12", "A11", "A10"],
  "01R": ["B12", "B11"],
  "19R": ["A2", "A1", "A3"],
  "19L": ["B3"],
})) {
  const have = new Set(ap.junctions(runway).map((j) => j.ref));
  for (const ref of refsWanted) if (!have.has(ref)) fail(`missing entry ${runway} ${ref}`);
}

// Manual exits and intersection entries must route cleanly.
for (const req of [
  { mode: "arr", flow: "N", runway: "01R", stand: "9", point: "B5L" },
  { mode: "arr", flow: "N", runway: "01L", stand: "65", point: "A5L" },
  { mode: "arr", flow: "S", runway: "19L", stand: "9", point: "B9R" },
  { mode: "arr", flow: "S", runway: "19R", stand: "83", point: "A8R" },
  { mode: "dep", flow: "N", runway: "01L", stand: "9", point: "A11" },
  { mode: "dep", flow: "N", runway: "01R", stand: "65", point: "B11" },
  { mode: "dep", flow: "S", runway: "19R", stand: "9", point: "A3" },
  { mode: "dep", flow: "S", runway: "19L", stand: "52", point: "B3" },
] satisfies PlanRequest[]) {
  const opts = plan(ap, req);
  if (!opts.length) fail(`manual selection has no route: ${req.mode} ${req.runway} ${req.point}`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed across ${ap.data.stands.length} stands`);
  process.exitCode = 1;
} else {
  console.log(`RJCC: all ${ap.data.stands.length} stands route cleanly on every runway in both modes`);
}
