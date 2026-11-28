// Standard taxi logic for RJCC (New Chitose Airport).
//
// Two closely spaced parallel 3,000 m x 60 m runways sit east of the Domestic,
// International, Cargo and North aprons:
//   - Runway A (01L/19R): west / inboard runway, primarily used for departures
//   - Runway B (01R/19L): east / outboard runway, primarily used for arrivals
// Aircraft moving between Runway B (01R/19L) and the aprons cross Runway A
// (01L/19R) via the paired B/A connectors under ATC clearance. Both runways
// remain selectable in each wind flow for mixed-mode or winter snow-clearing ops.
//
// `via` is the ordered list of taxiways after vacating / before lining up.
// ATC instructions always take precedence.
import type { Group } from "./airport.ts";
import type { Text } from "./i18n.ts";

export type FlowId = "N" | "S";
export interface Flow {
  id: FlowId;
  name: Text;
  arr: string[];
  dep: string[];
}
export const FLOWS: Flow[] = [
  { id: "N", name: { en: "North flow (01)", ja: "北風運用（01）" }, arr: ["01R", "01L"], dep: ["01L", "01R"] },
  { id: "S", name: { en: "South flow (19)", ja: "南風運用（19）" }, arr: ["19L", "19R"], dep: ["19R", "19L"] },
];

export interface Template {
  via: string[];
  /** departure: runway entry / holding point taxiway */
  entry?: string;
  note?: Text;
  /** arrival: recommended turn-off side */
  side?: "L" | "R";
  /** arrival: exit keys (`ref` + side) belonging to this standard route */
  exits?: string[];
  flows?: FlowId[];
  /** inclusive stand-number ranges using this route */
  stands?: [number, number][];
  /** the published taxiways must be flown even when a direct line is shorter */
  strict?: boolean;
}
type Table = Record<string, Partial<Record<Group, Template[]>>>;

const NOTE_01R_ARR: Text = {
  en: "Vacate RWY 01R left onto B4/B5, hold short of RWY 01L/19R and cross onto D/J when cleared.",
  ja: "01R から左の B4・B5 へ離脱し、RWY 01L/19R 手前で停止・許可後に横断して D・J へ進みます。",
};
const NOTE_19L_ARR: Text = {
  en: "Vacate RWY 19L right onto B9/B10, hold short of RWY 01L/19R and cross onto D northbound when cleared.",
  ja: "19L から右の B9・B10 へ離脱し、RWY 01L/19R 手前で停止・許可後に横断して D を北上します。",
};
const NOTE_RWYA_ARR: Text = {
  en: "Vacate Runway A (01L/19R) onto D-taxiway directly to the terminal or cargo apron.",
  ja: "A 滑走路（01L/19R）から平行誘導路 D へ離脱し、そのままターミナルまたは貨物エプロンへ入ります。",
};
const NOTE_01L_DEP: Text = {
  en: "Southbound via parallel taxiway D to full-length holding point A12 (A11/A10 for intersection departure).",
  ja: "平行誘導路 D を南下し、A12 の全長離陸停止位置へ進みます（インターセクション離陸は A11・A10）。",
};
const NOTE_01R_DEP: Text = {
  en: "Southbound via D to A12, cross RWY 01L/19R when cleared to RWY 01R holding point B12.",
  ja: "D を南下して A12 から許可後に RWY 01L/19R を横断し、01R の B12 停止位置へ進みます。",
};
const NOTE_19R_DEP: Text = {
  en: "Northbound via parallel taxiway D to full-length holding point A2/A1 (A3 for intersection departure).",
  ja: "平行誘導路 D を北上し、A2・A1 の全長離陸停止位置へ進みます（インターセクション離陸は A3）。",
};
const NOTE_19L_DEP: Text = {
  en: "Northbound via D to A2/A3, cross RWY 01L/19R when cleared to RWY 19L holding point B3.",
  ja: "D を北上して A2・A3 から許可後に RWY 01L/19R を横断し、19L の B3 停止位置へ進みます。",
};

