// Finds routes that wind back on themselves: total heading change within any
// 400 m stretch above 200 deg means the path loops around an island.
import { readFileSync } from "node:fs";
import { Airport } from "../src/airport.ts";
import { plan } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";
import { graphLine, worstWinding } from "../../src/shared/test-helpers.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/rjtt.json", import.meta.url), "utf8")));
const stands = process.argv.slice(2).length ? process.argv.slice(2) : ["10", "20", "61", "68", "110", "143", "505"];

let bad = 0, total = 0;
for (const f of FLOWS) {
  for (const mode of ["arr", "dep"] as const) {
    for (const rwy of mode === "arr" ? f.arr : f.dep) {
      const points = mode === "arr" ? [undefined, ...ap.exits(rwy).map((e) => e.ref + e.side)] : [undefined];
      for (const stand of stands) for (const point of points) {
        const spot = ap.stand(stand)!;
        for (const o of plan(ap, { mode, flow: f.id, runway: rwy, stand, point })) {
          total++;
          const w = worstWinding(graphLine(o.line, mode, spot));
          if (w > 200) { bad++; console.log(`${f.id} ${mode} ${rwy} ${point ?? "auto"} spot ${stand}: ${Math.round(w)}°  ${o.summary}`); }
        }
      }
    }
  }
}
console.log(`${bad} / ${total} routes wind more than 200° within 400 m`);
