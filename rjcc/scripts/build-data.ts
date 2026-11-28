// Builds src/data/rjcc.json from
//   - data/osm-rjcc.json      (OpenStreetMap aeroway geometry, ODbL)
//   - data/navdata/RJCC.dat   (runway thresholds, extracted from X-Plane 12 Custom Data
//                              by `pnpm extract:navdata:rjcc`)
// Excludes the adjacent JASDF Chitose Air Base (RJCJ, 18L/36R & 18R/36L) west of M taxiway.
// Usage: pnpm data:rjcc
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const ORIGIN = { lat: 42.775278, lon: 141.6925 }; // RJCC ARP (earth_aptmeta.dat)

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
const cifpPath = new URL("../data/navdata/RJCC.dat", import.meta.url);
if (!existsSync(cifpPath)) throw new Error("data/navdata/RJCC.dat missing - run `pnpm extract:navdata:rjcc` first");
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
const osm = JSON.parse(readFileSync(new URL("../data/osm-rjcc.json", import.meta.url), "utf8"))
  .elements as (OsmNode | OsmWay)[];
const ways = osm.filter((e): e is OsmWay => e.type === "way");
const pts = osm.filter((e): e is OsmNode => e.type === "node");

// Military RJCJ (Chitose Air Base) taxiways lie west of M taxiway; exclude them.
const MILITARY_REFS = new Set(["C4", "C5", "C7", "E3", "E4", "E5", "E6", "E8", "E9", "W4", "W5", "W7", "NO.8", "NO.9"]);
function isCivilWay(w: OsmWay): boolean {
  const ref = (w.tags?.ref ?? "").trim();
  if (MILITARY_REFS.has(ref)) return false;
  const xs = w.geometry.map((g) => toXY(g.lat, g.lon)[0]);
  // M2..M8 run along x ≈ -1896..-1475; everything purely west of -1905 belongs to RJCJ
  if (Math.min(...xs) < -1905) return false;
  return true;
}

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
// OSM way 790936191 is the curved south-end fillet of B12 onto RWY 01R, mistagged ref=B10.
const REF_FIX: Record<number, string> = { 790936191: "B12" };
for (const w of ways) {
  const a = w.tags?.aeroway;
  if (a !== "taxiway" && a !== "taxilane") continue;
  if (!isCivilWay(w)) continue;
  const refStr = REF_FIX[w.id] ?? w.tags?.ref ?? "";
  const r = refIdx(refStr);
  const idx = w.nodes.map((id, i) => nodeOf(id, w.geometry[i].lat, w.geometry[i].lon));
  for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i - 1]) edges.push([idx[i - 1], idx[i], r]);
  drawWays.push({
    r: refStr,
    k: a,
    w: +(w.tags?.width ?? 23) || 23,
    p: idx.flatMap((i) => nodeXY[i]),
  });
}

// ---------- geometry helpers ----------
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

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

// Planarize unjoined taxiway crossings
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

// Snap named taxiway dead-ends that stop within 8 m of another taxiway node in OSM
// (fixes micro-gaps such as A8 -> D9/D10, A9 split, D1 -> K3, L3 -> K3, B10S -> B10).
{
  const adjCount = new Array(nodeXY.length).fill(0);
  const edgeMap = new Map<number, [number, number]>(); // node -> [other, ref]
  for (const [a, b, r] of edges) {
    adjCount[a]++; adjCount[b]++;
    edgeMap.set(a, [b, r]); edgeMap.set(b, [a, r]);
  }
  for (let i = 0; i < nodeXY.length; i++) {
    if (adjCount[i] !== 1) continue;
    const [other, r] = edgeMap.get(i)!;
    if (!refs[r]) continue;
    let best = -1, bd = 8;
    for (let j = 0; j < nodeXY.length; j++) {
      if (j === i || j === other) continue;
      const d = dist(nodeXY[i], nodeXY[j]);
      if (d <= bd) { bd = d; best = j; }
    }
    if (best >= 0 && !edges.some(([a, b]) => (a === i && b === best) || (a === best && b === i))) {
      edges.push([i, best, r]);
      adjCount[i]++; adjCount[best]++;
    }
  }
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
// Runway A (01L/19R, 3,000 m x 60 m): west / inboard parallel runway
// Runway B (01R/19L, 3,000 m x 60 m): east / outboard parallel runway
const RWY_PAIRS = [["01L", "19R"], ["01R", "19L"]];
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
  const width = +(ways.find((w) => w.tags?.aeroway === "runway" && w.tags.ref === `${a}/${b}` && w.tags.width)?.tags?.width ?? 60) || 60;
  return {
    id: `${a}/${b}`,
    width,
    p0: at(s0),
    p1: at(s1),
    thr: { [a]: [ta.x, ta.y], [b]: [tb.x, tb.y] } as Record<string, [number, number]>,
    disp: { [a]: ta.displacedFt, [b]: tb.displacedFt } as Record<string, number>,
  };
});

