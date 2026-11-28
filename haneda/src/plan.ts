// Turns a user selection into one routed option per published template for RJTT.
import { dist, type Airport, type Exit, type Leg } from "./airport.ts";
import { ARRIVALS, DEPARTURES, EXIT_RUNOUT, templates, type FlowId, type Template } from "./procedures.ts";
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
import { route, steps, type RouteResult } from "../../src/shared/router.ts";

export type PlanRequest = BasePlanRequest<FlowId>;
export type PlanOption = BasePlanOption<Template>;
export { bestIndex, exitKey } from "../../src/shared/plan.ts";

export const MIN_EXIT_S = 1500;
const LIKELY_EXIT_S = 2100;

interface Runout {
  nodes: number[];
  length: number;
}

/**
 * The stretch of an exit taxiway that still has to be taxied after vacating,
 * from the turn-off point to the node where the taxiway ends at another named
 * taxiway (e.g. rapid exit L12 on 34L).
 */
function exitRunouts(ap: Airport, exit: Exit): Runout[] {
  const out: Runout[] = [];
  const seen = new Set([exit.node, exit.next]);
  const walk = (nodes: number[], length: number) => {
    const cur = nodes[nodes.length - 1];
    const prev = nodes[nodes.length - 2];
    const nexts = ap.adj[cur].filter((a) => a.to !== prev && !seen.has(a.to));
    const same = nexts.filter((a) => ap.refs[a.ref] === exit.ref);
    if (!same.length && nexts.some((a) => a.ref !== 0 && ap.refs[a.ref] !== exit.ref)) {
      out.push({ nodes: [...nodes], length });
    }
    for (const a of same) {
      if (length + a.len > 1500) continue;
      seen.add(a.to);
      walk([...nodes, a.to], length + a.len);
      seen.delete(a.to);
    }
  };
  walk([exit.node, exit.next], dist(ap.xy[exit.node], ap.xy[exit.next]));
  return out;
}

export function plan(ap: Airport, req: PlanRequest): PlanOption[] {
  const stand = ap.stand(req.stand);
  if (!stand) return [];
  const { standLine, goalDir } = standLeadLine(stand);
  const own = ap.runway(req.runway).id;
  const out: PlanOption[] = [];

  if (req.mode === "arr") {
    const exits = ap.exits(req.runway);
    const num = parseInt(stand.ref, 10);
    const north = req.runway === "34L" || req.runway === "34R";
    const avoidRefs = stand.group === "T1" && north ? ["J", "H"]
      : stand.group === "T3" && req.runway === "34R" ? ["J"]
      : stand.group === "T2" && north && ((num >= 56 && num <= 73) || (num >= 81 && num <= 84)) ? ["R"]
      : undefined;

    const direct = new Map<string, RouteResult | null>();
    const directRoute = (exit: Exit, avoid?: string[]) => {
      const key = `${exit.node}|${avoid ? avoid.join(",") : ""}`;
      if (!direct.has(key)) {
        direct.set(key, route(ap, { start: exit.node, firstHop: exit.next, goal: stand.entry, via: [], ownRunway: own, goalDir, avoidRefs: avoid }));
      }
      return direct.get(key) ?? null;
    };

    let list = filterByStand(templates(ARRIVALS, req.runway, stand.group, req.flow), stand.ref);
    if (stand.group === "T1" && stand.y < 0) {
      const south = list.filter((t) => !t.via.includes("K"));
      if (south.length) list = south;
    }

    for (const t of list) {
      let candidates = req.point ? exits.filter((e) => exitKey(e) === req.point) : exits.filter((e) => e.s >= MIN_EXIT_S);
      const standSide = ap.sideOf(req.runway, [stand.x, stand.y]);
      const sameSide = candidates.filter((e) => e.side === standSide);
      if (sameSide.length) candidates = sameSide;
      if (!req.point && t.side && candidates.some((e) => e.side === t.side)) candidates = candidates.filter((e) => e.side === t.side);
      let best: PlanOption | null = null;

      const pick = (avoid?: string[]) => {
        best = null;
        let bestScore = Infinity;
        for (const exit of candidates) {
          let use: RouteResult | null = null;
          let missed: string[] = [];
          const runs = EXIT_RUNOUT.has(exit.ref) ? exitRunouts(ap, exit) : [];
          for (const run of runs) {
            const end = run.nodes[run.nodes.length - 1];
            const r = route(ap, { start: end, goal: stand.entry, via: t.via, ownRunway: own, goalDir, avoidRefs: avoid });
            if (!r) continue;
            const combined: RouteResult = {
              nodes: [...run.nodes, ...r.nodes.slice(1)],
              refs: [...Array(run.nodes.length - 1).fill(exit.ref), ...r.refs],
              length: run.length + r.length,
              missed: r.missed,
            };
            if (!use || combined.length < use.length) use = combined;
          }
          if (use) {
            missed = use.missed;
          } else {
            const r = route(ap, { start: exit.node, firstHop: exit.next, goal: stand.entry, via: t.via, ownRunway: own, goalDir, avoidRefs: avoid });
            if (!r) continue;
            const d = directRoute(exit, avoid);
            const chosen: RouteResult = t.strict || !d || r.length <= d.length * 1.2 ? r : d;
            use = chosen;
            missed = chosen === d ? t.via.filter((v) => !chosen.refs.includes(v)) : r.missed;
          }
          if (!use) continue;
          const score = use.length + Math.max(0, exit.s - LIKELY_EXIT_S) * 2 + exit.angle * 3 + missed.length * 4000;
          if (best && bestScore <= score) continue;
          bestScore = score;
          const st = steps(ap, use, own);
          best = buildArrivalOption(ap, t, exit, stand, standLine, own, use, st, missed);
        }
      };
      pick(avoidRefs);
      if (!best && avoidRefs) pick(undefined);
      if (best) out.push(best);
    }
  } else {
    const junctions = ap.junctions(req.runway);
    for (const t of templates(DEPARTURES, req.runway, stand.group, req.flow)) {
      const want = req.point ?? t.entry;
      const entry = (want && junctions.find((j) => j.ref === want)) || junctions[0];
      if (!entry) continue;
      const r = route(ap, {
        start: stand.entry, goal: entry.node, goalFrom: (entry as Leg).next, via: t.via, ownRunway: own,
        startDir: goalDir && [-goalDir[0], -goalDir[1]],
      });
      if (!r) continue;
      const st = steps(ap, r, own);
      out.push(buildDepartureOption(ap, t, entry, stand, standLine, req.runway, own, r, st));
    }
  }
  return finalizeOptions(out);
}