export const ARRIVALS: Table = {
  "01R": {
    Dom: [{ via: [], side: "L", note: NOTE_01R_ARR }],
    Intl: [{ via: [], side: "L", note: NOTE_01R_ARR }],
    North: [{ via: [], side: "L", note: NOTE_01R_ARR }],
    Cargo: [{ via: [], side: "L", note: NOTE_01R_ARR }],
  },
  "19L": {
    Dom: [{ via: [], side: "R", note: NOTE_19L_ARR }],
    Intl: [{ via: [], side: "R", note: NOTE_19L_ARR }],
    North: [{ via: [], side: "R", note: NOTE_19L_ARR }],
    Cargo: [{ via: [], side: "R", note: NOTE_19L_ARR }],
  },
  "01L": {
    Dom: [{ via: [], side: "L", note: NOTE_RWYA_ARR }],
    Intl: [{ via: [], side: "L", note: NOTE_RWYA_ARR }],
    North: [{ via: [], side: "L", note: NOTE_RWYA_ARR }],
    Cargo: [{ via: [], side: "L", note: NOTE_RWYA_ARR }],
  },
  "19R": {
    Dom: [{ via: [], side: "R", note: NOTE_RWYA_ARR }],
    Intl: [{ via: [], side: "R", note: NOTE_RWYA_ARR }],
    North: [{ via: [], side: "R", note: NOTE_RWYA_ARR }],
    Cargo: [{ via: [], side: "R", note: NOTE_RWYA_ARR }],
  },
};

export const DEPARTURES: Table = {
  "01L": {
    Dom: [{ via: ["D10", "D11", "D12", "A12"], entry: "A12", note: NOTE_01L_DEP }],
    Intl: [
      { via: ["G", "D9", "D10", "D11", "D12", "A12"], entry: "A12", note: NOTE_01L_DEP },
      { via: ["D10", "D11", "D12", "A12"], entry: "A12", note: NOTE_01L_DEP },
    ],
    North: [
      { via: ["G", "D9", "D10", "D11", "D12", "A12"], entry: "A12", note: NOTE_01L_DEP },
      { via: ["D10", "D11", "D12", "A12"], entry: "A12", note: NOTE_01L_DEP },
    ],
    Cargo: [{ via: ["D10", "D11", "D12", "A12"], entry: "A12", note: NOTE_01L_DEP }],
  },
  "01R": {
    Dom: [{ via: ["D11", "D12", "A12", "B12"], entry: "B12", strict: true, note: NOTE_01R_DEP }],
    Intl: [{ via: ["D11", "D12", "A12", "B12"], entry: "B12", strict: true, note: NOTE_01R_DEP }],
    North: [{ via: ["D11", "D12", "A12", "B12"], entry: "B12", strict: true, note: NOTE_01R_DEP }],
    Cargo: [{ via: ["D11", "D12", "A12", "B12"], entry: "B12", strict: true, note: NOTE_01R_DEP }],
  },
  "19R": {
    Dom: [{ via: ["A2"], entry: "A2", note: NOTE_19R_DEP }],
    Intl: [{ via: ["D2", "D3", "A2"], entry: "A2", note: NOTE_19R_DEP }],
    North: [{ via: ["D1", "D2", "D3", "A2"], entry: "A2", note: NOTE_19R_DEP }],
    Cargo: [{ via: ["A2"], entry: "A2", note: NOTE_19R_DEP }],
  },
  "19L": {
    Dom: [{ via: ["B3"], entry: "B3", strict: true, note: NOTE_19L_DEP }],
    Intl: [{ via: ["D2", "D3", "B3"], entry: "B3", strict: true, note: NOTE_19L_DEP }],
    North: [{ via: ["D1", "D2", "D3", "B3"], entry: "B3", strict: true, note: NOTE_19L_DEP }],
    Cargo: [{ via: ["B3"], entry: "B3", strict: true, note: NOTE_19L_DEP }],
  },
};

export function templates(table: Table, rwy: string, group: Group, flow: FlowId): Template[] {
  const list = (table[rwy]?.[group] ?? []).filter((t) => !t.flows || t.flows.includes(flow));
  return list.length ? list : [{ via: [], note: { en: "No published route; shortest path used", ja: "標準ルートなし · 最短経路を使用" } }];
}
