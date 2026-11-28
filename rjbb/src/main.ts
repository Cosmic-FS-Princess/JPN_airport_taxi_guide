import "../../src/style.css";
import raw from "./data/rjbb.json";
import { Airport, type Group, type RawData } from "./airport.ts";
import i18n, { type ExtraKey } from "./i18n.ts";
import { MIN_EXIT_S, plan } from "./plan.ts";
import { FLOWS, type FlowId } from "./procedures.ts";
import { initGuide } from "../../src/shared/guide.ts";
import type { Lang } from "../../src/shared/i18n.ts";

const FLOW_SHORT: Record<FlowId, Record<Lang, [string, string, string]>> = {
  N: { en: ["North (06)", "06R/06L in", "06L/06R out"], ja: ["北風（06）", "06R/06L 着", "06L/06R 発"] },
  S: { en: ["South (24)", "24L/24R in", "24R/24L out"], ja: ["南風（24）", "24L/24R 着", "24R/24L 発"] },
};

initGuide<FlowId, Group, ExtraKey>({
  airport: new Airport(raw as unknown as RawData),
  storeKey: "rjbb-taxi-guide",
  defaultFlow: "N",
  defaultRunway: "06R",
  flows: FLOWS,
  flowShort: (id, lang, mode) => [FLOW_SHORT[id][lang][0], FLOW_SHORT[id][lang][mode === "arr" ? 1 : 2]],
  runwayNames: { "06R/24L": "rwyA", "06L/24R": "rwyB" },
  groups: ["T1", "T2", "S", "N"],
  groupKeys: { T1: "groupT1", T2: "groupT2", S: "groupS", N: "groupN" },
  i18n,
  plan,
  minExitS: MIN_EXIT_S,
  standGroupInMapTitle: true,
});
