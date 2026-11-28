// Smoke test: every flow / runway / terminal combination should route, and no
// route may double back on itself (the router is supposed to remove those).
import { readFileSync } from "node:fs";
import { Airport } from "../src/airport.ts";
import { plan, type PlanOption } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";
import { maxReversal } from "../../src/shared/test-helpers.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/rjtt.json", import.meta.url), "utf8")));
const sample = { T1: "10", T2: "61", T3: "110" } as const;

let failures = 0;
const check = (o: PlanOption, label: string) => {
  const r = maxReversal(o.line).degrees;
  if (r > 130) {
    failures++;
    console.log(`  BAD ${label}: reverses ${r.toFixed(0)}° — ${o.summary}`);
  }
};

for (const f of FLOWS) {
  for (const rwy of f.arr) {
    const exits = ap.exits(rwy);
    console.log(`\n[${f.id}] ARR ${rwy} exits: ${exits.map((e) => e.ref + e.side).join(" ")}`);
    for (const [g, ref] of Object.entries(sample)) {
      for (const p of plan(ap, { mode: "arr", flow: f.id, runway: rwy, stand: ref })) {
        console.log(`  ${g} ${ref}: ${p.summary}  ${Math.round(p.length)}m ${p.missed.length ? "MISSED " + p.missed : ""}`);
        check(p, `${f.id} ARR ${rwy} ${ref}`);
      }
    }
  }
  for (const rwy of f.dep) {
    console.log(`\n[${f.id}] DEP ${rwy} entries: ${ap.junctions(rwy).map((j) => j.ref).join(" ")}`);
    for (const [g, ref] of Object.entries(sample)) {
      for (const p of plan(ap, { mode: "dep", flow: f.id, runway: rwy, stand: ref })) {
        console.log(`  ${g} ${ref}: ${p.summary}  ${Math.round(p.length)}m ${p.missed.length ? "MISSED " + p.missed : ""}`);
        check(p, `${f.id} DEP ${rwy} ${ref}`);
      }
    }
  }
}

// L12 is the rapid exit from 34L: the clearance keeps the aircraft on L12 to
// the end of the taxiway at L (the direction of the red arrow), not across the
// shorter connector onto L11.
const l12 = plan(ap, { mode: "arr", flow: "N", runway: "34L", stand: "141", point: "L12L" })[0];
const l12refs = l12?.steps.map((s) => s.ref).filter(Boolean) ?? [];
if (!l12 || l12refs[0] !== "L12" || l12refs[1] !== "L" || l12refs.includes("L11") || l12.steps[0].length < 300) {
  failures++;
  console.log(`  BAD L12 runout: ${l12?.summary ?? "no route"}`);
}

// T3 arrivals on 34R cross 34L on A15 or A3; they are never routed down J.
const t3 = plan(ap, { mode: "arr", flow: "N", runway: "34R", stand: "114", point: "C11L" });
const t3bad = t3.find((o) => o.steps.some((s) => s.ref === "J"));
if (!t3.length || t3bad) {
  failures++;
  console.log(`  BAD T3 34R uses J: ${t3bad?.summary ?? "no route"}`);
}

if (failures) {
  console.log(`\n${failures} route(s) double back on themselves`);
  process.exitCode = 1;
}
