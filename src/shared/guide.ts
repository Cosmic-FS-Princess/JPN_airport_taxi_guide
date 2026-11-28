// Shared full-screen taxi guide UI controller used by all five airport pages.
import type { Airport, XY } from "./airport.ts";
import type { I18nInstance, Lang, Text } from "./i18n.ts";
import { MapView, type Basemap, type MapPoint } from "./map.ts";
import { bestIndex, exitKey, type BasePlanOption, type BasePlanRequest } from "./plan.ts";
import type { Step } from "./router.ts";

export interface FlowDef<FlowId extends string> {
  id: FlowId;
  name: Text;
  arr: string[];
  dep: string[];
}

export interface GuideConfig<FlowId extends string, Group extends string, ExtraKey extends string> {
  airport: Airport<Group>;
  storeKey: string;
  defaultFlow: FlowId;
  defaultRunway: string;
  flows: FlowDef<FlowId>[];
  flowShort: (f: FlowId, lang: Lang, mode: "arr" | "dep") => [string, string];
  runwayNames: Record<string, ExtraKey>;
  groups: Group[];
  groupKeys: Record<Group, ExtraKey>;
  i18n: I18nInstance<ExtraKey>;
  plan: (ap: Airport<Group>, req: BasePlanRequest<FlowId> & { lvp?: boolean }) => BasePlanOption[];
  minExitS?: number;
  fullThreshold?: number;
  /** filter departure entry chips to the stand's side of the runway (ROAH) */
  depFilterSide?: boolean;
  /** low-visibility operations support (RJAA) */
  lvp?: { runway: string; exits: string[]; entries: string[] };
  /** refresh stand map tooltips on language switch */
  standGroupInMapTitle?: boolean;
}

interface State<FlowId extends string> {
  lang: Lang;
  mode: "arr" | "dep";
  flow: FlowId;
  runway: string;
  stand: string | null;
  point: string | null;
  option: number | null;
  grid: boolean;
  base: Basemap;
  lvp: boolean;
}

