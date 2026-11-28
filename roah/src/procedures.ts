// Standard taxi logic for ROAH (Naha Airport).
//
// Two parallel runways sit on the east (terminal) island and the west offshore
// reclaimed island, linked by seawall bridge taxiways J1 and J2:
//   - Runway 1 (18L/36R, 3,000 m x 45 m): inboard runway, primarily used for departures
//   - Runway 2 (18R/36L, 2,700 m x 60 m): offshore runway, primarily used for arrivals
// Aircraft moving between Runway 2 and the terminal aprons cross Runway 1 (18L/36R)
// via W2/E3 or W3/E4 under ATC clearance. Both runways remain selectable in each
// wind flow for mixed-mode or single-runway operations.
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
  { id: "N", name: { en: "North flow (36)", ja: "北風運用（36）" }, arr: ["36L", "36R"], dep: ["36R", "36L"] },
  { id: "S", name: { en: "South flow (18)", ja: "南風運用（18）" }, arr: ["18R", "18L"], dep: ["18L", "18R"] },
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

const NOTE_RWY2_ARR_W2: Text = {
  en: "Vacate onto C, cross bridge J1 to B, then hold short of RWY 18L/36R before crossing at W2 → E3.",
  ja: "C へ離脱し、連絡誘導路 J1 から B へ進み、W2 → E3 で RWY 18L/36R を横断します（手前で停止・許可後に横断）。",
};
const NOTE_RWY2_ARR_W3: Text = {
  en: "Alternative crossing: C → J2 → B, then cross RWY 18L/36R at W3 → E4.",
  ja: "代替横断ルート：C → J2 → B を経由し、W3 → E4 で RWY 18L/36R を横断します。",
};
const NOTE_RWY1_ARR: Text = {
  en: "Vacate onto East parallel A-taxiway directly to the terminal or cargo apron.",
  ja: "東側の平行誘導路 A へ離脱し、そのままターミナルまたは貨物エプロンへ入ります。",
};
const NOTE_36R_DEP: Text = {
  en: "Southbound via parallel taxiways A1–A9 to full-length holding point E10.",
  ja: "平行誘導路 A1–A9 を南下し、E10 の全長離陸停止位置へ進みます。",
};
const NOTE_18L_DEP: Text = {
  en: "Northbound via parallel A-taxiway to full-length holding point E1 (E2/E3 available for intersection departure).",
  ja: "平行誘導路 A を北上し、E1 の全長離陸停止位置へ進みます（インターセクション離陸は E2・E3）。",
};
const NOTE_36L_DEP_W2: Text = {
  en: "Cross RWY 18L/36R at E3 → W2, take bridge J1 to C, then taxi south to full-length holding point T9.",
  ja: "E3 → W2 で RWY 18L/36R を横断し、J1 から C を南下して T9 の全長離陸停止位置へ進みます。",
};
const NOTE_36L_DEP_W3: Text = {
  en: "Alternative crossing via E4 → W3 and bridge J2, then south on C to T9.",
  ja: "代替ルート：E4 → W3 で横断し、J2 から C を南下して T9 へ進みます。",
};
const NOTE_18R_DEP_W2: Text = {
  en: "Cross RWY 18L/36R at E3 → W2, then cross bridge J1 to full-length holding point T1.",
  ja: "E3 → W2 で RWY 18L/36R を横断し、連絡誘導路 J1 から T1 の全長離陸停止位置へ進みます。",
};
const NOTE_18R_DEP_W3: Text = {
  en: "Alternative crossing via E4 → W3 and bridge J2 to holding point T1.",
  ja: "代替ルート：E4 → W3 で横断し、連絡誘導路 J2 経由で T1 へ進みます。",
};