// Ensure every taxiway segment crossing a CIFP runway centerline has a node on it
for (const rw of runways) {
  const [a, b] = rw.id.split("/");
  const ta = rw.thr[a], tb = rw.thr[b];
  const ux = tb[0] - ta[0], uy = tb[1] - ta[1], L = Math.hypot(ux, uy);
  const pA: [number, number] = [rw.p0[0] - (ux / L) * 50, rw.p0[1] - (uy / L) * 50];
  const pB: [number, number] = [rw.p1[0] + (ux / L) * 50, rw.p1[1] + (uy / L) * 50];
  const deg = new Array(nodeXY.length).fill(0);
  for (const [x, y] of edges) { deg[x]++; deg[y]++; }
  const count = edges.length;
  for (let i = 0; i < count; i++) {
    const [n0, n1, r] = edges[i];
    const p = segIntersect(nodeXY[n0], nodeXY[n1], pA, pB);
    if (!p || dist(p, nodeXY[n0]) < 2 || dist(p, nodeXY[n1]) < 2) continue;
    if (deg[n0] === 1 && dist(p, nodeXY[n0]) < 25) { nodeXY[n0] = p; continue; }
    if (deg[n1] === 1 && dist(p, nodeXY[n1]) < 25) { nodeXY[n1] = p; continue; }
    const m = nodeXY.push(p) - 1;
    edges[i] = [n0, m, r];
    edges.push([m, n1, r]);
  }
}

// ---------- stands ----------
const taxiNodeIds = new Set(osmToIdx.keys());
type Stand = { ref: string; x: number; y: number; entry: number; path: number[]; group: string };
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

for (const w of ways) {
  if (w.tags?.aeroway !== "parking_position" || !w.tags.ref) continue;
  const xy = w.geometry.map((g) => toXY(g.lat, g.lon));
  if (Math.min(...xy.map((p) => p[0])) < -1905) continue;
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
  addStand({ ref: w.tags.ref.trim(), x: stop[0], y: stop[1], entry: entry!, path: line.flat(), group: "" }, sharedI >= 0 ? 4 : 3);
}

// Stand area classification:
//   Dom:    Domestic Terminal (0-27)
//   Intl:   International Terminal (63-71)
//   North:  North Remote & Overnight Apron (44-62)
//   Cargo:  Cargo Apron (80-91)
for (const s of standsByRef.values()) {
  const n = parseInt(s.ref, 10);
  if (n >= 0 && n <= 27) s.group = "Dom";
  else if (n >= 63 && n <= 79) s.group = "Intl";
  else if (n >= 44 && n <= 62) s.group = "North";
  else s.group = "Cargo";
}

// ---------- areas ----------
const poly = (w: OsmWay) => w.geometry.flatMap((g) => toXY(g.lat, g.lon));
const aprons = ways
  .filter((w) => w.tags?.aeroway === "apron" && isCivilWay(w))
  .map(poly);
const terminals = ways
  .filter((w) => (w.tags?.aeroway === "terminal" || w.tags?.building === "terminal") && isCivilWay(w))
  .map((w) => ({ n: w.tags?.["name:en"] ?? w.tags?.name ?? "", p: poly(w) }));
const holds = pts
  .filter((n) => n.tags?.aeroway === "holding_position")
  .map((n) => ({ r: n.tags?.ref ?? "", p: toXY(n.lat, n.lon) }))
  .filter((h) => h.p[0] > -1905);

const stands = [...standsByRef.values()]
  .map(({ score: _s, ...s }) => s)
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
mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/data/rjcc.json", import.meta.url), JSON.stringify(out));
const groups = stands.reduce<Record<string, string[]>>((m, s) => ((m[s.group] ??= []).push(s.ref), m), {});
console.log(`nodes ${nodeXY.length}, edges ${edges.length}, terminals ${terminals.length}, stands ${stands.length}`);
for (const [g, l] of Object.entries(groups)) console.log(g, `(${l.length})`, l.join(","));
