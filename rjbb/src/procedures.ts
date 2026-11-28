// Standard taxi logic for RJBB (Kansai International Airport).
//
// Two parallel runways sit on separate artificial islands linked by the J3/J4
// connecting taxiways:
//   - Runway A (06R/24L, 3,500 m) on Island 1, served by parallel taxiways P and L
//   - Runway B (06L/24R, 4,000 m) on Island 2, served by parallel taxiways Y and Z
// Since March 2025, standard segregated operations assign arrivals primarily to
// Runway A (06R/24L) and departures to Runway B (06L/24R), while both runways
// remain selectable in each wind flow for mixed-mode or maintenance operations.
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
  { id: "N", name: { en: "North flow (06)", ja: "北風運用（06）" }, arr: ["06R", "06L"], dep: ["06L", "06R"] },
  { id: "S", name: { en: "South flow (24)", ja: "南風運用（24）" }, arr: ["24L", "24R"], dep: ["24R", "24L"] },
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

const NOTE_A_ARR_T1: Text = {
  en: "Vacate onto P or L, then turn into Terminal 1 apron taxilane R via the nearest E connector.",
  ja: "P または L へ離脱し、最寄りの E 連絡誘導路から第1ターミナルのエプロン誘導路 R へ入ります。",
};
const NOTE_A_ARR_GA: Text = {
  en: "North apron / GA stands (601–604) taxi north along P directly from Runway A.",
  ja: "北側エプロン・ビジネスジェットスポット（601–604）は A 滑走路から P を北上します。",
};
const NOTE_BRIDGE_1_TO_2: Text = {
  en: "Cross from Island 1 to Island 2 via the J3 or J4 connecting taxiway.",
  ja: "連絡誘導路 J3 または J4 を経由して1期島から2期島へ移動します。",
};
const NOTE_BRIDGE_2_TO_1: Text = {
  en: "Cross from Island 2 to Island 1 via the J3 or J4 connecting taxiway.",
  ja: "連絡誘導路 J3 または J4 を経由して2期島から1期島へ移動します。",
};
const NOTE_B_ARR_T2: Text = {
  en: "Vacate Runway B onto Y/Z, then enter Terminal 2 apron taxilane T.",
  ja: "B 滑走路から Y・Z へ離脱し、第2ターミナルのエプロン誘導路 T へ入ります。",
};
const NOTE_06R_DEP_A14: Text = {
  en: "Full-length 06R departure from A14 (A13/A12 available for intersection departure).",
  ja: "A14 から 06R 全長離陸（インターセクション離陸は A13・A12 を使用）。",
};
const NOTE_24L_DEP_A1: Text = {
  en: "Full-length 24L departure from A1 via J1 or P (A2/A3 available for intersection departure).",
  ja: "J1 または P 経由で A1 から 24L 全長離陸（インターセクション離陸は A2・A3 を使用）。",
};
const NOTE_06L_DEP_B14: Text = {
  en: "Full-length 06L departure from B14 via Y (4,000 m Runway B).",
  ja: "Y 経由で B14 から 06L 全長離陸（4,000 m B滑走路）。",
};
const NOTE_24R_DEP_B1: Text = {
  en: "Full-length 24R departure from B1 via Y (4,000 m Runway B).",
  ja: "Y 経由で B1 から 24R 全長離陸（4,000 m B滑走路）。",
};