const ICON: Record<Step["turn"] | "cross" | "gate" | "end" | "hold", string> = {
  start: '<circle cx="10" cy="10" r="3.5"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3"/>',
  straight: '<path d="M10 17V3M5.5 7.5 10 3l4.5 4.5"/>',
  left: '<path d="M14 17v-7a3 3 0 0 0-3-3H4M7.5 3.5 4 7l3.5 3.5"/>',
  right: '<path d="M6 17v-7a3 3 0 0 1 3-3h7M12.5 3.5 16 7l-3.5 3.5"/>',
  "sharp-left": '<path d="M14 17V8a4 4 0 0 0-8 0v6M3 11l3 3 3-3"/>',
  "sharp-right": '<path d="M6 17V8a4 4 0 0 1 8 0v6M11 11l3 3 3-3"/>',
  cross: '<path d="M3 6h14M3 14h14M6 10h2M12 10h2"/>',
  gate: '<path d="M4 17V6M16 17V6M4 8h12M4 11h12M4 14h12"/>',
  hold: '<path d="M3 7h14M3 10h14M3 13h14"/>',
  end: '<path d="M6 18V3M6 3.5h9l-2 3.5 2 3.5H6"/>',
};
const icon = (k: keyof typeof ICON) => `<svg viewBox="0 0 20 20">${ICON[k]}</svg>`;
const ARROW_L = '<svg viewBox="0 0 14 14"><path d="M9 12V7a2 2 0 0 0-2-2H3M5 2.5 2.5 5 5 7.5"/></svg>';
const ARROW_R = '<svg viewBox="0 0 14 14"><path d="M5 12V7a2 2 0 0 1 2-2h4M9 2.5 11.5 5 9 7.5"/></svg>';
const INFO = '<svg viewBox="0 0 20 20"><path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm.9 13.2H9.1V8.6h1.8v6.1ZM10 7.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z"/></svg>';
const WARN = '<svg viewBox="0 0 20 20"><path d="M11.3 2.6a1.5 1.5 0 0 0-2.6 0L1.4 15.3A1.5 1.5 0 0 0 2.7 17.5h14.6a1.5 1.5 0 0 0 1.3-2.2L11.3 2.6Zm-.4 11.6H9.1v-1.8h1.8v1.8Zm0-3.3H9.1V6.6h1.8v4.3Z"/></svg>';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
const TAXI_MPS = 15 * 0.514; // 15 kt average

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function initGuide<FlowId extends string, Group extends string, ExtraKey extends string>(
  cfg: GuideConfig<FlowId, Group, ExtraKey>,
) {
  const { airport: ap, i18n } = cfg;
  const { t, tx, getLang, setLang } = i18n;
  type AnyKey = Parameters<typeof t>[0];
  const minExitS = cfg.minExitS ?? 1500;
  const fullThreshold = cfg.fullThreshold ?? 50;
  const listSep = () => (getLang() === "ja" ? "、" : ", ");

  // ---------------- state ----------------
  const state: State<FlowId> = {
    lang: navigator.language.startsWith("ja") ? "ja" : "en",
    mode: "arr",
    flow: cfg.defaultFlow,
    runway: cfg.defaultRunway,
    stand: null,
    point: null,
    option: null,
    grid: true,
    base: "pale",
    lvp: false,
  };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(cfg.storeKey) ?? "{}"), { option: null });
  } catch { /* storage unavailable */ }
  const queryLang = new URLSearchParams(location.search).get("lang");
  if (queryLang === "en" || queryLang === "ja") state.lang = queryLang;
  if (state.lang !== "en" && state.lang !== "ja") state.lang = "en";
  if (!["pale", "photo", "none"].includes(state.base)) state.base = "pale";
  if (!cfg.lvp) state.lvp = false;

  const save = () => {
    try { localStorage.setItem(cfg.storeKey, JSON.stringify(state)); } catch { /* ignore */ }
  };
  const flow = () => cfg.flows.find((f) => f.id === state.flow) ?? cfg.flows[0];
  const runways = () => (cfg.lvp && state.lvp ? [cfg.lvp.runway] : state.mode === "arr" ? flow().arr : flow().dep);
  if (!runways().includes(state.runway)) state.runway = runways()[0];
  if (state.stand && !ap.stand(state.stand)) state.stand = null;
  setLang(state.lang);

  // ---------------- map ----------------
  const map = new MapView(
    $<HTMLElement>("map") as unknown as SVGSVGElement,
    $("rulers"),
    $("tooltip"),
    ap,
    {
      altText: (s) => t("alt", { s }),
      crossTitle: (r) => t("crossTitle", { r }),
      gatewayMap: cfg.lvp ? (g) => t("gatewayMap" as AnyKey, { g }) : undefined,
      standGroupLabel: cfg.standGroupInMapTitle
        ? (g) => t(cfg.groupKeys[g as Group])
        : undefined,
    },
  );
  const panel = $("panel");
  const layoutPad = () => {
    const mobile = innerWidth <= 720;
    map.pad = mobile
      ? { left: 0, right: 64, top: 0, bottom: panel.getBoundingClientRect().height }
      : { left: panel.getBoundingClientRect().right, right: 76, top: 0, bottom: 0 };
  };
  layoutPad();
  addEventListener("resize", layoutPad);
  map.setGridVisible(state.grid);

  // ---------------- background map (GSI tiles) ----------------
  const layersBtn = $("layers"), layerMenu = $("layer-menu");
  function applyBasemap() {
    map.setBasemap(state.base);
    document.body.dataset.base = state.base;
    layerMenu.querySelectorAll<HTMLElement>("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.base === state.base)));
  }
  const setMenu = (open: boolean) => {
    layerMenu.hidden = !open;
    layersBtn.setAttribute("aria-expanded", String(open));
  };
  layersBtn.onclick = (e) => { e.stopPropagation(); setMenu(layerMenu.hidden); };
  layerMenu.querySelectorAll<HTMLElement>("button").forEach((b) => (b.onclick = () => {
    state.base = b.dataset.base as Basemap;
    applyBasemap();
    save();
    setMenu(false);
  }));
  document.addEventListener("click", (e) => { if (!layerMenu.contains(e.target as Node)) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // ---------------- static text ----------------
  function applyStaticText() {
    document.title = t("title" as AnyKey);
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((e) => (e.textContent = t(e.dataset.i18n as AnyKey)));
    document.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((e) =>
      e.setAttribute("placeholder", t(e.dataset.i18nPlaceholder as AnyKey)));
    document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((e) => {
      const s = t(e.dataset.i18nTitle as AnyKey);
      e.title = s;
      e.setAttribute("aria-label", s);
    });
    document.querySelectorAll<Element>("[data-i18n-aria]").forEach((e) =>
      e.setAttribute("aria-label", t((e as HTMLElement).dataset.i18nAria as AnyKey)));
  }

  // ---------------- segmented controls ----------------
  function moveThumb(host: HTMLElement, value: string) {
    const thumb = host.querySelector<HTMLElement>(".thumb");
    const btns = [...host.querySelectorAll<HTMLElement>("button")];
    const i = btns.findIndex((b) => b.dataset.v === value);
    if (!thumb || i < 0) return;
    thumb.style.width = `calc((100% - 4px) / ${btns.length})`;
    thumb.style.transform = `translateX(${i * 100}%)`;
  }
  function segmented(host: HTMLElement, items: { v: string; label: string; sub?: string }[], value: string, onPick: (v: string) => void) {
    host.innerHTML =
      '<span class="thumb"></span>' +
      items.map((i) => `<button data-v="${esc(i.v)}" role="tab" aria-selected="${i.v === value}">${esc(i.label)}${i.sub ? `<small>${esc(i.sub)}</small>` : ""}</button>`).join("");
    host.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.onclick = () => onPick(b.dataset.v!)));
    moveThumb(host, value);
  }
  function runwayName(id: string) {
    const k = cfg.runwayNames[ap.runway(id).id];
    return k ? t(k) : "";
  }
  function renderControls() {
    segmented($("lang"), [{ v: "en", label: "EN" }, { v: "ja", label: "日本語" }], state.lang, (v) => {
      state.lang = v as Lang;
      setLang(state.lang);
      try { localStorage.setItem("jpn-taxi-guide-lang", state.lang); } catch { /* ignore */ }
      applyStaticText();
      map.refreshStandLabels();
      update(false);
    });
    segmented($("mode"), [{ v: "arr", label: t("arrival") }, { v: "dep", label: t("departure") }], state.mode, (v) => {
      state.mode = v as "arr" | "dep";
      if (!runways().includes(state.runway)) state.runway = runways()[0];
      state.point = null;
      update(true);
    });
    segmented($("flow"), cfg.flows.map((f) => {
      const [label, sub] = cfg.flowShort(f.id, state.lang, state.mode);
      return { v: f.id, label, sub };
    }), state.flow, (v) => {
      state.flow = v as FlowId;
      if (!runways().includes(state.runway)) state.runway = runways()[0];
      state.point = null;
      update(true);
    });
    const f = flow();
    $("flow-hint").textContent = t("flowHint", { name: tx(f.name), arr: f.arr.join(" / "), dep: f.dep.join(" / ") });
    segmented($("runway"), runways().map((r) => ({ v: r, label: r, sub: `${ap.runway(r).id} · ${runwayName(r)}` })), state.runway, (v) => {
      state.runway = v;
      state.point = null;
      update(true);
    });
  }

  // ---------------- stands ----------------
  const searchEl = $<HTMLInputElement>("stand-search");
  searchEl.addEventListener("input", () => renderStands());
  function renderStands() {
    const q = searchEl.value.trim().toUpperCase();
    const groups = Object.fromEntries(cfg.groups.map((g) => [g, [] as string[]])) as Record<Group, string[]>;
    for (const s of ap.data.stands) {
      if (q && !s.ref.toUpperCase().startsWith(q) && s.group.toUpperCase() !== q) continue;
      groups[s.group].push(s.ref);
    }
    const html = (Object.entries(groups) as [Group, string[]][])
      .filter(([, l]) => l.length)
      .map(([g, l]) => `<div class="stand-group"><h3><span>${esc(t(cfg.groupKeys[g]))}</span><span>${l.length}</span></h3><div class="stand-grid">${
        l.map((r) => `<button class="stand${r === state.stand ? " selected" : ""}" data-ref="${esc(r)}">${esc(r)}</button>`).join("")
      }</div></div>`)
      .join("");
    const box = $("stands");
    box.innerHTML = html || `<div class="empty">${esc(t("noMatch", { q: searchEl.value }))}</div>`;
    box.querySelectorAll<HTMLButtonElement>(".stand").forEach((b) => (b.onclick = () => pickStand(b.dataset.ref!)));
  }
  function pickStand(ref: string) {
    state.stand = ref;
    state.option = null;
    update(true);
    // scroll only the stand list container so mobile panels keep their header visible
    const box = $("stands");
    const b = box.querySelector<HTMLElement>(`[data-ref="${CSS.escape(ref)}"]`);
    if (!b) return;
    const br = b.getBoundingClientRect(), sr = box.getBoundingClientRect();
    if (br.top < sr.top + 4) box.scrollTop += br.top - sr.top - 4;
    else if (br.bottom > sr.bottom - 4) box.scrollTop += br.bottom - sr.bottom + 4;
  }
  map.onStand = pickStand;

  // ---------------- points (exits / entries) ----------------
  interface UiPoint { key: string; label: string; sub: string; side?: "L" | "R"; s: number; at: XY; anchor: XY }
  function pointsFor(): UiPoint[] {
    const refStand = state.stand ? ap.stand(state.stand) : state.mode === "dep" && cfg.depFilterSide ? ap.data.stands[0] : undefined;
    const side = refStand ? ap.sideOf(state.runway, [refStand.x, refStand.y]) : undefined;
    if (state.mode === "arr") {
      const all = ap.exits(state.runway);
      const near = side ? all.filter((e) => e.side === side) : [];
      const list = near.length ? near : all;
      const lvp = cfg.lvp && state.lvp ? list.filter((e) => cfg.lvp!.exits.includes(e.ref)) : [];
      return (lvp.length ? lvp : list).map((e) => ({
        key: exitKey(e), label: e.ref, side: e.side, s: e.s, sub: `${(e.s / 1000).toFixed(1)} km`,
        at: e.pin, anchor: ap.xy[e.node],
      }));
    }
    const end = ap.end(state.runway);
    const all = ap.junctions(state.runway).filter((j) => j.s < (end.sMax - end.sMin) * 0.5);
    const near = cfg.depFilterSide && side ? all.filter((j) => j.side === side) : [];
    return (near.length ? near : all)
      .filter((j, i, l) => l.findIndex((x) => x.ref === j.ref) === i)
      .filter((j) => !cfg.lvp || !state.lvp || cfg.lvp.entries.includes(j.ref))
      .map((j) => ({
        key: j.ref, label: j.ref, s: j.s,
        sub: j.s < fullThreshold ? t("full") : t("remain", { d: `${((end.sMax - j.s) / 1000).toFixed(1)} km` }),
        at: j.pin ?? ap.xy[j.node], anchor: ap.xy[j.node],
      }));
  }

  function renderPoints(opts: BasePlanOption[], sel: BasePlanOption | undefined) {
    const pts = pointsFor();
    $("point-title").textContent = t(state.mode === "arr" ? "exit" : "entry", { rwy: state.runway });
    const used = sel ? (state.mode === "arr" ? sel.exit && exitKey(sel.exit) : sel.entry?.ref) : undefined;
    const usedLabel = used && state.mode === "arr" ? `${used.slice(0, -1)} ${t(used.endsWith("L") ? "left" : "right")}` : used;
    const recSides = new Set(opts.map((o) => o.template.side).filter(Boolean));
    const chips = [
      `<button class="chip${state.point === null ? " selected" : ""}" data-k="">${t(state.mode === "arr" ? "auto" : "standard")}${usedLabel && state.point === null ? `<span class="sub">${esc(usedLabel)}</span>` : ""}</button>`,
      ...pts.map((p) => {
        const rec = state.mode === "arr" && p.side && recSides.has(p.side) && p.s >= minExitS;
        const arrow = p.side ? (p.side === "L" ? ARROW_L : ARROW_R) : "";
        const title = `${p.side ? t(p.side === "L" ? "leftExit" : "rightExit") : t("enterRunway")} · ${t("gridRef", { g: map.gridRef(p.anchor) })}`;
        return `<button class="chip${state.point === p.key ? " selected" : ""}${rec ? " rec" : ""}" data-k="${esc(p.key)}" title="${esc(title)}">${arrow}${esc(p.label)}<span class="sub">${esc(p.sub)}</span></button>`;
      }),
    ];
    const box = $("points");
    box.innerHTML = chips.join("");
    box.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) => (b.onclick = () => pickPoint(b.dataset.k || null)));
    const mp: MapPoint[] = pts.map((p) => ({ key: p.key, label: p.label, at: p.at, anchor: p.anchor }));
    map.setPoints(mp, state.point ?? used ?? null);
  }
  function pickPoint(k: string | null) {
    state.point = state.point === k ? null : k;
    state.option = null;
    update(true);
  }
  map.onPoint = (k) => pickPoint(k);

  // ---------------- result ----------------
  function stepRow(icon_: string, title: string, sub: string, d: string, cls = "", at?: XY) {
    return `<li class="${cls}" ${at ? `data-at="${at.join(",")}"` : ""}><span class="ico">${icon_}</span><span class="txt">${title}${sub ? `<small>${sub}</small>` : ""}</span><span class="d">${d}</span></li>`;
  }
  const sign = (r: string, cls = "") => `<span class="sign ${cls}">${esc(r)}</span>`;
  const th = (key: AnyKey, vars: Record<string, string>) => {
    const marks: Record<string, string> = {};
    const safe = Object.fromEntries(Object.entries(vars).map(([k, v], i) => ((marks[`\u0000${i}\u0000`] = v), [k, `\u0000${i}\u0000`])));
    let s = esc(t(key, safe));
    for (const [m, v] of Object.entries(marks)) s = s.replace(m, v);
    return s;
  };

  function renderResult(opts: BasePlanOption[], selIdx: number) {
    const box = $("result");
    if (!state.stand) {
      box.innerHTML = `<div class="card placeholder"><svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>${esc(t("pickStand", { dir: t(state.mode === "arr" ? "dirArr" : "dirDep") }))}</div>`;
      return;
    }
    if (!opts.length) {
      box.innerHTML = `<div class="card placeholder">${esc(t("noRoute", { s: state.stand, p: t(state.mode === "arr" ? "noRouteArr" : "noRouteDep") }))}</div>`;
      return;
    }
    const o = opts[selIdx];
    const best = bestIndex(opts);
    const stand = ap.stand(state.stand)!;
    const mins = Math.max(1, Math.round(o.length / TAXI_MPS / 60));
    const spot = sign(`Spot ${stand.ref}`, "spot");

    const chipLabel = (p: BasePlanOption) => {
      const refs = [...new Set(p.steps.map((s) => s.ref).filter(Boolean))];
      return refs.length ? esc(refs.join("·")) : esc(t("direct"));
    };
    const optionChips = opts.length > 1
      ? `<div class="options">${opts.map((p, i) => `<button class="chip${i === selIdx ? " selected" : ""}" data-i="${i}">${chipLabel(p)}<span class="sub">${fmtDist(p.length)}${i === best ? ` · ${esc(t("shortest"))}` : ""}</span></button>`).join("")}</div>`
      : "";

    const signs = o.summary.split(" → ")
      .map((p) => p.startsWith("Spot") ? sign(p, "spot") : p.startsWith("RWY") ? sign(p.replace("RWY ", ""), "rw") : sign(p))
      .join('<span class="arrow">›</span>');

    const notices: string[] = [];
    if (cfg.lvp && state.lvp) notices.push(`<div class="notice warn">${WARN}<span>${esc(t("lvpNotice" as AnyKey))}</span></div>`);
    if (o.template.note) notices.push(`<div class="notice info">${INFO}<span>${esc(tx(o.template.note))}</span></div>`);
    if (o.crossings.length) notices.push(`<div class="notice warn">${WARN}<span>${esc(t("crossWarn", { r: o.crossings.join(listSep()) }))}</span></div>`);
    if (o.missed.length) notices.push(`<div class="notice warn">${WARN}<span>${esc(t("missedWarn", { t: o.missed.join(listSep()) }))}</span></div>`);

    const rows: string[] = [];
    let gatewayAt = -1;
    if (o.gateway) {
      let bd = Infinity;
      o.steps.forEach((s, i) => {
        const d = Math.hypot(s.at[0] - o.gateway!.at[0], s.at[1] - o.gateway!.at[1]);
        if (d < bd) { bd = d; gatewayAt = i; }
      });
    }
    o.steps.forEach((s, i) => {
      const name = s.ref ? sign(s.ref) : esc(t("apron"));
      const grid = esc(t("gridRef", { g: map.gridRef(s.at) }));
      if (i === 0) {
        if (state.mode === "arr" && o.exit) {
          rows.push(stepRow(
            icon(o.exit.side === "L" ? "left" : "right"),
            th("vacate", { rwy: esc(state.runway), x: sign(o.exit.ref), side: esc(t(o.exit.side === "L" ? "sideL" : "sideR")) }),
            esc(t("fromThr", { d: fmtDist(o.exit.s), g: map.gridRef(s.at) })), fmtDist(s.length), "", s.at));
        } else {
          rows.push(stepRow(icon("start"), th("push", { s: spot, t: name }), esc(t("gridRef", { g: map.gridRef([stand.x, stand.y]) })), fmtDist(s.length), "", s.at));
        }
      } else {
        rows.push(stepRow(icon(s.turn === "start" ? "straight" : s.turn), th(`turn_${s.turn}` as AnyKey, { t: name }), grid, fmtDist(s.length), "", s.at));
      }
      if (s.crossing) {
        const c = o.crossAt.find((x) => x.rw === s.crossing);
        rows.push(stepRow(icon("cross"), esc(t("cross", { r: s.crossing })), esc(t("crossSub")), "", "cross", c?.at));
      }
      if (i === gatewayAt && o.gateway) {
        rows.push(stepRow(
          icon("gate"),
          th("gatewayTitle" as AnyKey, { g: sign(o.gateway.ref) }),
          esc(t("gatewaySub" as AnyKey)), "", "gateway", o.gateway.at));
      }
    });
    if (state.mode === "arr") {
      const grp = cfg.groups.length === 1
        ? t("gridRef", { g: map.gridRef([stand.x, stand.y]) })
        : `${t(cfg.groupKeys[stand.group])} · ${t("gridRef", { g: map.gridRef([stand.x, stand.y]) })}`;
      rows.push(stepRow(icon("end"), th("arrive", { s: spot }), esc(grp), "", "end", [stand.x, stand.y]));
    } else if (o.entry) {
      const avail = o.entry.s < fullThreshold ? t("fullTo") : t("avail", { d: fmtDist(ap.end(state.runway).sMax - o.entry.s) });
      rows.push(stepRow(icon("hold"), th("holdAt", { x: sign(o.entry.ref) }), esc(t("holdSub", { rwy: state.runway, avail })), "", "end", ap.xy[o.entry.node]));
    }

    box.innerHTML = `<div class="card">
      ${optionChips}
      <div class="result-head">
        <div class="big">${(o.length / 1000).toFixed(1)}<small>km</small></div>
        <div class="meta">${esc(t("minutes", { m: mins }))}<br/>${esc(t(state.mode === "arr" ? "arrival" : "departure"))} · ${esc(tx(flow().name))}</div>
      </div>
      <div class="signs">${signs}</div>
      ${notices.join("")}
      <ol class="steps">${rows.join("")}</ol>
    </div>`;
    box.querySelectorAll<HTMLButtonElement>(".options .chip").forEach((b) => (b.onclick = () => pickOption(+b.dataset.i!)));
    box.querySelectorAll<HTMLLIElement>(".steps li[data-at]").forEach((li) => {
      li.onclick = () => {
        const [x, y] = li.dataset.at!.split(",").map(Number);
        map.fitPoints([[x, y]], true, 420);
      };
    });
  }
  function pickOption(i: number) {
    state.option = i;
    update(true);
  }
  map.onAlt = pickOption;

  // ---------------- update ----------------
  let lastRouteKey = "";
  function update(fitView: boolean) {
    if (cfg.lvp && state.lvp) state.runway = cfg.lvp.runway;
    save();
    renderControls();
    renderStands();
    map.selectStand(state.stand);
    map.setActiveRunway(ap.end(state.runway), state.mode);
    const opts = state.stand
      ? cfg.plan(ap, {
          mode: state.mode,
          flow: state.flow,
          runway: state.runway,
          stand: state.stand,
          point: state.point ?? undefined,
          lvp: cfg.lvp ? state.lvp : undefined,
        })
      : [];
    if (state.option === null || state.option >= opts.length) state.option = opts.length ? bestIndex(opts) : null;
    const sel = state.option !== null ? opts[state.option] : undefined;
    renderPoints(opts, sel);
    renderResult(opts, state.option ?? 0);

    const key = `${state.mode}|${state.runway}|${state.stand}|${state.point}|${state.option}|${state.lvp}`;
    if (key !== lastRouteKey) map.setRoute(opts, state.option ?? 0);
    if (fitView && key !== lastRouteKey) {
      layoutPad();
      if (sel) map.fitPoints(sel.line);
      else {
        const r = ap.runway(state.runway);
        map.fitPoints([r.p0, r.p1], true);
      }
    }
    lastRouteKey = key;
  }

  // ---------------- LVP switch (when present) ----------------
  const lvpToggle = document.getElementById("lvp-toggle") as HTMLInputElement | null;
  if (lvpToggle && cfg.lvp) {
    lvpToggle.checked = state.lvp;
    lvpToggle.onchange = () => {
      state.lvp = lvpToggle.checked;
      if (state.lvp) state.runway = cfg.lvp!.runway;
      state.point = null;
      state.option = null;
      update(true);
    };
  }

  // ---------------- map buttons ----------------
  $("zoom-in").onclick = () => map.zoomBy(1.6, undefined, undefined, true);
  $("zoom-out").onclick = () => map.zoomBy(1 / 1.6, undefined, undefined, true);
  $("fit").onclick = () => map.fitAll();
  const gridBtn = $("grid-toggle");
  gridBtn.setAttribute("aria-pressed", String(state.grid));
  gridBtn.onclick = () => {
    state.grid = !state.grid;
    gridBtn.setAttribute("aria-pressed", String(state.grid));
    map.setGridVisible(state.grid);
    save();
  };
  applyStaticText();
  map.fitAll(false);
  applyBasemap();
  update(false);
  if (state.stand) requestAnimationFrame(() => { lastRouteKey = ""; update(true); });
}
