// Airport data model: graph, runways, runway exits / entries.
export type XY = [number, number];
export type Group = "Dom" | "Intl" | "Cargo";

export interface RawData {
  origin: { lat: number; lon: number };
  refs: string[];
  nodes: number[];
  edges: number[];
  ways: { r: string; k: string; w: number; p: number[] }[];
  runways: RawRunway[];
  aprons: number[][];
  terminals: { n: string; p: number[] }[];
  holds: { r: string; p: XY }[];
  stands: Stand[];
}
export interface RawRunway {
  id: string;
  width: number;
  p0: XY;
  p1: XY;
  thr: Record<string, XY>;
  disp: Record<string, number>;
}
export interface Stand {
  ref: string;
  x: number;
  y: number;
  entry: number;
  path: number[];
  group: Group;
}
export interface Adj {
  to: number;
  ref: number;
  len: number;
}
/** A runway end as seen from an aircraft using it (landing or taking off). */
export interface RunwayEnd {
  ident: string;
  runway: RawRunway;
  thr: XY;
  /** unit vector in the direction of travel */
  u: XY;
  /** physical runway extent along u, measured from the threshold */
  sMin: number;
  sMax: number;
}
export interface Junction {
  pin?: XY;
  ref: string;
  node: number;
  /** along-track distance from the threshold */
  s: number;
}
export interface Leg extends Junction {
  /** next node from the turn-off point along this taxiway */
  next: number;
  side: "L" | "R";
  /** angle between the runway direction of travel and the taxiway leaving it, degrees */
  angle: number;
  /** a point on this taxiway just beyond the runway edge (map pin) */
  pin: XY;
}
export type Exit = Leg;

const CL_TOL = 14; // m from centerline to count as "on the runway"

export class Airport {
  readonly data: RawData;
  readonly xy: XY[];
  readonly adj: Adj[][];
  readonly refs: string[];
  /** node index -> runway id, for nodes lying on a runway centerline */
  readonly runwayNode = new Map<number, string>();
  private legCache = new Map<string, Leg[]>();
  /** directed edges (both directions of every segment) */
  readonly edgeFrom: number[] = [];
  readonly edgeTo: number[] = [];
  readonly edgeRef: number[] = [];
  readonly edgeLen: number[] = [];
  /** node -> outgoing directed edge ids */
  readonly out: number[][];

  constructor(data: RawData) {
    this.data = data;
    this.refs = data.refs;
    this.xy = [];
    for (let i = 0; i < data.nodes.length; i += 2) this.xy.push([data.nodes[i], data.nodes[i + 1]]);
    this.adj = this.xy.map(() => []);
    for (let i = 0; i < data.edges.length; i += 3) {
      const a = data.edges[i], b = data.edges[i + 1], r = data.edges[i + 2];
      const len = dist(this.xy[a], this.xy[b]);
      this.adj[a].push({ to: b, ref: r, len });
      this.adj[b].push({ to: a, ref: r, len });
    }
    this.out = this.xy.map(() => []);
    this.adj.forEach((list, a) => {
      for (const e of list) {
        const id = this.edgeTo.push(e.to) - 1;
        this.edgeFrom.push(a);
        this.edgeRef.push(e.ref);
        this.edgeLen.push(e.len);
        this.out[a].push(id);
      }
    });
    for (const rw of data.runways) {
      const ends = rw.id.split("/");
      const e = this.end(ends[0]);
      this.xy.forEach((p, i) => {
        if (!this.adj[i].length) return;
        const { s, d } = alongCross(e, p);
        if (Math.abs(d) < CL_TOL && s >= e.sMin - 5 && s <= e.sMax + 5) this.runwayNode.set(i, rw.id);
      });
    }
  }

  runway(ident: string): RawRunway {
    const rw = this.data.runways.find((r) => r.id.split("/").includes(ident));
    if (!rw) throw new Error(`runway ${ident}`);
    return rw;
  }

  end(ident: string): RunwayEnd {
    const runway = this.runway(ident);
    const [a, b] = runway.id.split("/");
    const other = ident === a ? b : a;
    const thr = runway.thr[ident];
    const to = runway.thr[other];
    const L = dist(thr, to);
    const u: XY = [(to[0] - thr[0]) / L, (to[1] - thr[1]) / L];
    const e: RunwayEnd = { ident, runway, thr, u, sMin: 0, sMax: L };
    const s0 = alongCross(e, runway.p0).s, s1 = alongCross(e, runway.p1).s;
    e.sMin = Math.min(s0, s1);
    e.sMax = Math.max(s0, s1);
    return e;
  }