export const ARRIVALS: Table = {
  "06R": {
    T1: [
      { via: ["L", "R"], side: "L", stands: [[1, 41]], note: NOTE_A_ARR_T1 },
      { via: ["P", "R"], side: "L", stands: [[1, 41]], note: NOTE_A_ARR_T1 },
      { via: ["P"], side: "L", stands: [[601, 699]], note: NOTE_A_ARR_GA },
    ],
    T2: [
      { via: ["L", "J3", "T"], side: "L", note: NOTE_BRIDGE_1_TO_2 },
      { via: ["P", "J4", "T"], side: "L", note: NOTE_BRIDGE_1_TO_2 },
    ],
    S: [
      { via: ["L"], side: "L" },
      { via: ["P", "L"], side: "L" },
    ],
    N: [
      { via: ["L", "J4"], side: "L", note: NOTE_BRIDGE_1_TO_2 },
      { via: ["P", "J4"], side: "L", note: NOTE_BRIDGE_1_TO_2 },
    ],
  },
  "24L": {
    T1: [
      { via: ["L", "R"], side: "R", stands: [[1, 41]], note: NOTE_A_ARR_T1 },
      { via: ["P", "R"], side: "R", stands: [[1, 41]], note: NOTE_A_ARR_T1 },
      { via: ["P"], side: "R", stands: [[601, 699]], note: NOTE_A_ARR_GA },
    ],
    T2: [
      { via: ["L", "J3", "T"], side: "R", note: NOTE_BRIDGE_1_TO_2 },
      { via: ["P", "J4", "T"], side: "R", note: NOTE_BRIDGE_1_TO_2 },
    ],
    S: [
      { via: ["L"], side: "R" },
      { via: ["P", "L"], side: "R" },
    ],
    N: [
      { via: ["P", "J4"], side: "R", note: NOTE_BRIDGE_1_TO_2 },
      { via: ["L", "J4"], side: "R", note: NOTE_BRIDGE_1_TO_2 },
    ],
  },
  "06L": {
    T1: [
      { via: ["J3", "R"], side: "R", stands: [[1, 41]], note: NOTE_BRIDGE_2_TO_1 },
      { via: ["J4", "L", "R"], side: "R", stands: [[1, 41]], note: NOTE_BRIDGE_2_TO_1 },
      { via: ["J4", "P"], side: "R", stands: [[601, 699]], note: NOTE_BRIDGE_2_TO_1 },
    ],
    T2: [
      { via: ["Z", "T"], side: "R", note: NOTE_B_ARR_T2 },
      { via: ["T"], side: "R", note: NOTE_B_ARR_T2 },
    ],
    S: [
      { via: ["J4"], side: "R", note: NOTE_BRIDGE_2_TO_1 },
      { via: ["J3", "R"], side: "R", stands: [[101, 105]], note: NOTE_BRIDGE_2_TO_1 },
    ],
    N: [
      { via: ["J4"], side: "R" },
    ],
  },
  "24R": {
    T1: [
      { via: ["J3", "R"], side: "L", stands: [[1, 41]], note: NOTE_BRIDGE_2_TO_1 },
      { via: ["J4", "L", "R"], side: "L", stands: [[1, 41]], note: NOTE_BRIDGE_2_TO_1 },
      { via: ["J4", "P"], side: "L", stands: [[601, 699]], note: NOTE_BRIDGE_2_TO_1 },
    ],
    T2: [
      { via: ["Z", "T"], side: "L", note: NOTE_B_ARR_T2 },
      { via: ["T"], side: "L", note: NOTE_B_ARR_T2 },
    ],
    S: [
      { via: ["J4"], side: "L", note: NOTE_BRIDGE_2_TO_1 },
      { via: ["J3", "R"], side: "L", stands: [[101, 105]], note: NOTE_BRIDGE_2_TO_1 },
    ],
    N: [
      { via: ["J4"], side: "L" },
    ],
  },
};

