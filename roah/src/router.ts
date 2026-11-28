// Template-constrained shortest path.
import { Airport, dist, type XY } from "./airport.ts";

export interface RouteRequest {
  start: number;
  firstHop?: number;
  goal: number;
  via: string[];
  ownRunway?: string;
  goalDir?: XY;
  startDir?: XY;
  goalFrom?: number;
  avoidRefs?: string[];
}
export interface RouteResult {
  nodes: number[];
  refs: string[];
  length: number;
  missed: string[];
}

const UNNAMED = 1.35;
const OFF_TEMPLATE = 2.4;
const CROSSING = 350;
const OWN_RUNWAY = 1e6;

class Heap {
  private c: number[] = [];
  private s: number[] = [];
  cost = 0;
  state = 0;
  push(cost: number, state: number) {
    const c = this.c, s = this.s;
    let i = c.length;
    c.push(cost); s.push(state);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (c[p] <= cost) break;
      c[i] = c[p]; s[i] = s[p];
      i = p;
    }
    c[i] = cost; s[i] = state;
  }
  pop(): boolean {
    const c = this.c, s = this.s;
    if (!c.length) return false;
    this.cost = c[0]; this.state = s[0];
    const lastC = c.pop()!, lastS = s.pop()!;
    if (c.length) {
      const n = c.length;
      let i = 0;
      for (;;) {
        let m = 2 * i + 1;
        if (m >= n) break;
        if (m + 1 < n && c[m + 1] < c[m]) m++;
        if (c[m] >= lastC) break;
        c[i] = c[m]; s[i] = s[m];
        i = m;
      }
      c[i] = lastC; s[i] = lastS;
    }
    return true;
  }
}

const MAX_TURN = 105;
const TURN_COST = 2;
const TURN_ALL = 0.8;
const REF_CHANGE = 70;
const REF_CHANGE_APRON = 25;
const SKIP = 350;
const STAND_ENTRY_COST = 4;
const MISS = 4000;

const LOOP_RADIUS = 30;
const LOOP_MIN_LEN = 70;
const LOOP_HEADING = 110;

const HAIRPIN_SPAN = 150;
const HAIRPIN_ANGLE = 135;

const LOOP_TRIES = 4;

function turnDeg(a: XY, b: XY, c: XY): number {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
  const l = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (l < 1e-9) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / l))) * 180) / Math.PI;
}

function findLoop(ap: Airport, nodes: number[]): [number, number] | null {
  const p = nodes.map((n) => ap.xy[n]);
  const m = p.length;
  const cum = new Float64Array(m);
  for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + dist(p[i - 1], p[i]);
  for (let j = 3; j < m; j++) {
    for (let i = 0; i < j - 1; i++) {
      if (cum[j] - cum[i] < LOOP_MIN_LEN) continue;
      if (dist(p[i], p[j]) > LOOP_RADIUS) continue;
      let d = Math.abs(((bearing(p[j - 1], p[j]) - bearing(p[i], p[i + 1])) * 180) / Math.PI) % 360;
      if (d > 180) d = 360 - d;
      if (d > LOOP_HEADING) return [i, j];
    }
  }
  return null;
}

function findHairpin(ap: Airport, nodes: number[]): [number, number] | null {
  for (let i = 2; i < nodes.length - 2; i++) {
    const hin = headingNear(ap, nodes, i, -1, HAIRPIN_SPAN);
    const hout = headingNear(ap, nodes, i, 1, HAIRPIN_SPAN);
    let d = Math.abs(((hout - hin) * 180) / Math.PI) % 360;
    if (d > 180) d = 360 - d;
    if (d <= HAIRPIN_ANGLE) continue;
    let j = i, acc = 0;
    while (acc < HAIRPIN_SPAN && j + 1 < nodes.length) { acc += dist(ap.xy[nodes[j]], ap.xy[nodes[j + 1]]); j++; }
    return [i, j];
  }
  return null;
}

