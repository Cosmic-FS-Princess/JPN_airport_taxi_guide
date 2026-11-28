// Builds src/data/rjbb.json from
//   - data/osm-rjbb.json      (OpenStreetMap aeroway geometry, ODbL)
//   - data/navdata/RJBB.dat   (runway thresholds, extracted from X-Plane 12 Custom Data
//                              by `npm run extract:navdata:rjbb`)
// Usage: npm run data:rjbb
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ORIGIN = { lat: 34.434167, lon: 135.232778 }; // RJBB ARP (earth_aptmeta.dat)

const M_PER_DEG_LAT = 111_132;
const M_PER_DEG_LON = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toXY = (lat: number, lon: number): [number, number] => [
  +((lon - ORIGIN.lon) * M_PER_DEG_LON).toFixed(1),
  +((lat - ORIGIN.lat) * M_PER_DEG_LAT).toFixed(1),
];

// ---------- CIFP runway thresholds ----------
type Threshold = { ident: string; x: number; y: number; displacedFt: number };
function parseDms(s: string): number {
  // N34254286 / E135122233  -> hemisphere, deg, min, sec(2 decimals)
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
const cifpPath = new URL("../data/navdata/RJBB.dat", import.meta.url);
if (!existsSync(cifpPath)) throw new Error("data/navdata/RJBB.dat missing - run `npm run extract:navdata:rjbb` first");
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
  geometry: { lat: number; lon: number }[]; tags: Record<string, string>;
};
const osm = JSON.parse(readFileSync(new URL("../data/osm-rjbb.json", import.meta.url), "utf8"))
  .elements as (OsmNode | OsmWay)[];
const ways = osm.filter((e): e is OsmWay => e.type === "way");
const pts = osm.filter((e): e is OsmNode => e.type === "node");

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
  const a = w.tags.aeroway;
  if (a !== "taxiway" && a !== "taxilane") continue;
  const r = refIdx(w.tags.ref);
  const idx = w.nodes.map((id, i) => nodeOf(id, w.geometry[i].lat, w.geometry[i].lon));
  for (let i = 1; i < idx.length; i++) if (idx[i] !== idx[i - 1]) edges.push([idx[i - 1], idx[i], r]);
  drawWays.push({
    r: w.tags.ref ?? "",
    k: a,
    w: +(w.tags.width ?? 23) || 23,
    p: idx.flatMap((i) => nodeXY[i]),
  });
}

// ---------- geometry helpers ----------
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

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
// Runway A (06R/24L) is on Island 1 (3,500 m); Runway B (06L/24R) is on Island 2 (4,000 m).
const RWY_PAIRS = [["06R", "24L"], ["06L", "24R"]];
const runways = RWY_PAIRS.map(([a, b]) => {
  const ta = thresholds.find((t) => t.ident === a)!;
  const tb = thresholds.find((t) => t.ident === b)!;
  // physical ends from OSM runway ways (thresholds may be displaced)
  const osmPts = ways
    .filter((w) => w.tags.aeroway === "runway" && w.tags.ref?.replace("-", "/") === `${a}/${b}`)
    .flatMap((w) => w.geometry.map((g) => toXY(g.lat, g.lon)));
  const ux = tb.x - ta.x, uy = tb.y - ta.y;
  const L = Math.hypot(ux, uy);
  const proj = (p: [number, number]) => ((p[0] - ta.x) * ux + (p[1] - ta.y) * uy) / L;
  const ts = osmPts.map(proj);
  const s0 = Math.min(0, ...ts), s1 = Math.max(L, ...ts);
  const at = (s: number): [number, number] => [+(ta.x + (ux * s) / L).toFixed(1), +(ta.y + (uy * s) / L).toFixed(1)];
  const width = +(ways.find((w) => w.tags.aeroway === "runway" && w.tags.ref === `${a}/${b}`)?.tags.width ?? 60) || 60;
  return {
    id: `${a}/${b}`,
    width,
    p0: at(s0), // physical end on the `a` side
    p1: at(s1),
    thr: { [a]: [ta.x, ta.y], [b]: [tb.x, tb.y] } as Record<string, [number, number]>,
    disp: { [a]: ta.displacedFt, [b]: tb.displacedFt } as Record<string, number>,
  };
});

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

// In OSM at RJBB, parking_position ways carry the curved lead-in geometry without
// ref tags, while parking_position nodes carry the stand ref and sit directly on
// those ways. Build a mini-graph of parking_position ways to trace each named
// stand back to the taxiway network.
const ppAdj = new Map<number, number[]>();
const ppXY = new Map<number, [number, number]>();
for (const w of ways) {
  if (w.tags.aeroway !== "parking_position") continue;
  for (let i = 0; i < w.nodes.length; i++) {
    const id = w.nodes[i];
    const p = toXY(w.geometry[i].lat, w.geometry[i].lon);
    ppXY.set(id, p);
    if (!ppAdj.has(id)) ppAdj.set(id, []);
    if (i > 0) {
      const prevId = w.nodes[i - 1];
      ppAdj.get(id)!.push(prevId);
      ppAdj.get(prevId)!.push(id);
    }
  }
}

