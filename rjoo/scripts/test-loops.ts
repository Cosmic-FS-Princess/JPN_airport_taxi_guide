// Finds routes that revisit a junction or cross themselves.
import { readFileSync } from "node:fs";
import { Airport } from "../src/airport.ts";
import { plan } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";
import { crossing, graphLine, revisit } from "../../src/shared/test-helpers.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/rjoo.json", import.meta.url), "utf8")));
const stands = process.argv.slice(2).length ? process.argv.slice(2) : ap.data.stands.map((s) => s.ref);

let bad = 0, total = 0;
for (const f of FLOWS) {
  for (const mode of ["arr", "dep"] as const) {
    for (const rwy of mode === "arr" ? f.arr : f.dep) {
      const points = mode === "arr"
        ? [undefined, ...ap.exits(rwy).map((e) => e.ref + e.side)]
        : [undefined, ...ap.junctions(rwy).map((j) => j.ref)];
      for (const stand of stands) {
        const spot = ap.stand(stand);
        if (!spot) throw new Error(`unknown stand ${stand}`);
        for (const point of points) {
          for (const o of plan(ap, { mode, flow: f.id, runway: rwy, stand, point })) {
            total++;
            const line = graphLine(o.line, mode, spot);
            const loop = revisit(line) ?? crossing(line);
            if (loop) {
              bad++;
              console.log(`${f.id} ${mode} ${rwy} ${point ?? "auto"} spot ${stand}: loop near point ${loop.at} — ${o.summary}`);
            }
          }
        }
      }
    }
  }
}
console.log(`${bad} / ${total} RJOO routes revisit or cross themselves`);
if (bad) process.exitCode = 1;