const RWY2_ARR_R: Template[] = [
  { via: ["C", "J1", "B", "W2", "E3"], side: "R", strict: true, note: NOTE_RWY2_ARR_W2 },
  { via: ["C", "J2", "B", "W3", "E4"], side: "R", strict: true, note: NOTE_RWY2_ARR_W3 },
];
const RWY2_ARR_L: Template[] = [
  { via: ["C", "J1", "B", "W2", "E3"], side: "L", strict: true, note: NOTE_RWY2_ARR_W2 },
  { via: ["C", "J2", "B", "W3", "E4"], side: "L", strict: true, note: NOTE_RWY2_ARR_W3 },
];

export const ARRIVALS: Table = {
  "36L": {
    Dom: RWY2_ARR_R,
    Intl: RWY2_ARR_R,
    Cargo: RWY2_ARR_R,
  },
  "18R": {
    Dom: RWY2_ARR_L,
    Intl: RWY2_ARR_L,
    Cargo: RWY2_ARR_L,
  },
  "36R": {
    Dom: [{ via: ["A4"], side: "R", note: NOTE_RWY1_ARR }],
    Intl: [{ via: ["A3"], side: "R", note: NOTE_RWY1_ARR }],
    Cargo: [{ via: ["A3", "A1"], side: "R", note: NOTE_RWY1_ARR }],
  },
  "18L": {
    Dom: [{ via: ["A5", "A4"], side: "L", note: NOTE_RWY1_ARR }],
    Intl: [{ via: ["A5", "A4", "A3"], side: "L", note: NOTE_RWY1_ARR }],
    Cargo: [{ via: ["A5", "A4", "A3", "A1"], side: "L", note: NOTE_RWY1_ARR }],
  },
};

const RWY36L_DEP: Template[] = [
  { via: ["E3", "W2", "B", "J1", "C", "T9"], entry: "T9", strict: true, note: NOTE_36L_DEP_W2 },
  { via: ["E4", "W3", "B", "J2", "C", "T9"], entry: "T9", strict: true, note: NOTE_36L_DEP_W3 },
];
const RWY18R_DEP: Template[] = [
  { via: ["E3", "W2", "B", "J1", "T1"], entry: "T1", strict: true, note: NOTE_18R_DEP_W2 },
  { via: ["E4", "W3", "B", "J2", "T1"], entry: "T1", strict: true, note: NOTE_18R_DEP_W3 },
];

export const DEPARTURES: Table = {
  "36R": {
    Dom: [{ via: ["A5", "A6", "A7", "A8", "A9", "E10"], entry: "E10", strict: true, note: NOTE_36R_DEP }],
    Intl: [{ via: ["A3", "A4", "A5", "A6", "A7", "A8", "A9", "E10"], entry: "E10", strict: true, note: NOTE_36R_DEP }],
    Cargo: [{ via: ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "E10"], entry: "E10", strict: true, note: NOTE_36R_DEP }],
  },
  "18L": {
    Dom: [
      { via: ["A3", "E1"], entry: "E1", stands: [[21, 33]], note: NOTE_18L_DEP },
      { via: ["E1"], entry: "E1", stands: [[34, 39]], note: NOTE_18L_DEP },
    ],
    Intl: [{ via: ["E1"], entry: "E1", note: NOTE_18L_DEP }],
    Cargo: [{ via: ["A1", "E1"], entry: "E1", note: NOTE_18L_DEP }],
  },
  "36L": {
    Dom: RWY36L_DEP,
    Intl: RWY36L_DEP,
    Cargo: RWY36L_DEP,
  },
  "18R": {
    Dom: RWY18R_DEP,
    Intl: RWY18R_DEP,
    Cargo: RWY18R_DEP,
  },
};

export function templates(table: Table, rwy: string, group: Group, flow: FlowId): Template[] {
  const list = (table[rwy]?.[group] ?? []).filter((t) => !t.flows || t.flows.includes(flow));
  return list.length ? list : [{ via: [], note: { en: "No published route; shortest path used", ja: "標準ルートなし · 最短経路を使用" } }];
}