function traceLeadIn(nodeId: number): { entry: number; line: [number, number][] } | null {
  if (!ppAdj.has(nodeId)) return null;
  // Dijkstra on parking_position ways from the stand node to the nearest taxiway node
  const best = new Map<number, number>([[nodeId, 0]]);
  const prev = new Map<number, number>();
  const q: { id: number; d: number }[] = [{ id: nodeId, d: 0 }];
  let hit: number | null = null;
  let hitD = Infinity;
  while (q.length) {
    q.sort((a, b) => a.d - b.d);
    const cur = q.shift()!;
    if (cur.d > (best.get(cur.id) ?? Infinity) || cur.d >= hitD) continue;
    if (taxiNodeIds.has(cur.id)) {
      hit = cur.id;
      hitD = cur.d;
      continue;
    }
    if (cur.d > 260) continue;
    const p = ppXY.get(cur.id)!;
    for (const nb of ppAdj.get(cur.id) ?? []) {
      const nd = cur.d + dist(p, ppXY.get(nb)!);
      if (nd < (best.get(nb) ?? Infinity)) {
        best.set(nb, nd);
        prev.set(nb, cur.id);
        q.push({ id: nb, d: nd });
      }
    }
  }
  if (hit === null) return null;
  // Reconstruct from taxiway entry -> stand stop position
  const line: [number, number][] = [];
  for (let cur: number | undefined = hit; cur !== undefined; cur = prev.get(cur)) {
    line.push(cur === hit ? nodeXY[osmToIdx.get(hit)!] : ppXY.get(cur)!);
  }
  return { entry: osmToIdx.get(hit)!, line };
}

// First handle any parking_position ways that carry a ref directly
for (const w of ways) {
  if (w.tags.aeroway !== "parking_position" || !w.tags.ref) continue;
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
  addStand({ ref: w.tags.ref, x: stop[0], y: stop[1], entry: entry!, path: line.flat(), group: "", src: "way" }, sharedI >= 0 ? 3 : 2);
}

for (const n of pts) {
  if (n.tags?.aeroway !== "parking_position" || !n.tags.ref) continue;
  const p = toXY(n.lat, n.lon);
  const traced = traceLeadIn(n.id);
  if (traced) {
    const stop = traced.line[traced.line.length - 1];
    addStand({ ref: n.tags.ref, x: stop[0], y: stop[1], entry: traced.entry, path: traced.line.flat(), group: "", src: "traced" }, 3);
    continue;
  }
  const entry = connect(p);
  if (entry === null) continue;
  addStand({ ref: n.tags.ref, x: p[0], y: p[1], entry, path: [...nodeXY[entry], ...p], group: "", src: "node" }, 1);
}

// Stand area classification:
//   T1: Terminal 1 (1-41, V1) and North apron / GA (601-604) on Island 1
//   T2: Terminal 2 (80-99, 99L, 99R) on Island 2
//   S:  South Cargo, Remote & Maintenance (101-111, 201-215, 306-307, M2-M9) on Island 1 South
//   N:  Island 2 Cargo / FedEx Hub (251-257) on Island 2
for (const s of standsByRef.values()) {
  const ref = s.ref;
  const n = parseInt(ref, 10);
  if (ref === "V1" || (n >= 1 && n <= 41) || (n >= 601 && n <= 699)) s.group = "T1";
  else if (n >= 80 && n <= 99) s.group = "T2";
  else if (n >= 250 && n <= 299) s.group = "N";
  else s.group = "S";
}

// ---------- areas ----------
const poly = (w: OsmWay) => w.geometry.flatMap((g) => toXY(g.lat, g.lon));
const aprons = ways.filter((w) => w.tags.aeroway === "apron").map(poly);
const terminals = ways
  .filter((w) => w.tags.aeroway === "terminal")
  .map((w) => ({ n: w.tags["name:en"] ?? w.tags.name ?? "", p: poly(w) }));
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
writeFileSync(new URL("../src/data/rjbb.json", import.meta.url), JSON.stringify(out));
const groups = stands.reduce<Record<string, string[]>>((m, s) => ((m[s.group] ??= []).push(s.ref), m), {});
console.log(`nodes ${nodeXY.length}, edges ${edges.length}, stands ${stands.length}`);
for (const [g, l] of Object.entries(groups)) console.log(g, `(${l.length})`, l.join(","));
