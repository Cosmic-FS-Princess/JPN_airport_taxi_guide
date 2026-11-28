import "../../src/style.css";
import raw from "./data/rjaa.json";
import { Airport, type Group, type RawData } from "./airport.ts";
import i18n, { type ExtraKey } from "./i18n.ts";
import { MIN_EXIT_S, plan } from "./plan.ts";
import { FLOWS, LVP, type FlowId } from "./procedures.ts";
import { initGuide } from "../../src/shared/guide.ts";
import type { Lang } from "../../src/shared/i18n.ts";

const FLOW_SHORT: Record<FlowId, Record<Lang, [string, string]>> = {
  S: { en: ["South", "16R/16L in"], ja: ["南風", "16R/16L 着"] },
  N: { en: ["North", "34L/34R in"], ja: ["北風", "34L/34R 着"] },
};

initGuide<FlowId, Group, ExtraKey>({
  airport: new Airport(raw as unknown as RawData),
  storeKey: "rjaa-taxi-guide",
  defaultFlow: "S",
  defaultRunway: "16R",
  flows: FLOWS,
  flowShort: (id, lang) => FLOW_SHORT[id][lang],
  runwayNames: { "16R/34L": "rwyA", "16L/34R": "rwyB" },
  groups: ["T1", "T2", "T3"],
  groupKeys: { T1: "groupT1", T2: "groupT2", T3: "groupT3" },
  i18n,
  plan,
  minExitS: MIN_EXIT_S,
  fullThreshold: 100,
  lvp: LVP,
});