  private legs(ident: string): Leg[] {
    const cached = this.legCache.get(ident);
    if (cached) return cached;
    const e = this.end(ident);
    const id = e.runway.id;
    const pin = e.runway.width / 2 + 35;
    const out: Leg[] = [];
    for (const [node, rw] of this.runwayNode) {
      if (rw !== id) continue;
      for (const a of this.adj[node]) {
        if (this.runwayNode.get(a.to) === id) continue;
        let ref = a.ref;
        let portal: number[] | undefined;
        if (!this.refs[ref]) {
          const found = this.unnamedPortal(node, a.to, id);
          if (!found) continue;
          ref = found.ref;
          portal = found.path;
        }
        const refName = this.refs[ref];
        if (!refName) continue;
        const chain = portal ? [node, ...portal] : [a.to, node];
        if (!portal) {
          for (let prev = a.to, cur = node; ;) {
            const nx = this.adj[cur].find((x) => x.to !== prev && x.ref === a.ref && this.runwayNode.get(x.to) === id);
            if (!nx || chain.includes(nx.to)) break;
            chain.push(nx.to);
            prev = cur;
            cur = nx.to;
          }
          chain.reverse();
        }
        const halfWidth = e.runway.width / 2;
        let ri = 0;
        while (ri < chain.length - 2 && Math.abs(alongCross(e, this.xy[chain[ri]]).d) < halfWidth) ri++;
        const root = chain[ri];
        let centre = 0;
        chain.forEach((n, i) => {
          if (i < chain.length - 1 && Math.abs(alongCross(e, this.xy[n]).d) < Math.abs(alongCross(e, this.xy[chain[centre]]).d)) centre = i;
        });
        const path = portal ? portal : this.follow(chain[chain.length - 2], a.to, a.ref, (n) => Math.abs(alongCross(e, this.xy[n]).d) >= pin, 450);
        const off = path[path.length - 1];
        const short = portal
          ? chain.slice(ri, ri + 1 + chain.slice(ri).findIndex((n) => Math.abs(alongCross(e, this.xy[n]).d) >= pin))
          : this.follow(root, chain[ri + 1], a.ref, () => false, 90);
        const pinAt = short[short.length - 1] ?? chain[ri + 1];
        const v: XY = [this.xy[off][0] - this.xy[chain[centre]][0], this.xy[off][1] - this.xy[chain[centre]][1]];
        const vl = Math.hypot(v[0], v[1]) || 1;
        const angle = (Math.acos(Math.max(-1, Math.min(1, (v[0] * e.u[0] + v[1] * e.u[1]) / vl))) * 180) / Math.PI;
        const side = e.u[0] * v[1] - e.u[1] * v[0] > 0 ? "L" : "R";
        const sAt = alongCross(e, this.xy[root]).s;
        const prevIdx = out.findIndex((x) => x.ref === refName && x.side === side && Math.abs(x.s - sAt) < 300);
        const leg: Leg = { ref: refName, side, node: root, next: chain[ri + 1], s: sAt, angle: Math.round(angle), pin: this.xy[pinAt] };
        if (prevIdx >= 0) {
          if (leg.angle < out[prevIdx].angle) out[prevIdx] = leg;
          continue;
        }
        out.push(leg);
      }
    }
    const sorted = out.sort((x, y) => x.s - y.s);
    this.legCache.set(ident, sorted);
    return sorted;
  }

  /** named taxiway reached through a short unnamed apron/runway connector */
  private unnamedPortal(start: number, first: number, runway: string): { ref: number; path: number[] } | null {
    const queue: { node: number; path: number[]; length: number }[] = [{ node: first, path: [first], length: dist(this.xy[start], this.xy[first]) }];
    const seen = new Set([start, first]);
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      if (cur.length > 250) continue;
      for (const a of this.adj[cur.node]) {
        if (this.refs[a.ref] && this.runwayNode.get(a.to) !== runway) {
          return { ref: a.ref, path: [...cur.path, a.to] };
        }
        if (this.refs[a.ref] || seen.has(a.to) || cur.length + a.len > 250) continue;
        seen.add(a.to);
        queue.push({ node: a.to, path: [...cur.path, a.to], length: cur.length + a.len });
      }
    }
    return null;
  }

  sideOf(ident: string, p: XY): "L" | "R" {
    const e = this.end(ident);
    return e.u[0] * (p[1] - e.thr[1]) - e.u[1] * (p[0] - e.thr[0]) > 0 ? "L" : "R";
  }

  junctions(ident: string): Leg[] {
    return this.legs(ident).filter((l) => 180 - l.angle <= (l.s < 300 ? 140 : 105));
  }

  exits(ident: string): Exit[] {
    return this.legs(ident).filter((l) => l.s >= 900 && l.angle <= 100);
  }

  private follow(from: number, to: number, ref: number, stop: (n: number) => boolean, maxLen: number): number[] {
    const path = [to];
    let prev = from, cur = to, acc = dist(this.xy[from], this.xy[to]);
    while (!stop(cur) && acc < maxLen) {
      const nx = this.adj[cur].find((a) => a.to !== prev && a.ref === ref);
      if (!nx) break;
      acc += nx.len;
      prev = cur;
      cur = nx.to;
      path.push(cur);
    }
    return path;
  }

  stand(ref: string): Stand | undefined {
    return this.data.stands.find((s) => s.ref === ref);
  }
}

const M_PER_DEG_LAT = 111_132;
const mPerDegLon = (lat0: number) => 111_320 * Math.cos((lat0 * Math.PI) / 180);
export function toLatLon(o: { lat: number; lon: number }, p: XY): [number, number] {
  return [o.lat + p[1] / M_PER_DEG_LAT, o.lon + p[0] / mPerDegLon(o.lat)];
}
export function toLocal(o: { lat: number; lon: number }, lat: number, lon: number): XY {
  return [(lon - o.lon) * mPerDegLon(o.lat), (lat - o.lat) * M_PER_DEG_LAT];
}

export const dist = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function alongCross(e: RunwayEnd, p: XY) {
  const dx = p[0] - e.thr[0], dy = p[1] - e.thr[1];
  return { s: dx * e.u[0] + dy * e.u[1], d: e.u[0] * dy - e.u[1] * dx };
}
