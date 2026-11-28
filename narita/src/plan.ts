// Turns a user selection into one routed option per published template for RJAA.
import { dist, type Airport, type Leg, type XY } from "./airport.ts";
import { ARRIVALS, DEPARTURES, LVP, templates, type FlowId, type Template } from "./procedures.ts";
import {
  buildArrivalOption,
  buildDepartureOption,
  exitKey,
  filterByStand,
  finalizeOptions,
  standLeadLine,
  type BasePlanOption,
  type BasePlanRequest,
} from "../../src/shared/plan.ts";
import { route, steps, type RouteResult, type RouterHooks } from "../../src/shared/router.ts";

export interface PlanRequest extends BasePlanRequest<FlowId> {
  /** low-visibility (CAT II/III) operations */
  lvp?: boolean;
}
export type PlanOption = BasePlanOption<Template>;
export { bestIndex, exitKey } from "../../src/shared/plan.ts";

type Gateway = { r: string; p: XY; n?: number };

// Narita-specific apron taxilane & C/K one-way pair penalties
const APRON_LOCAL = (ref: string) => ref === "T" || ref === "S" || /^T\d+$/.test(ref) || /^S\d+$/.test(ref);
const APRON_LOCAL_RADIUS = 650;
const APRON_LOCAL_PENALTY = 2.2;
const ONE_WAY_MIN_X = 700;
const ONE_WAY_PENALTY = 1.25;
const ONE_WAY_MIN_DY = 300;

const NARITA_ROUTER: RouterHooks = {
  reportAllUnusedVia: true,
  edgeMultiplier: (ap, req) => {
    const xy = ap.xy;
    const dStart = new Float64Array(xy.length);
    const dGoal = new Float64Array(xy.length);
    for (let i = 0; i < xy.length; i++) {
      dStart[i] = dist(xy[i], xy[req.start]);
      dGoal[i] = dist(xy[i], xy[req.goal]);
    }
    const oneWayPrefer = Math.abs(xy[req.goal][1] - xy[req.start][1]) >= ONE_WAY_MIN_DY
      ? (xy[req.goal][1] > xy[req.start][1] ? "C" : "K")
      : null;
    return (from, to, ref) => {
      const name = ap.refs[ref];
      let m = 1;
      if (APRON_LOCAL(name) && dStart[to] > APRON_LOCAL_RADIUS && dGoal[to] > APRON_LOCAL_RADIUS) {
        m *= APRON_LOCAL_PENALTY;
      }
      if (
        oneWayPrefer &&
        (name === "C" || name === "K") &&
        name !== oneWayPrefer &&
        (xy[from][0] + xy[to][0]) / 2 >= ONE_WAY_MIN_X &&
        dStart[to] > APRON_LOCAL_RADIUS &&
        dGoal[to] > APRON_LOCAL_RADIUS
      ) {
        m *= ONE_WAY_PENALTY;
      }
      return m;
    };
  },
};

function maxReversal(pts: XY[]): number {
  const bearing = (a: XY, b: XY) => Math.atan2(b[0] - a[0], b[1] - a[1]);
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    let j = i, acc = 0;
    while (acc < 90 && j > 0) { acc += dist(pts[j], pts[j - 1]); j--; }
    const hin = bearing(pts[j], pts[i]);
    j = i; acc = 0;
    while (acc < 90 && j < pts.length - 1) { acc += dist(pts[j], pts[j + 1]); j++; }
    const hout = bearing(pts[i], pts[j]);
    let d = Math.abs(((hout - hin) * 180) / Math.PI) % 360;
    if (d > 180) d = 360 - d;
    worst = Math.max(worst, d);
  }
  return worst;
}