export const DEPARTURES: Table = {
  "06L": {
    T1: [
      { via: ["J3", "Y", "B14"], entry: "B14", stands: [[1, 41]], note: NOTE_06L_DEP_B14 },
      { via: ["L", "J4", "Y", "B14"], entry: "B14", stands: [[1, 41]], note: NOTE_06L_DEP_B14 },
      { via: ["P", "J4", "Y", "B14"], entry: "B14", stands: [[601, 699]], note: NOTE_06L_DEP_B14 },
    ],
    T2: [
      { via: ["Z", "Y", "B14"], entry: "B14", note: NOTE_06L_DEP_B14 },
      { via: ["Y", "B14"], entry: "B14", note: NOTE_06L_DEP_B14 },
    ],
    S: [
      { via: ["L", "J4", "Y", "B14"], entry: "B14", note: NOTE_06L_DEP_B14 },
      { via: ["J3", "Y", "B14"], entry: "B14", stands: [[101, 111]], note: NOTE_06L_DEP_B14 },
    ],
    N: [
      { via: ["J4", "Y", "B14"], entry: "B14", note: NOTE_06L_DEP_B14 },
    ],
  },
  "06R": {
    T1: [
      { via: ["L", "A14"], entry: "A14", stands: [[1, 41]], note: NOTE_06R_DEP_A14 },
      { via: ["P", "A14"], entry: "A14", note: NOTE_06R_DEP_A14 },
    ],
    T2: [
      { via: ["T", "J4", "P", "A14"], entry: "A14", note: NOTE_06R_DEP_A14 },
      { via: ["T", "J3", "P", "A14"], entry: "A14", note: NOTE_06R_DEP_A14 },
    ],
    S: [
      { via: ["L", "A14"], entry: "A14", note: NOTE_06R_DEP_A14 },
      { via: ["P", "A14"], entry: "A14", note: NOTE_06R_DEP_A14 },
    ],
    N: [
      { via: ["J4", "P", "A14"], entry: "A14", note: NOTE_06R_DEP_A14 },
    ],
  },
  "24R": {
    T1: [
      { via: ["J3", "Z", "Y", "B1"], entry: "B1", stands: [[1, 41]], note: NOTE_24R_DEP_B1 },
      { via: ["L", "J4", "Y", "B1"], entry: "B1", stands: [[1, 41]], note: NOTE_24R_DEP_B1 },
      { via: ["P", "J4", "Y", "B1"], entry: "B1", stands: [[601, 699]], note: NOTE_24R_DEP_B1 },
    ],
    T2: [
      { via: ["T", "Y", "B1"], entry: "B1", note: NOTE_24R_DEP_B1 },
      { via: ["Z", "Y", "B1"], entry: "B1", note: NOTE_24R_DEP_B1 },
    ],
    S: [
      { via: ["L", "J4", "Y", "B1"], entry: "B1", note: NOTE_24R_DEP_B1 },
      { via: ["J3", "Z", "Y", "B1"], entry: "B1", stands: [[101, 111]], note: NOTE_24R_DEP_B1 },
    ],
    N: [
      { via: ["J4", "Y", "B1"], entry: "B1", note: NOTE_24R_DEP_B1 },
    ],
  },
  "24L": {
    T1: [
      { via: ["R", "J1", "A1"], entry: "A1", stands: [[1, 41]], note: NOTE_24L_DEP_A1 },
      { via: ["L", "J1", "A1"], entry: "A1", stands: [[1, 41]], note: NOTE_24L_DEP_A1 },
      { via: ["P", "A1"], entry: "A1", note: NOTE_24L_DEP_A1 },
    ],
    T2: [
      { via: ["T", "J3", "R", "J1", "A1"], entry: "A1", note: NOTE_24L_DEP_A1 },
      { via: ["T", "J4", "L", "J1", "A1"], entry: "A1", note: NOTE_24L_DEP_A1 },
    ],
    S: [
      { via: ["L", "J1", "A1"], entry: "A1", note: NOTE_24L_DEP_A1 },
      { via: ["P", "A1"], entry: "A1", note: NOTE_24L_DEP_A1 },
    ],
    N: [
      { via: ["J4", "L", "J1", "A1"], entry: "A1", note: NOTE_24L_DEP_A1 },
      { via: ["J4", "P", "A1"], entry: "A1", note: NOTE_24L_DEP_A1 },
    ],
  },
};

export function templates(table: Table, rwy: string, group: Group, flow: FlowId): Template[] {
  const list = (table[rwy]?.[group] ?? []).filter((t) => !t.flows || t.flows.includes(flow));
  return list.length ? list : [{ via: [], note: { en: "No published route; shortest path used", ja: "標準ルートなし · 最短経路を使用" } }];
}
