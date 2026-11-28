// Builds the small airport diagrams shown on the chooser page.
//
// The previews use the same geometry as the guides (runways, taxiways, aprons
// and terminals from src/data/*.json) and are emitted as inline SVG snippets so
// that page CSS — including the light/dark colour variables — styles them.
//
//   node scripts/make-previews.mjs
//
// Re-run this after refreshing either airport's data via src/data/*.json.
import { readFileSync, writeFileSync } from "node:fs";

const AIRPORTS = [
  {
    key: "haneda",
    file: "haneda/src/data/rjtt.json",
    // a standard arrival drawn on the preview: 34L -> T3 stand 110
    plan: { mode: "arr", flow: "N", runway: "34L", stand: "110" },
  },
  {
    key: "narita",
    file: "narita/src/data/rjaa.json",
    // a standard arrival drawn on the preview: 16R -> T2 stand 61
    plan: { mode: "arr", flow: "S", runway: "16R", stand: "61" },
  },
  {
    key: "rjoo",
    file: "rjoo/src/data/rjoo.json",
    // a standard arrival drawn on the preview: 14R -> Spot 15
    plan: { mode: "arr", flow: "S", runway: "14R", stand: "15" },
  },
  {
    key: "rjbb",
    file: "rjbb/src/data/rjbb.json",
    // a standard departure crossing the inter-island bridge: T1 Spot 20 -> 06L
    plan: { mode: "dep", flow: "N", runway: "06L", stand: "20" },
  },
  {
    key: "roah",
    file: "roah/src/data/roah.json",
    // a standard arrival from offshore Runway 2 across Runway 1: 36L -> Spot 25
    plan: { mode: "arr", flow: "N", runway: "36L", stand: "25" },
  },
  {
    key: "rjcc",
    file: "rjcc/src/data/rjcc.json",
    // a standard arrival on Runway B across Runway A: 01R -> Domestic Spot 9
    plan: { mode: "arr", flow: "N", runway: "01R", stand: "9" },
  },
];

async function sampleRoute(key, data, request) {
  const dir = new URL(`../${key}/src/`, import.meta.url);
  const { Airport } = await import(new URL("airport.ts", dir).href);
  const { plan } = await import(new URL("plan.ts", dir).href);
  return plan(new Airport(data), request)[0]?.line ?? [];
}

const PAD = 0.03; // margin around the airport, fraction of the longer side

const round = (v) => Math.round(v * 10) / 10;

/** polyline from a flat [x, y, x, y, ...] array, dropping points closer than `min` metres */
function polyline(flat, min = 8) {
  const pts = [];
  let last = null;
  for (let i = 0; i < flat.length; i += 2) {
    const p = [flat[i], flat[i + 1]];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= min) {
      pts.push(p);
      last = p;
    }
  }
  const tail = [flat[flat.length - 2], flat[flat.length - 1]];
  if (pts.length && (pts[pts.length - 1][0] !== tail[0] || pts[pts.length - 1][1] !== tail[1])) pts.push(tail);
  return pts;
}

/** Douglas–Peucker: drop points that stay within `tol` metres of the chord */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let far = -1, farD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
      if (d > farD) { farD = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function polygon(flat) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(`${round(flat[i])},${round(flat[i + 1])}`);
  return `M${pts.join("L")}Z`;
}

function build(data, route) {
  // local frame is metres with +y pointing north; the SVG flips it so north is up
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x, y) => {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  };
  for (const w of data.ways) {
    for (let i = 0; i < w.p.length; i += 2) grow(w.p[i], w.p[i + 1]);
  }
  for (const r of data.runways) {
    for (const p of [r.p0, r.p1]) {
      grow(p[0] - r.width / 2, p[1] - r.width / 2);
      grow(p[0] + r.width / 2, p[1] + r.width / 2);
    }
  }
  for (const t of data.terminals) {
    for (let i = 0; i < t.p.length; i += 2) grow(t.p[i], t.p[i + 1]);
  }
  for (const a of data.aprons) {
    for (let i = 0; i < a.length; i += 2) grow(a[i], a[i + 1]);
  }
  for (const p of route) grow(p[0], p[1]);

  // the thumbnail crops the diagram to its 16:10 frame like a map viewport, so
  // the airport fills the card instead of floating in empty space
  const pad = Math.max(x1 - x0, y1 - y0) * PAD;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  const vx = cx - w / 2, vy = -(cy + h / 2);
  const flip = (flat) => {
    const out = new Array(flat.length);
    for (let i = 0; i < flat.length; i += 2) { out[i] = flat[i]; out[i + 1] = -flat[i + 1]; }
    return out;
  };

  const parts = [];
  parts.push(`<g class="pv-apron">${data.aprons.map((a) => `<path d="${polygon(flip(a))}"/>`).join("")}</g>`);
  parts.push(`<g class="pv-terminal">${data.terminals.map((t) => `<path d="${polygon(flip(t.p))}"/>`).join("")}</g>`);

  // one path per taxiway keeps the markup readable while the browser batches them
  const tw = data.ways.map((w2) => {
    const pts = simplify(polyline(flip(w2.p)), 6);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${Math.round(p[0])} ${Math.round(p[1])}`).join("");
    return `<path d="${d}"/>`;
  }).join("");
  parts.push(`<g class="pv-tw">${tw}</g>`);

  const rw = [], cl = [];
  for (const r of data.runways) {
    const [ax, ay] = flip([r.p0[0], r.p0[1]]);
    const [bx, by] = flip([r.p1[0], r.p1[1]]);
    rw.push(`<path class="pv-rwy" style="stroke-width:${r.width}" d="M${round(ax)} ${round(ay)}L${round(bx)} ${round(by)}"/>`);
    cl.push(`<path class="pv-cl" d="M${round(ax)} ${round(ay)}L${round(bx)} ${round(by)}"/>`);
  }
  parts.push(`<g class="pv-rwys">${rw.join("")}${cl.join("")}</g>`);

  if (route.length > 1) {
    const flat = [];
    for (const p of route) flat.push(p[0], -p[1]);
    const pts = simplify(polyline(flat), 4);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${Math.round(p[0])} ${Math.round(p[1])}`).join("");
    const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
    parts.push(`<g class="pv-route-casing"><path d="${d}"/></g>`);
    parts.push(`<g class="pv-route"><path d="${d}"/></g>`);
    parts.push(
      `<g class="pv-pin-start"><circle cx="${Math.round(sx)}" cy="${Math.round(sy)}" r="42"/></g>` +
        `<g class="pv-pin-end"><circle cx="${Math.round(ex)}" cy="${Math.round(ey)}" r="34"/></g>`,
    );
  }

  return `<svg viewBox="${round(vx)} ${round(vy)} ${round(w)} ${round(h)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${parts.join("")}</svg>`;
}

const out = {};
for (const { key, file, plan: request } of AIRPORTS) {
  const data = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  const route = await sampleRoute(key, data, request);
  out[key] = build(data, route);
  console.log(`${key}: ${(out[key].length / 1024).toFixed(0)} KB, route ${route.length} points`);
}

const banner = "// Generated by scripts/make-previews.mjs — do not edit by hand.\n";
const body = `// Airport diagrams for the chooser, inlined so theme colours apply.\nexport const PREVIEWS = {\n${AIRPORTS.map(
  ({ key }) => `  ${key}: ${JSON.stringify(out[key])},`,
).join("\n")}\n} as const;\n`;
writeFileSync(new URL("../src/previews.ts", import.meta.url), banner + body);
console.log(`wrote src/previews.ts (${((banner + body).length / 1024).toFixed(0)} KB)`);
