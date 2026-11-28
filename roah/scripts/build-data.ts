// Builds src/data/roah.json from
//   - data/osm-roah.json      (OpenStreetMap aeroway geometry, ODbL)
//   - data/navdata/ROAH.dat   (runway thresholds, extracted from X-Plane 12 Custom Data
//                              by `npm run extract:navdata:roah`)
// Usage: npm run data:roah
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ORIGIN = { lat: 26.193333, lon: 127.639722 }; // ROAH ARP (earth_aptmeta.dat)

const M_PER_DEG_LAT = 111_132;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toXY = (lat: number, lon: number): [number, number] => [
  +((lon - ORIGIN.lon) * M_PER_DEG_LON).toFixed(1),
  +((lat - ORIGIN.lat) * M_PER_DEG_LAT).toFixed(1),
];

// ---------- CIFP runway thresholds ----------
type Threshold = { ident: string; x: number; y: number; displacedFt: number };
function parseDms(s: string): number {
  const hemi = s[0];
  const body = s.slice(1);
  const degLen = hemi === "N" || hemi === "S" ? 2 : 3;
  const deg = +body.slice(0, degLen);
  const min = +body.slice(degLen, degLen + 2);
  const sec = +body.slice(degLen + 2) / 100;
  const v = deg + min / 60 + sec / 3600;
  return hemi === "S" || hemi === "W" ? -v : v;
}
const thresholds: Threshold[] = [];
const cifpPath = new URL("../data/navdata/ROAH.dat", import.meta.url);
if (!existsSync(cifpPath)) throw new Error("data/navdata/ROAH.dat missing - run `npm run extract:navdata:roah` first");
for (const line of readFileSync(cifpPath, "utf8").split(/\r?\n/)) {
  if (!line.startsWith("RWY:")) continue;
  const [head, pos] = line.slice(4).split(";");
  const ident = head.split(",")[0].trim().replace(/^RW/, "");
  const [lat, lon, disp] = pos.split(",");
  const [x, y] = toXY(parseDms(lat.trim()), parseDms(lon.trim()));
  thresholds.push({ ident, x, y, displacedFt: +disp || 0 });
}
console.log("CIFP thresholds:", thresholds.map((t) => t.ident).join(" "));

// ---------- OSM ----------
type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> };
type OsmWay = {
  type: "way"; id: number; nodes: number[];
  geometry: { lat: number; lon: number }[]; tags?: Record<string, string>;
};
type OsmRelation = {
  type: "relation"; id: number;
  members: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[];
  tags?: Record<string, string>;
};
const osm = JSON.parse(readFileSync(new URL("../data/osm-roah.json", import.meta.url), "utf8"))
  .elements as (OsmNode | OsmWay | OsmRelation)[];
const ways = osm.filter((e): e is OsmWay => e.type === "way");
const pts = osm.filter((e): e is OsmNode => e.type === "node");
const rels = osm.filter((e): e is OsmRelation => e.type === "relation");

// Graph
const nodeXY: [number, number][] = [];
const osmToIdx = new Map<number, number>();
const refs: string[] = [""];
const refIdx = (r: string | undefined) => {
  const k = (r ?? "").trim();
  let i = refs.indexOf(k);
  if (i < 0) i = refs.push(k) - 1;
  return i;
};
type Edge = [number, number, number];
const edges: Edge[] = [];
const nodeOf = (osmId: number, lat: number, lon: number) => {
  let i = osmToIdx.get(osmId);
  if (i === undefined) {
    i = nodeXY.push(toXY(lat, lon)) - 1;
    osmToIdx.set(osmId, i);
  }
  return i;
};

