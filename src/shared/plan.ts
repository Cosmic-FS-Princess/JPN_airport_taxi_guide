// Shared route planning helpers used by all five airport guides.
import type { Airport, Exit, Leg, Stand, XY } from "./airport.ts";
import { route, steps, type RouteResult, type Step } from "./router.ts";

export interface BasePlanRequest<FlowId extends string = string> {
  mode: "arr" | "dep";
  flow: FlowId;
  runway: string;
  stand: string;
  /** arrival: exit key `${ref}${side}`; departure: entry taxiway ref */
  point?: string;
}

export interface BaseTemplate {
  via: string[];
  entry?: string;
  note?: { en: string; ja: string };
  side?: "L" | "R";
  exits?: string[];
  stands?: [number, number][];
  strict?: boolean;
}

export interface BasePlanOption<T extends BaseTemplate = BaseTemplate> {
  template: T;
  exit?: Exit;
  entry?: Leg;
  steps: Step[];
  line: XY[];
  length: number;
  missed: string[];
  summary: string;
  crossings: string[];
  crossAt: { rw: string; at: XY }[];
  /** apron gateway the route passes (Narita) */
  gateway?: { ref: string; at: XY };
}

export const exitKey = (e: Exit) => e.ref + e.side;

export function crossPoints(ap: Airport, nodes: number[], own: string) {
  const out: { rw: string; at: XY }[] = [];
  let last = "";
  nodes.forEach((n, i) => {
    const rw = ap.runwayNode.get(n) ?? "";
    if (rw && rw !== own && rw !== last && i > 0 && i < nodes.length - 1) out.push({ rw, at: ap.xy[n] });
    last = rw;
  });
  return out;
}

export function standLeadLine(stand: Stand): { standLine: XY[]; goalDir: XY | undefined } {
  const standLine: XY[] = [];
  for (let i = 0; i < stand.path.length; i += 2) standLine.push([stand.path[i], stand.path[i + 1]]);
  const lead = standLine.find((p) => Math.hypot(p[0] - standLine[0][0], p[1] - standLine[0][1]) > 3);
  const goalDir: XY | undefined = lead && [lead[0] - standLine[0][0], lead[1] - standLine[0][1]];
  return { standLine, goalDir };
}

export function filterByStand<T extends { stands?: [number, number][] }>(
  list: T[],
  ref: string,
  parseRef: (r: string) => number = (r) => parseInt(r, 10),
): T[] {
  if (!list.some((t) => t.stands)) return list;
  const standNum = parseRef(ref);
  if (Number.isNaN(standNum)) {
    const general = list.filter((t) => !t.stands);
    return general.length ? general : list;
  }
  const inRange = list.filter((t) => !t.stands || t.stands.some(([a, b]) => standNum >= a && standNum <= b));
  return inRange.length ? inRange : list;
}

export function buildArrivalOption<T extends BaseTemplate>(
  ap: Airport,
  template: T,
  exit: Exit,
  stand: Stand,
  standLine: XY[],
  own: string,
  r: RouteResult,
  st: Step[],
  missed = r.missed,
): BasePlanOption<T> {
  return {
    template,
    exit,
    steps: st,
    line: [...r.nodes.map((n) => ap.xy[n]), ...standLine.slice(1)],
    length: r.length,
    missed,
    summary: [...st.map((s) => s.ref).filter(Boolean), `Spot ${stand.ref}`].join(" → "),
    crossings: [...new Set(st.map((s) => s.crossing).filter((c): c is string => !!c))],
    crossAt: crossPoints(ap, r.nodes, own),
  };
}

export function buildDepartureOption<T extends BaseTemplate>(
  ap: Airport,
  template: T,
  entry: Leg,
  stand: Stand,
  standLine: XY[],
  runway: string,
  own: string,
  r: RouteResult,
  st: Step[],
): BasePlanOption<T> {
  return {
    template,
    entry,
    steps: st,
    line: [...[...standLine].reverse(), ...r.nodes.slice(1).map((n) => ap.xy[n])],
    length: r.length,
    missed: r.missed,
    summary: [`Spot ${stand.ref}`, ...st.map((s) => s.ref).filter(Boolean), `RWY ${runway}`].join(" → "),
    crossings: [...new Set(st.map((s) => s.crossing).filter((c): c is string => !!c))],
    crossAt: crossPoints(ap, r.nodes, own),
  };
}

export function finalizeOptions<O extends { summary: string; missed: string[]; length: number }>(out: O[]): O[] {
  // collapse duplicates (two templates resolving to the same path)
  const uniq = out.filter((o, i) => out.findIndex((p) => p.summary === o.summary) === i);
  // nearest first, but a route that follows the published taxiways beats a shorter
  // one that skips them: that is the option the chips tag and the panel selects
  uniq.sort((a, b) => a.missed.length - b.missed.length || a.length - b.length);
  // a published route that comes out far longer than the nearest one is a detour,
  // not a variant: drop it instead of offering it
  const pool = uniq.some((o) => !o.missed.length) ? uniq.filter((o) => !o.missed.length) : uniq;
  const min = Math.min(...pool.map((o) => o.length));
  return uniq.filter((o) => o.length <= min * 1.35);
}