export function route(ap: Airport, req: RouteRequest): RouteResult | null {
  const n = req.via.length;
  const K = n + 1;
  const E = ap.edgeTo.length;
  const viaIdx = req.via.map((r) => ap.refs.indexOf(r));
  const avoid = req.avoidRefs ? new Set(req.avoidRefs.map((r) => ap.refs.indexOf(r))) : null;
  const xy = ap.xy;

  const nodePenalty = (node: number, from: number) => {
    if (node === req.start) return 0;
    if (node === req.goal && (req.goalFrom === undefined || from === req.goalFrom)) return 0;
    const rw = ap.runwayNode.get(node);
    if (!rw) return 0;
    return rw === req.ownRunway ? OWN_RUNWAY : CROSSING;
  };
  const step = (k: number, ref: number): [number, number, number] => {
    if (k < n && ref === viaIdx[k]) return [k + 1, 1, 0];
    if (k > 0 && ref === viaIdx[k - 1]) return [k, 1, 0];
    if (k + 1 < n && ref === viaIdx[k + 1]) return [k + 2, 1, SKIP];
    if (ref === 0) return [k, UNNAMED, 0];
    return [k, OFF_TEMPLATE, 0];
  };
  const refChange = (a: number, b: number) => (a === b ? 0 : a === 0 || b === 0 ? REF_CHANGE_APRON : REF_CHANGE);
  const goalCost = (e: number) => {
    if (!req.goalDir) return 0;
    const a = xy[ap.edgeFrom[e]], b = xy[ap.edgeTo[e]];
    const c: XY = [b[0] + req.goalDir[0], b[1] + req.goalDir[1]];
    return Math.max(0, turnDeg(a, b, c) - MAX_TURN) * STAND_ENTRY_COST;
  };

  const search = (banned: Set<number>): { edges: number[]; k: number } | null => {
    const cost = new Float64Array(E * K).fill(Infinity);
    const prev = new Int32Array(E * K).fill(-1);
    const heap = new Heap();

    const seed = (e: number) => {
      const [k, mult, extra] = step(0, ap.edgeRef[e]);
      const ang = req.startDir && ap.edgeLen[e] >= 20
        ? turnDeg([xy[req.start][0] - req.startDir[0], xy[req.start][1] - req.startDir[1]], xy[req.start], xy[ap.edgeTo[e]])
        : 0;
      const c = ap.edgeLen[e] * mult + extra + nodePenalty(ap.edgeTo[e], req.start) + Math.max(0, ang - 45) * TURN_COST;
      const s = e * K + k;
      if (c < cost[s]) { cost[s] = c; heap.push(c, s); }
    };
    if (req.firstHop !== undefined) {
      const e = ap.out[req.start].find((e) => ap.edgeTo[e] === req.firstHop);
      if (e === undefined) return null;
      seed(e);
    } else ap.out[req.start].forEach(seed);

    let best = -1, bestCost = Infinity;
    while (heap.pop()) {
      const c = heap.cost, s = heap.state;
      if (c > cost[s] || c >= bestCost) continue;
      const e = (s / K) | 0, k = s % K;
      const from = ap.edgeFrom[e], node = ap.edgeTo[e];
      if (node === req.goal && (req.goalFrom === undefined || from === req.goalFrom)) {
        const total = c + (n - k) * MISS + goalCost(e);
        if (total < bestCost) { bestCost = total; best = s; }
        continue;
      }
      for (const e2 of ap.out[node]) {
        if (banned.has(e2)) continue;
        const to = ap.edgeTo[e2];
        if (avoid?.has(ap.edgeRef[e2]) && to !== req.goal && dist(xy[to], xy[req.goal]) > 220) continue;
        if (to === from) continue;
        const ang = turnDeg(xy[from], xy[node], xy[to]);
        if (ang > MAX_TURN && ap.edgeLen[e] > 12 && ap.edgeLen[e2] > 12) continue;
        const [k2, mult, extra] = step(k, ap.edgeRef[e2]);
        const nc = c + ap.edgeLen[e2] * mult + extra + nodePenalty(to, node)
          + ang * TURN_ALL + Math.max(0, ang - 45) * TURN_COST + refChange(ap.edgeRef[e], ap.edgeRef[e2]);
        const s2 = e2 * K + k2;
        if (nc < cost[s2]) { cost[s2] = nc; prev[s2] = s; heap.push(nc, s2); }
      }
    }
    if (best < 0) return null;
    const edges: number[] = [];
    for (let s = best; s >= 0; s = prev[s]) edges.push((s / K) | 0);
    edges.reverse();
    return { edges, k: best % K };
  };

  const banned = new Set<number>();
  let found = search(banned);
  if (!found) return null;
  let result = finish(found);

  for (let tries = 0; tries < LOOP_TRIES; tries++) {
    const bad = findLoop(ap, result.nodes) ?? findHairpin(ap, result.nodes);
    if (!bad) break;
    for (let i = bad[0]; i < bad[1]; i++) banned.add(found.edges[i]);
    const next = search(banned);
    if (!next) break;
    found = next;
    result = finish(found);
  }
  return result;

  function finish(f: { edges: number[]; k: number }): RouteResult {
    const nodes = [ap.edgeFrom[f.edges[0]], ...f.edges.map((e) => ap.edgeTo[e])];
    const refs = f.edges.map((e) => ap.refs[ap.edgeRef[e]]);
    const length = f.edges.reduce((a, e) => a + ap.edgeLen[e], 0);
    return { nodes, refs, length, missed: req.via.slice(f.k) };
  }
}