const drawWays: { r: string; k: string; w: number; p: number[] }[] = [];
for (const w of ways) {
  const a = w.tags?.aeroway;
  if (a !== "taxiway" && a !== "taxilane") continue;
  const r = refIdx(w.tags?.ref);
  const idx = w.nodes.map((id, i) => nodeOf(id, w.geometry[i].lat, w.geometry[i].lon));
  for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i - 1]) edges.push([idx[i - 1], idx[i], r]);
  drawWays.push({
    r: w.tags?.ref ?? "",
    k: a,
    w: +(w.tags?.width ?? 23) || 23,
    p: idx.flatMap((i) => nodeXY[i]),
  });
}

// ---------- geometry helpers ----------
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------- planarize unjoined taxiway crossings ----------
// Several apron taxilanes at ROAH cross parallel taxiway A3/A4 or B in OSM without
// sharing a node at the junction; split both segments at their intersection.
function segIntersect(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): [number, number] | null {
  const [x1, y1] = a, [x2, y2] = b, [x3, y3] = c, [x4, y4] = d;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
  if (t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99) {
    return [+(x1 + t * (x2 - x1)).toFixed(1), +(y1 + t * (y2 - y1)).toFixed(1)];
  }
  return null;
}
for (let pass = 0; pass < 50; pass++) {
  let splitAny = false;
  for (let i = 0; i < edges.length && !splitAny; i++) {
    const [a1, b1, r1] = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const [a2, b2, r2] = edges[j];
      if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) continue;
      const p = segIntersect(nodeXY[a1], nodeXY[b1], nodeXY[a2], nodeXY[b2]);
      if (!p) continue;
      let m = nodeXY.findIndex((q) => dist(p, q) < 1.5);
      if (m < 0) m = nodeXY.push(p) - 1;
      edges[i] = [a1, m, r1];
      edges.push([m, b1, r1]);
      edges[j] = [a2, m, r2];
      edges.push([m, b2, r2]);
      splitAny = true;
      break;
    }
  }
  if (!splitAny) break;
}

// ---------- manual links ----------
const nodeAt = (p: [number, number], tol = 3) => {
  let best = -1;
  let bd = tol;
  nodeXY.forEach((q, i) => {
    const d = dist(p, q);
    if (d <= bd) {
      bd = d;
      best = i;
    }
  });
  return best;
};
const LINKS: { a: [number, number]; b: [number, number]; r?: string }[] = [];
for (const { a: p, b: q, r } of LINKS) {
  const a = nodeAt(p);
  const b = nodeAt(q);
  const joined = edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (a >= 0 && b >= 0 && a !== b && !joined) edges.push([a, b, refIdx(r)]);
}

function projectToEdges(p: [number, number]) {
  let best = { d: Infinity, e: -1, t: 0, q: [0, 0] as [number, number] };
  edges.forEach(([a, b], ei) => {
    const A = nodeXY[a], B = nodeXY[b];
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dy) / L2));
    const q: [number, number] = [A[0] + t * dx, A[1] + t * dy];
    const d = dist(p, q);
    if (d < best.d) best = { d, e: ei, t, q };
  });
  return best;
}
function splitEdgeAt(ei: number, t: number, q: [number, number]): number {
  const [a, b, r] = edges[ei];
  if (t < 0.02 || dist(q, nodeXY[a]) < 2) return a;
  if (t > 0.98 || dist(q, nodeXY[b]) < 2) return b;
  const n = nodeXY.push([+q[0].toFixed(1), +q[1].toFixed(1)]) - 1;
  edges[ei] = [a, n, r];
  edges.push([n, b, r]);
  return n;
}

