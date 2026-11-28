// Standard taxi logic for RJOO.
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
  { id: "N", name: { en: "North flow", ja: "北風運用" }, arr: ["32L", "32R"], dep: ["32L", "32R"] },
  { id: "S", name: { en: "South flow", ja: "南風運用" }, arr: ["14L", "14R"], dep: ["14L", "14R"] },
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
  /** departure: inclusive stand-number ranges using this route */
  stands?: [number, number][];
  /** the published taxiways must be flown even when a direct line is shorter */
  strict?: boolean;
}
type Table = Record<string, Partial<Record<Group, Template[]>>>;

const NOTE_32L_ARR: Text = {
  en: "The standard 32L arrival route uses W9 and crosses RWY 32R before entering the Ramp.",
  ja: "32L 到着の標準ルートは W9 から RWY 32R を横断し、ランプへ入ります。",
};
const NOTE_14R_ARR: Text = {
  en: "The standard 14R arrival route uses W3 and B-TWY, then holds short of RWY 14L for the crossing clearance.",
  ja: "14R 到着の標準ルートは W3、B-TWY を使用し、RWY 14L 手前で横断許可を待ちます。",
};
const NOTE_32R_DEP: Text = {
  en: "32R departures taxi via E1 to the C1 holding point.",
  ja: "32R 出発は E1 から C1 のホールディングポイントへ滑走します。",
};
const NOTE_32L_DEP: Text = {
  en: "32L departures taxi via E1 and C1, cross RWY 32R on B-TWY, then continue to W2.",
  ja: "32L 出発は E1、C1 から B-TWY で RWY 32R を横断し、W2 へ進みます。",
};
const NOTE_14L_DEP: Text = {
  en: "14L departures use A-TWY to the C7 holding point.",
  ja: "14L 出発は A-TWY から C7 のホールディングポイントへ滑走します。",
};
const NOTE_14R_DEP: Text = {
  en: "14R departures use A-TWY to C6, cross RWY 14L, then continue to W10.",
  ja: "14R 出発は A-TWY から C6 で RWY 14L を横断し、W10 へ進みます。",
};

export const ARRIVALS: Table = {
  "32L": {
    Main: [
      { via: ["W9", "C4"], exits: ["W9R"], side: "R", strict: true, note: NOTE_32L_ARR, stands: [[0, 20]] },
      { via: ["W9", "C5"], exits: ["W9R"], side: "R", strict: true, note: NOTE_32L_ARR, stands: [[21, 84]] },
    ],
  },
  "32R": {
    Main: [{ via: [], side: "R", note: { en: "No single standard exit; the shortest suitable route to the Ramp is used.", ja: "標準退路が一つに限られないため、ランプへの最短適切経路を使用します。" } }],
  },
  "14L": {
    Main: [{ via: ["B4"], exits: ["B4R"], side: "R", strict: true, note: { en: "14L arrivals normally vacate at B4; the shortest suitable route from there to the Ramp is used.", ja: "14L 到着は通常 B4 で退路し、そこからランプへの最短適切経路を使用します。" } }],
  },
  "14R": {
    Main: [{ via: ["W3", "B3", "B4", "C1", "E1"], exits: ["W3L"], side: "L", strict: true, note: NOTE_14R_ARR }],
  },
};

export const DEPARTURES: Table = {
  "32L": {
    Main: [{ via: ["E1", "C1", "B4", "B3", "B2", "W2"], entry: "W2", strict: true, note: NOTE_32L_DEP }],
  },
  "32R": {
    Main: [{ via: ["E1", "C1"], entry: "C1", strict: true, note: NOTE_32R_DEP }],
  },
  "14L": {
    Main: [
      { via: ["A1", "A2", "A3", "A4", "A5", "C7"], entry: "C7", strict: true, note: NOTE_14L_DEP, stands: [[0, 8]] },
      { via: ["A2", "A3", "A4", "A5", "C7"], entry: "C7", strict: true, note: NOTE_14L_DEP, stands: [[9, 19]] },
      { via: ["A3", "A4", "A5", "C7"], entry: "C7", strict: true, note: NOTE_14L_DEP, stands: [[20, 53]] },
      { via: ["A5", "C7"], entry: "C7", strict: true, note: NOTE_14L_DEP, stands: [[54, 84]] },
    ],
  },
  "14R": {
    Main: [
      { via: ["A1", "A2", "A3", "A4", "C6", "W10"], entry: "W10", strict: true, note: NOTE_14R_DEP, stands: [[0, 8]] },
      { via: ["A2", "A3", "A4", "C6", "W10"], entry: "W10", strict: true, note: NOTE_14R_DEP, stands: [[9, 19]] },
      { via: ["A3", "A4", "C6", "W10"], entry: "W10", strict: true, note: NOTE_14R_DEP, stands: [[20, 53]] },
      { via: ["A5", "C6", "W10"], entry: "W10", strict: true, note: NOTE_14R_DEP, stands: [[54, 84]] },
    ],
  },
};

export function templates(table: Table, rwy: string, group: Group, flow: FlowId): Template[] {
  const list = (table[rwy]?.[group] ?? []).filter((t) => !t.flows || t.flows.includes(flow));
  return list.length ? list : [{ via: [], note: { en: "No published route; shortest path used", ja: "標準ルートなし · 最短経路を使用" } }];
}
