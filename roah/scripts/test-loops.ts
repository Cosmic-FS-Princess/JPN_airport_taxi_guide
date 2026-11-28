// Finds routes that revisit a junction or cross themselves.
import { readFileSync } from "node:fs";
import { Airport, dist, type Stand, type XY } from "../src/airport.ts";
import { plan } from "../src/plan.ts";
import { FLOWS } from "../src/procedures.ts";

const ap = new Airport(JSON.parse(readFileSync(new URL("../src/data/roah.json", import.meta.url), "utf8")));
const stands = process.argv.slice(2).length ? process.argv.slice(2) : ap.data.stands.map((s) => s.ref);

const standPoints = (s: Stand): XY[] => {
  const pts: XY[] = [];
  for (let i = 0; i < s.path.length; i += 2) pts.push([s.path[i], s.path[i + 1]]);
  return pts;
};

function graphLine(o: { line: XY[] }, mode: "arr" | "dep", stand: Stand) {
  const leadIn = standPoints(stand).length - 1;
  return mode === "arr" ? o.line.slice(0, o.line.length - leadIn) : o.line.slice(leadIn);
}

function revisit(line: XY[]) {
  const along: number[] = [0];
  for (let i = 1; i < line.length; i++) along[i] = along[i - 1] + dist(line[i - 1], line[i]);
  for (let i = 1; i < line.length; i++) {
    for (let j = i - 1; j >= 0 && along[i] - along[j] > 120; j--) {
      if (along[i] - along[j] > 120 && dist(line[i], line[j]) < 8) return { at: i, from: j };
    }
  }
  return null;
}

const orientation = (a: XY, b: XY, c: XY) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function segmentsCross(a: XY, b: XY, c: XY, d: XY) {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function crossing(line: XY[]) {
  const along: number[] = [0];
  for (let i = 1; i < line.length; i++) along[i] = along[i - 1] + dist(line[i - 1], line[i]);
  for (let i = 1; i + 1 < line.length; i++) {
    for (let j = i + 2; j + 1 < line.length; j++) {
      if (along[j] - along[i] > 120 && segmentsCross(line[i - 1], line[i], line[j], line[j + 1])) {
        return { at: i, from: j };
      }
    }
  }
  return null;
}

let bad = 0, total = 0;
for (const f of FLOWS) {
  for (const mode of ["arr", "dep"] as const) {
    for (const rwy of mode === "arr" ? f.arr : f.dep) {
      const refStand = ap.data.stands[0];
      const side = ap.sideOf(rwy, [refStand.x, refStand.y]);
      const points = mode === "arr"
        ? [undefined, ...ap.exits(rwy).filter((e) => e.side === side).map((e) => e.ref + e.side)]
        : [undefined, ...ap.junctions(rwy).filter((j) => j.side === side && j.s < (ap.end(rwy).sMax - ap.end(rwy).sMin) * 0.5).map((j) => j.ref)];
      for (const stand of stands) {
        const spot = ap.stand(stand);
        if (!spot) throw new Error(`unknown stand ${stand}`);
        for (const point of points) {
          for (const o of plan(ap, { mode, flow: f.id, runway: rwy, stand, point })) {
            total++;
            const line = graphLine(o, mode, spot);
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
console.log(`${bad} / ${total} ROAH routes revisit or cross themselves`);
if (bad) process.exitCode = 1;