// ---------- runways ----------
// Runway 1 (18L/36R, 3,000 m x 45 m) is the inboard east runway;
// Runway 2 (18R/36L, 2,700 m x 60 m) is the offshore west runway.
const RWY_PAIRS = [["18L", "36R"], ["18R", "36L"]];
const runways = RWY_PAIRS.map(([a, b]) => {
  const ta = thresholds.find((t) => t.ident === a)!;
  const tb = thresholds.find((t) => t.ident === b)!;
  const osmPts = ways
    .filter((w) => w.tags?.aeroway === "runway" && w.tags.ref?.replace("-", "/") === `${a}/${b}`)
    .flatMap((w) => w.geometry.map((g) => toXY(g.lat, g.lon)));
  const ux = tb.x - ta.x, uy = tb.y - ta.y;
  const L = Math.hypot(ux, uy);
  const proj = (p: [number, number]) => ((p[0] - ta.x) * ux + (p[1] - ta.y) * uy) / L;
  const ts = osmPts.map(proj);
  const s0 = Math.min(0, ...ts), s1 = Math.max(L, ...ts);
  const at = (s: number): [number, number] => [+(ta.x + (ux * s) / L).toFixed(1), +(ta.y + (uy * s) / L).toFixed(1)];
  const width = +(ways.find((w) => w.tags?.aeroway === "runway" && w.tags.ref === `${a}/${b}` && w.tags.width)?.tags?.width ?? 45) || 45;
  return {
    id: `${a}/${b}`,
    width,
    p0: at(s0),
    p1: at(s1),
    thr: { [a]: [ta.x, ta.y], [b]: [tb.x, tb.y] } as Record<string, [number, number]>,
    disp: { [a]: ta.displacedFt, [b]: tb.displacedFt } as Record<string, number>,
  };
});

// Ensure every taxiway segment that crosses a CIFP runway centerline has a node on
// that centerline (e.g. T7 and T9 on 18R/36L, whose OSM endpoints lie just past the
// CIFP centerline without an intermediate vertex).
for (const rw of runways) {
  const [a, b] = rw.id.split("/");
  const ta = rw.thr[a], tb = rw.thr[b];
  const cl0: [number, number] = [rw.p0[0], rw.p0[1]];
  const cl1: [number, number] = [rw.p1[0], rw.p1[1]];
  // Extend slightly past physical ends so end-around taxiways like T9 are caught
  const ux = tb[0] - ta[0], uy = tb[1] - ta[1], L = Math.hypot(ux, uy);
  const pA: [number, number] = [cl0[0] - (ux / L) * 50, cl0[1] - (uy / L) * 50];
  const pB: [number, number] = [cl1[0] + (ux / L) * 50, cl1[1] + (uy / L) * 50];
  const deg = new Array(nodeXY.length).fill(0);
  for (const [x, y] of edges) { deg[x]++; deg[y]++; }
  const count = edges.length;
  for (let i = 0; i < count; i++) {
    const [n0, n1, r] = edges[i];
    const p = segIntersect(nodeXY[n0], nodeXY[n1], pA, pB);
    if (!p || dist(p, nodeXY[n0]) < 2 || dist(p, nodeXY[n1]) < 2) continue;
    // If one end is a dead-end overshoot (< 25 m past the CIFP centerline), snap
    // that endpoint onto the centerline instead of leaving a phantom stub behind.
    if (deg[n0] === 1 && dist(p, nodeXY[n0]) < 25) { nodeXY[n0] = p; continue; }
    if (deg[n1] === 1 && dist(p, nodeXY[n1]) < 25) { nodeXY[n1] = p; continue; }
    const m = nodeXY.push(p) - 1;
    edges[i] = [n0, m, r];
    edges.push([m, n1, r]);
  }
}

// ---------- stands ----------
const taxiNodeIds = new Set(osmToIdx.keys());
type Stand = { ref: string; x: number; y: number; entry: number; path: number[]; group: string; src: string };
const standsByRef = new Map<string, Stand & { score: number }>();
const addStand = (s: Stand, score: number) => {
  const prev = standsByRef.get(s.ref);
  if (!prev || prev.score < score) standsByRef.set(s.ref, { ...s, score });
};
const connect = (p: [number, number]) => {
  const pr = projectToEdges(p);
  if (pr.d > 160) return null;
  return splitEdgeAt(pr.e, pr.t, pr.q);
};

