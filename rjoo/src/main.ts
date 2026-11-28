import "../../src/style.css";
import raw from "./data/rjoo.json";
import { Airport, type Group, type RawData } from "./airport.ts";
import i18n, { type ExtraKey } from "./i18n.ts";
import { MIN_EXIT_S, plan } from "./plan.ts";
import { FLOWS, type FlowId } from "./procedures.ts";
import { initGuide } from "../../src/shared/guide.ts";
import type { Lang } from "../../src/shared/i18n.ts";

const FLOW_SHORT: Record<FlowId, Record<Lang, [string, string, string]>> = {
  N: { en: ["North", "32L/32R in", "32L/32R out"], ja: ["北風", "32L/32R 着", "32L/32R 発"] },
  S: { en: ["South", "14L/14R in", "14L/14R out"], ja: ["南風", "14L/14R 着", "14L/14R 発"] },
};

initGuide<FlowId, Group, ExtraKey>({
  airport: new Airport(raw as unknown as RawData),
  storeKey: "rjoo-taxi-guide",
  defaultFlow: "N",
  defaultRunway: "32L",
  flows: FLOWS,
  flowShort: (id, lang, mode) => [FLOW_SHORT[id][lang][0], FLOW_SHORT[id][lang][mode === "arr" ? 1 : 2]],
  runwayNames: { "14L/32R": "rwyA", "14R/32L": "rwyB" },
  groups: ["Main"],
  groupKeys: { Main: "groupMain" },
  i18n,
  plan,
  minExitS: MIN_EXIT_S,
  standGroupInMapTitle: true,
});