function findGateway(ap: Airport, nodes: number[], mode: "arr" | "dep"): { ref: string; at: XY } | undefined {
  let best: { ref: string; at: XY } | undefined;
  let bestIdx = mode === "arr" ? -1 : Infinity;
  for (let i = 1; i < nodes.length - (mode === "arr" ? 0 : 1); i++) {
    const p = ap.xy[nodes[i]];
    for (const g of ap.data.gateways ?? []) {
      if (dist(p, g.p) > 45) continue;
      const better = mode === "arr" ? i > bestIdx : i < bestIdx;
      if (better) { bestIdx = i; best = { ref: g.r, at: g.p }; }
    }
  }
  return best;
}

export const MIN_EXIT_S = 1500;
const LIKELY_EXIT_S = 2100;

const planCaches = new WeakMap<Airport, Map<string, PlanOption[]>>();

export function plan(ap: Airport, req: PlanRequest): PlanOption[] {
  let cache = planCaches.get(ap);
  if (!cache) planCaches.set(ap, (cache = new Map()));
  const cacheKey = `${req.mode}|${req.flow}|${req.runway}|${req.stand}|${req.point ?? ""}|${req.lvp ? "lvp" : ""}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  if (req.lvp && req.runway !== LVP.runway) return [];

  const stand = ap.stand(req.stand);
  if (!stand) return [];
  const { standLine, goalDir } = standLeadLine(stand);
  const own = ap.runway(req.runway).id;
  const out: PlanOption[] = [];

  const gatewayCandidates = (from: XY) => {
    const all = (ap.data.gateways ?? []).filter((g) => g.n !== undefined);
    const near = all
      .map((g) => ({ g, d: dist(from, g.p) }))
      .filter((x) => x.d <= 1300)
      .sort((a, b) => a.d - b.d);
    const seen = new Set<string>();
    const list: typeof all = [];
    for (const { g } of near) {
      if (seen.has(g.r)) continue;
      seen.add(g.r);
      list.push(g);
      if (list.length >= 5) break;
    }
    return list.length ? list : all.slice().sort((a, b) => dist(from, a.p) - dist(from, b.p)).slice(0, 2);
  };

  const gatewaysOnPath = (nodes: number[], mode: "arr" | "dep") => {
    const hits = new Map<string, { g: Gateway; i: number }>();
    const all = (ap.data.gateways ?? []).filter((g) => g.n !== undefined);
    for (let i = 1; i < nodes.length; i++) {
      const p = ap.xy[nodes[i]];
      for (const g of all) {
        if (dist(p, g.p) > 150) continue;
        const prev = hits.get(g.r);
        if (!prev || (mode === "arr" ? i < prev.i : i > prev.i)) hits.set(g.r, { g, i });
      }
    }
    return [...hits.values()].sort((a, b) => (mode === "arr" ? a.i - b.i : b.i - a.i)).map((h) => h.g);
  };

  const gws = gatewayCandidates([stand.x, stand.y]);

  if (req.mode === "arr") {
    const exits = ap.exits(req.runway);
    const num = parseInt(stand.ref, 10);
    const north = req.runway === "34L" || req.runway === "34R";
    const avoidRefs = stand.group === "T1" && north ? ["J", "H"]
      : stand.group === "T3" && req.runway === "34R" ? ["J"]
      : stand.group === "T2" && north && ((num >= 56 && num <= 73) || (num >= 81 && num <= 84)) ? ["R"]
      : undefined;

    let list = filterByStand(templates(ARRIVALS, req.runway, stand.group, req.flow), stand.ref);
    if (stand.group === "T1" && stand.y < 0) {
      const south = list.filter((t) => !t.via.includes("K"));
      if (south.length) list = south;
    }

    for (const t of list) {
      let candidates = req.point ? exits.filter((e) => exitKey(e) === req.point) : exits.filter((e) => e.s >= MIN_EXIT_S);
      if (!req.point) {
        const endS = ap.end(req.runway).sMax;
        const usable = candidates.filter((e) => e.s <= endS - 200);
        if (usable.length) candidates = usable;
      }
      const standSide = ap.sideOf(req.runway, [stand.x, stand.y]);
      const sameSide = candidates.filter((e) => e.side === standSide);
      if (sameSide.length) candidates = sameSide;
      if (!req.point && t.side && candidates.some((e) => e.side === t.side)) candidates = candidates.filter((e) => e.side === t.side);
      if (req.lvp) {
        const lvp = candidates.filter((e) => LVP.exits.includes(e.ref));
        if (lvp.length) candidates = lvp;
      }
      if (!req.point) {
        candidates = [...candidates]
          .sort((a, b) => Math.abs(a.s - LIKELY_EXIT_S) + a.angle * 4 - (Math.abs(b.s - LIKELY_EXIT_S) + b.angle * 4))
          .slice(0, 3);
      }

      let best: PlanOption | null = null;
      const pick = (avoid?: string[]) => {
        best = null;
        let bestScore = Infinity;
        for (const exit of candidates) {
          const base = route(ap, {
            start: exit.node, firstHop: exit.next, goal: stand.entry, via: t.via, ownRunway: own,
            goalDir, avoidRefs: avoid,
          }, NARITA_ROUTER);
          if (!base) continue;

          const tried: { r: RouteResult; gw: Gateway | undefined }[] = [];
          const onPath = gatewaysOnPath(base.nodes, "arr");
          const baseClean = base.missed.length === 0 && new Set(base.nodes).size === base.nodes.length
            && maxReversal(base.nodes.map((n) => ap.xy[n])) <= 130;
          if (baseClean && onPath.length) {
            tried.push({ r: base, gw: onPath[0] });
          } else {
            const cands: Gateway[] = [];
            for (const gw of [...onPath.slice(0, 1), ...gws.slice(0, 4)]) {
              if (!cands.some((c) => c.r === gw.r)) cands.push(gw);
            }
            for (const gw of cands) {
              const r = route(ap, {
                start: exit.node, firstHop: exit.next, goal: stand.entry, via: t.via, ownRunway: own,
                goalDir, avoidRefs: avoid, mustPass: gw.n,
              }, NARITA_ROUTER);
              if (r) tried.push({ r, gw });
            }
          }
          if (!tried.length) tried.push({ r: base, gw: undefined });
          const clean = tried.filter(({ r }) =>
            new Set(r.nodes).size === r.nodes.length && maxReversal(r.nodes.map((n) => ap.xy[n])) <= 130);
          let choices = clean.length ? clean : [{ r: base, gw: undefined as Gateway | undefined }];
          const baseGw = findGateway(ap, base.nodes, "arr");
          const close = choices.filter(({ r }) => r.length <= base.length * 1.05);
          if (close.length) choices = close;
          else if (baseGw && base.missed.length === 0) choices = [{ r: base, gw: undefined }];

          for (const { r, gw } of choices) {
            const loop = new Set(r.nodes).size < r.nodes.length;
            const score = r.length + Math.max(0, exit.s - LIKELY_EXIT_S) * 2 + exit.angle * 3
              + r.missed.length * 4000 + (gw ? dist([stand.x, stand.y], gw.p) * 0.15 : 0)
              + (loop ? 1e6 : 0);
            if (best && bestScore <= score) continue;
            bestScore = score;
            const st = steps(ap, r, own);
            best = {
              ...buildArrivalOption(ap, t, exit, stand, standLine, own, r, st),
              gateway: gw
                ? { ref: gw.r, at: gw.p }
                : findGateway(ap, r.nodes, "arr") ?? (gws[0] ? { ref: gws[0].r, at: gws[0].p } : undefined),
            };
          }
        }
        if (!best) {
          for (const exit of candidates) {
            const r = route(ap, {
              start: exit.node, firstHop: exit.next, goal: stand.entry, via: t.via, ownRunway: own,
              goalDir, avoidRefs: avoid,
            }, NARITA_ROUTER);
            if (!r) continue;
            const score = r.length + Math.max(0, exit.s - LIKELY_EXIT_S) * 2 + exit.angle * 3 + r.missed.length * 4000;
            if (best && bestScore <= score) continue;
            bestScore = score;
            const st = steps(ap, r, own);
            best = {
              ...buildArrivalOption(ap, t, exit, stand, standLine, own, r, st),
              gateway: findGateway(ap, r.nodes, "arr"),
            };
          }
        }
      };
      pick(avoidRefs);
      if (!best && avoidRefs) pick(undefined);
      if (best) out.push(best);
    }
  } else {
    const junctions = ap.junctions(req.runway);
    for (const t of templates(DEPARTURES, req.runway, stand.group, req.flow)) {
      const want = req.lvp
        ? (req.point && LVP.entries.includes(req.point) ? req.point : LVP.entries[0])
        : req.point ?? t.entry;
      const entry = (want && junctions.find((j) => j.ref === want)) || junctions[0];
      if (!entry) continue;
      const base = route(ap, {
        start: stand.entry, goal: entry.node, goalFrom: (entry as Leg).next, via: t.via, ownRunway: own,
        startDir: goalDir && [-goalDir[0], -goalDir[1]],
      }, NARITA_ROUTER);
      if (!base) continue;

      const tried: { r: RouteResult; gw: Gateway | undefined }[] = [];
      const onPath = gatewaysOnPath(base.nodes, "dep");
      const baseClean = base.missed.length === 0 && new Set(base.nodes).size === base.nodes.length
        && maxReversal(base.nodes.map((n) => ap.xy[n])) <= 130;
      if (baseClean && onPath.length) {
        tried.push({ r: base, gw: onPath[0] });
      } else {
        const cands: Gateway[] = [];
        for (const gw of [...onPath.slice(0, 1), ...gws.slice(0, 4)]) {
          if (!cands.some((c) => c.r === gw.r)) cands.push(gw);
        }
        for (const gw of cands) {
          const r = route(ap, {
            start: stand.entry, goal: entry.node, goalFrom: (entry as Leg).next, via: t.via, ownRunway: own,
            startDir: goalDir && [-goalDir[0], -goalDir[1]],
            mustPass: gw.n,
          }, NARITA_ROUTER);
          if (r) tried.push({ r, gw });
        }
      }
      if (!tried.length) tried.push({ r: base, gw: undefined });
      const clean = tried.filter(({ r }) =>
        new Set(r.nodes).size === r.nodes.length && maxReversal(r.nodes.map((n) => ap.xy[n])) <= 130);
      let choices = clean.length ? clean : [{ r: base, gw: undefined as Gateway | undefined }];
      const baseGw = findGateway(ap, base.nodes, "dep");
      const close = choices.filter(({ r }) => r.length <= base.length * 1.05);
      if (close.length) choices = close;
      else if (baseGw && base.missed.length === 0) choices = [{ r: base, gw: undefined }];

      let best: PlanOption | null = null;
      let bestScore = Infinity;
      for (const { r, gw } of choices) {
        const loop = new Set(r.nodes).size < r.nodes.length;
        const score = r.length + r.missed.length * 4000 + (gw ? dist([stand.x, stand.y], gw.p) * 0.1 : 0) + (loop ? 1e6 : 0);
        if (best && bestScore <= score) continue;
        bestScore = score;
        const st = steps(ap, r, own);
        best = {
          ...buildDepartureOption(ap, t, entry, stand, standLine, req.runway, own, r, st),
          gateway: gw
            ? { ref: gw.r, at: gw.p }
            : findGateway(ap, r.nodes, "dep") ?? (gws[0] ? { ref: gws[0].r, at: gws[0].p } : undefined),
        };
      }
      if (best) out.push(best);
    }
  }

  const result = finalizeOptions(out);
  if (cache.size > 500) cache.clear();
  cache.set(cacheKey, result);
  return result;
}