// 1. parking_position ways (International 42L..43R & Cargo 51..66)
for (const w of ways) {
  if (w.tags?.aeroway !== "parking_position" || !w.tags.ref) continue;
  const xy = w.geometry.map((g) => toXY(g.lat, g.lon));
  const sharedI = w.nodes.findIndex((id) => taxiNodeIds.has(id));
  let entry: number | null;
  let line: [number, number][];
  if (sharedI >= 0) {
    entry = osmToIdx.get(w.nodes[sharedI])!;
    line = sharedI < w.nodes.length / 2 ? xy.slice(sharedI) : xy.slice(0, sharedI + 1).reverse();
  } else {
    const p0 = projectToEdges(xy[0]).d, p1 = projectToEdges(xy[xy.length - 1]).d;
    const ordered = p0 <= p1 ? xy : [...xy].reverse();
    entry = connect(ordered[0]);
    if (entry === null) continue;
    line = [nodeXY[entry], ...ordered];
  }
  const stop = line[line.length - 1];
  addStand({ ref: w.tags.ref, x: stop[0], y: stop[1], entry: entry!, path: line.flat(), group: "", src: "way" }, sharedI >= 0 ? 4 : 3);
}

// 2. parking_position nodes
for (const n of pts) {
  if (n.tags?.aeroway !== "parking_position" || !n.tags.ref) continue;
  if (standsByRef.has(n.tags.ref)) continue;
  const p = toXY(n.lat, n.lon);
  const entry = connect(p);
  if (entry === null) continue;
  addStand({ ref: n.tags.ref, x: p[0], y: p[1], entry, path: [...nodeXY[entry], ...p], group: "", src: "node" }, 2);
}

// 3. Passenger terminal contact stands (Domestic 21-27, 31-37 & International 41-42):
// mapped in OSM as aeroway=gate + aeroway=jet_bridge rather than parking_position.
// Pair each gate 1-to-1 with its jet bridge's aircraft-nose endpoint on the apron.
const jetBridges = ways
  .filter((w) => w.tags?.aeroway === "jet_bridge" && w.geometry.length >= 2)
  .map((w, idx) => {
    const p0 = toXY(w.geometry[0].lat, w.geometry[0].lon);
    const p1 = toXY(w.geometry[w.geometry.length - 1].lat, w.geometry[w.geometry.length - 1].lon);
    const d0 = projectToEdges(p0).d, d1 = projectToEdges(p1).d;
    return d0 <= d1 ? { idx, term: p1, nose: p0 } : { idx, term: p0, nose: p1 };
  });
const usedJb = new Set<number>();
const gateNodes = pts
  .filter((n) => n.tags?.aeroway === "gate" && n.tags.ref && n.tags.level !== "1")
  .map((n) => {
    // Normalise 42A/42B -> 42; skip 43A/43B since 43/43L/43R are already parking_position ways
    const raw = n.tags!.ref!.trim();
    const ref = raw === "42A" ? "42" : raw;
    return { ref, p: toXY(n.lat, n.lon) };
  })
  .filter((g) => /^\d+$/.test(g.ref) && !standsByRef.has(g.ref));

// Deduplicate gate refs (e.g. two boarding doors for gate 21) and pair closest gate-jb first
const uniqueGates = new Map<string, [number, number]>();
for (const g of gateNodes) if (!uniqueGates.has(g.ref)) uniqueGates.set(g.ref, g.p);
const pairs: { ref: string; gp: [number, number]; jbIdx: number; nose: [number, number]; d: number }[] = [];
for (const [ref, gp] of uniqueGates) {
  for (const jb of jetBridges) {
    pairs.push({ ref, gp, jbIdx: jb.idx, nose: jb.nose, d: dist(gp, jb.term) });
  }
}
pairs.sort((a, b) => a.d - b.d);
const matchedGates = new Set<string>();
for (const cand of pairs) {
  if (matchedGates.has(cand.ref) || usedJb.has(cand.jbIdx) || cand.d > 45) continue;
  matchedGates.add(cand.ref);
  usedJb.add(cand.jbIdx);
  const stop: [number, number] = [+cand.nose[0].toFixed(1), +cand.nose[1].toFixed(1)];
  const entry = connect(stop);
  if (entry === null) continue;
  addStand({ ref: cand.ref, x: stop[0], y: stop[1], entry, path: [...nodeXY[entry], ...stop], group: "", src: "gate" }, 1);
}