/** index of the recommended option: fewest skipped taxiways, then shortest */
export function bestIndex<O extends { missed: string[]; length: number }>(opts: O[]): number {
  const key = (o: O) => o.missed.length * 1e6 + o.length;
  let bi = 0;
  opts.forEach((o, i) => {
    if (key(o) < key(opts[bi])) bi = i;
  });
  return bi;
}

export interface StandardPlanConfig<FlowId extends string, Group extends string, T extends BaseTemplate> {
  minExitS: number;
  likelyExitS: number;
  templates: (mode: "arr" | "dep", runway: string, group: Group, flow: FlowId) => T[];
  parseStandRef?: (ref: string) => number;
  excludeStopEnd?: boolean;
  preferSameSideDep?: boolean;
}

export function planStandard<FlowId extends string, Group extends string, T extends BaseTemplate>(
  ap: Airport<Group>,
  req: BasePlanRequest<FlowId>,
  cfg: StandardPlanConfig<FlowId, Group, T>,
): BasePlanOption<T>[] {
  const stand = ap.stand(req.stand);
  if (!stand) return [];
  const { standLine, goalDir } = standLeadLine(stand);
  const own = ap.runway(req.runway).id;
  const out: BasePlanOption<T>[] = [];
  const parseRef = cfg.parseStandRef;

  if (req.mode === "arr") {
    const exits = ap.exits(req.runway);
    const direct = new Map<number, RouteResult | null>();
    const directRoute = (exit: Exit) => {
      if (!direct.has(exit.node)) {
        direct.set(exit.node, route(ap, { start: exit.node, firstHop: exit.next, goal: stand.entry, via: [], ownRunway: own, goalDir }));
      }
      return direct.get(exit.node) ?? null;
    };
    let list = filterByStand(cfg.templates("arr", req.runway, stand.group, req.flow), stand.ref, parseRef);
    if (req.point && !list.some((t) => !t.exits || t.exits.includes(req.point!))) {
      list = [{ via: [], note: { en: "Shortest route from the selected exit.", ja: "選択した退路からの最短経路を使用します。" } } as unknown as T];
    }
    const endS = ap.end(req.runway).sMax;
    for (const t of list) {
      let candidates = req.point ? exits.filter((e) => exitKey(e) === req.point) : exits.filter((e) => e.s >= cfg.minExitS);
      if (!req.point && cfg.excludeStopEnd) {
        const usable = candidates.filter((e) => e.s <= endS - 200);
        if (usable.length) candidates = usable;
      }
      if (t.exits) candidates = candidates.filter((e) => t.exits!.includes(exitKey(e)));
      const standSide = ap.sideOf(req.runway, [stand.x, stand.y]);
      const sameSide = candidates.filter((e) => e.side === standSide);
      if (sameSide.length) candidates = sameSide;
      if (!req.point && t.side && candidates.some((e) => e.side === t.side)) candidates = candidates.filter((e) => e.side === t.side);

      let best: BasePlanOption<T> | null = null;
      let bestScore = Infinity;
      for (const exit of candidates) {
        const r = route(ap, { start: exit.node, firstHop: exit.next, goal: stand.entry, via: t.via, ownRunway: own, goalDir });
        if (!r) continue;
        const d = directRoute(exit);
        const chosen: RouteResult = t.strict || !d || r.length <= d.length * 1.2 ? r : d;
        const missed = chosen === d ? t.via.filter((v) => !chosen.refs.includes(v)) : r.missed;
        const score = chosen.length + Math.max(0, exit.s - cfg.likelyExitS) * 2 + exit.angle * 3 + missed.length * 4000;
        if (best && bestScore <= score) continue;
        bestScore = score;
        const st = steps(ap, chosen, own);
        best = buildArrivalOption(ap, t, exit, stand, standLine, own, chosen, st, missed);
      }
      if (best) out.push(best);
    }
  } else {
    const junctions = ap.junctions(req.runway);
    const standSide = ap.sideOf(req.runway, [stand.x, stand.y]);
    let list = filterByStand(cfg.templates("dep", req.runway, stand.group, req.flow), stand.ref, parseRef);
    if (req.point && !list.some((t) => !t.entry || t.entry === req.point)) {
      list = [{ via: [], note: { en: "Shortest route to the selected runway entry.", ja: "選択した滑走路進入点への最短経路を使用します。" } } as unknown as T];
    }
    for (const t of list) {
      const want = req.point ?? t.entry;
      const entry = cfg.preferSameSideDep
        ? (want && (junctions.find((j) => j.ref === want && j.side === standSide) ?? junctions.find((j) => j.ref === want))) ||
          junctions.find((j) => j.side === standSide) ||
          junctions[0]
        : (want && junctions.find((j) => j.ref === want)) || junctions[0];
      if (!entry) continue;
      const r = route(ap, {
        start: stand.entry, goal: entry.node, goalFrom: entry.next, via: t.via, ownRunway: own,
        startDir: goalDir && [-goalDir[0], -goalDir[1]],
      });
      if (!r) continue;
      const st = steps(ap, r, own);
      out.push(buildDepartureOption(ap, t, entry, stand, standLine, req.runway, own, r, st));
    }
  }
  return finalizeOptions(out);
}
