// Shared geometry and loop/reversal checks for airport route test scripts.
import { dist, type Stand, type XY } from "./airport.ts";

export function standPoints(s: Stand): XY[] {
  const pts: XY[] = [];
  for (let i = 0; i < s.path.length; i += 2) pts.push([s.path[i], s.path[i + 1]]);
  return pts;
}

export function graphLine(line: XY[], mode: "arr" | "dep", stand: Stand): XY[] {
  const leadIn = standPoints(stand).length - 1;
  return mode === "arr" ? line.slice(0, line.length - leadIn) : line.slice(leadIn);
}

const bearing = (a: XY, b: XY) => Math.atan2(b[0] - a[0], b[1] - a[1]);

function heading(pts: XY[], i: number, dir: 1 | -1, span: number) {
  let j = i, acc = 0;
  while (acc < span && j + dir >= 0 && j + dir < pts.length) {
    acc += dist(pts[j], pts[j + dir]);
    j += dir;
  }
  return dir === 1 ? bearing(pts[i], pts[j]) : bearing(pts[j], pts[i]);
}

export function angle(a: XY, b: XY, c: XY) {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
  const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (l < 1e-9) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / l))) * 180) / Math.PI;
}

export function maxReversal(pts: XY[]) {
  let worst = { degrees: 0, at: 0 };
  for (let i = 1; i < pts.length - 1; i++) {
    if (dist(pts[0], pts[i]) < 90 || dist(pts[i], pts[pts.length - 1]) < 90) continue;
    let d = Math.abs(((heading(pts, i, 1, 90) - heading(pts, i, -1, 90)) * 180) / Math.PI) % 360;
    if (d > 180) d = 360 - d;
    if (d > worst.degrees) worst = { degrees: d, at: i };
  }
  return worst;
}

export function worstWinding(line: XY[]): number {
  const seg: { len: number; turn: number }[] = [];
  for (let i = 1; i + 1 < line.length; i++) {
    const a = line[i - 1], b = line[i], c = line[i + 1];
    let d = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    seg.push({ len: Math.hypot(c[0] - b[0], c[1] - b[1]), turn: Math.abs((d * 180) / Math.PI) });
  }
  let worst = 0;
  for (let i = 0; i < seg.length; i++) {
    let len = 0, turn = 0;
    for (let j = i; j < seg.length && len < 400; j++) { len += seg[j].len; turn += seg[j].turn; }
    worst = Math.max(worst, turn);
  }
  return worst;
}

export function revisit(line: XY[]) {
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

export function crossing(line: XY[]) {
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