// Stand area classification:
//   Dom:   Domestic Terminal (21-37)
//   Intl:  International Terminal (41-43R)
//   Cargo: Cargo & North Apron (51-66)
for (const s of standsByRef.values()) {
  const n = parseInt(s.ref, 10);
  if (n >= 20 && n <= 39) s.group = "Dom";
  else if (n >= 40 && n <= 49) s.group = "Intl";
  else s.group = "Cargo";
}

// ---------- areas ----------
const poly = (w: OsmWay) => w.geometry.flatMap((g) => toXY(g.lat, g.lon));
const aprons = ways.filter((w) => w.tags?.aeroway === "apron").map(poly);

/** Stitch ordered or unordered outer member segments of a multipolygon relation into closed rings. */
function stitchOuterRings(rel: OsmRelation): number[][] {
  const segs = rel.members
    .filter((m) => (m.role === "outer" || m.role === "") && m.geometry && m.geometry.length >= 2)
    .map((m) => m.geometry!.map((g) => toXY(g.lat, g.lon)));
  const rings: number[][] = [];
  const used = new Array(segs.length).fill(false);
  const same = (a: [number, number], b: [number, number]) => dist(a, b) < 1.5;
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const ring = [...segs[i]];
    let progressed = true;
    while (progressed && !same(ring[0], ring[ring.length - 1])) {
      progressed = false;
      const tail = ring[ring.length - 1];
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (same(tail, segs[j][0])) {
          ring.push(...segs[j].slice(1));
          used[j] = true;
          progressed = true;
          break;
        }
        if (same(tail, segs[j][segs[j].length - 1])) {
          ring.push(...[...segs[j]].reverse().slice(1));
          used[j] = true;
          progressed = true;
          break;
        }
      }
    }
    if (ring.length >= 3) rings.push(ring.flat());
  }
  return rings;
}

const terminals: { n: string; p: number[] }[] = [
  ...ways
    .filter((w) => w.tags?.aeroway === "terminal" || w.tags?.building === "terminal")
    .map((w) => ({ n: w.tags?.["name:en"] ?? w.tags?.name ?? "", p: poly(w) })),
  ...rels
    .filter((r) => r.tags?.aeroway === "terminal" || r.tags?.building === "terminal")
    .flatMap((r) => stitchOuterRings(r).map((p) => ({ n: r.tags?.["name:en"] ?? r.tags?.name ?? "", p }))),
];
const holds = pts
  .filter((n) => n.tags?.aeroway === "holding_position")
  .map((n) => ({ r: n.tags?.ref ?? "", p: toXY(n.lat, n.lon) }));

const stands = [...standsByRef.values()]
  .map(({ score: _s, src: _src, ...s }) => s)
  .sort((a, b) => a.ref.localeCompare(b.ref, "en", { numeric: true }));

const out = {
  origin: ORIGIN,
  refs,
  nodes: nodeXY.flat(),
  edges: edges.flat(),
  ways: drawWays,
  runways,
  aprons,
  terminals,
  holds,
  stands,
};
writeFileSync(new URL("../src/data/roah.json", import.meta.url), JSON.stringify(out));
const groups = stands.reduce<Record<string, string[]>>((m, s) => ((m[s.group] ??= []).push(s.ref), m), {});
console.log(`nodes ${nodeXY.length}, edges ${edges.length}, terminals ${terminals.length}, stands ${stands.length}`);
for (const [g, l] of Object.entries(groups)) console.log(g, `(${l.length})`, l.join(","));