export interface Step {
  ref: string;
  length: number;
  turn: "start" | "left" | "right" | "straight" | "sharp-left" | "sharp-right";
  at: XY;
  crossing?: string;
}

const bearing = (a: XY, b: XY) => Math.atan2(b[0] - a[0], b[1] - a[1]);
function headingNear(ap: Airport, nodes: number[], i: number, dir: 1 | -1, minLen = 35): number {
  const p = ap.xy[nodes[i]];
  let j = i, acc = 0;
  while (acc < minLen && j + dir >= 0 && j + dir < nodes.length) {
    acc += dist(ap.xy[nodes[j]], ap.xy[nodes[j + dir]]);
    j += dir;
  }
  return dir === 1 ? bearing(p, ap.xy[nodes[j]]) : bearing(ap.xy[nodes[j]], p);
}

export function steps(ap: Airport, r: RouteResult, ownRunway?: string): Step[] {
  const raw: { ref: string; from: number; to: number; length: number }[] = [];
  r.refs.forEach((ref, i) => {
    const len = dist(ap.xy[r.nodes[i]], ap.xy[r.nodes[i + 1]]);
    const last = raw[raw.length - 1];
    if (last && last.ref === ref) { last.to = i + 1; last.length += len; }
    else raw.push({ ref, from: i, to: i + 1, length: len });
  });
  const merged: typeof raw = [];
  for (let i = 0; i < raw.length; i++) {
    const g = raw[i];
    const prevG = merged[merged.length - 1];
    const nextG = raw[i + 1];
    const bridges = !g.ref && prevG && nextG && nextG.ref === prevG.ref;
    const sliver = g.ref && g.length < 25 && prevG && nextG;
    if (bridges || sliver || (!g.ref && g.length < 90 && prevG && (i < raw.length - 1 || prevG.ref))) {
      prevG.to = g.to; prevG.length += g.length; continue;
    }
    if (prevG && prevG.ref === g.ref) { prevG.to = g.to; prevG.length += g.length; continue; }
    merged.push({ ...g });
  }
  return merged.map((g, i) => {
    let turn: Step["turn"] = "start";
    if (i > 0) {
      const hin = headingNear(ap, r.nodes, g.from, -1);
      const hout = headingNear(ap, r.nodes, g.from, 1);
      let d = ((hout - hin) * 180) / Math.PI;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      turn = Math.abs(d) < 30 ? "straight" : d > 0
        ? (d > 120 ? "sharp-right" : "right")
        : (d < -120 ? "sharp-left" : "left");
    }
    let crossing: string | undefined;
    for (let j = g.from + 1; j <= g.to && j < r.nodes.length - 1; j++) {
      const rw = ap.runwayNode.get(r.nodes[j]);
      if (rw && rw !== ownRunway) { crossing = rw; break; }
    }
    return { ref: g.ref, length: g.length, turn, at: ap.xy[r.nodes[g.from]], crossing };
  });
}
