// Every stand / runway / mode must route cleanly on RJBB without loops or sharp reversals.
import { readFileSync } from "node:fs";
import { Airport } from "../src/airport.ts";
import { plan, type PlanOption, type PlanRequest } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";
import { angle, graphLine, maxReversal } from "../../src/shared/test-helpers.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/rjbb.json", import.meta.url), "utf8")));

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
          const line = graphLine(o.line, req.mode, stand);
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
