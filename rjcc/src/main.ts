import "../../src/style.css";
import raw from "./data/rjcc.json";
import { Airport, type Group, type RawData } from "./airport.ts";
import i18n, { type ExtraKey } from "./i18n.ts";
import { MIN_EXIT_S, plan } from "./plan.ts";
import { FLOWS, type FlowId } from "./procedures.ts";
import { initGuide } from "../../src/shared/guide.ts";
import type { Lang } from "../../src/shared/i18n.ts";

const FLOW_SHORT: Record<FlowId, Record<Lang, [string, string, string]>> = {
  N: { en: ["North (01)", "01R/01L in", "01L/01R out"], ja: ["北風（01）", "01R/01L 着", "01L/01R 発"] },
  S: { en: ["South (19)", "19L/19R in", "19R/19L out"], ja: ["南風（19）", "19L/19R 着", "19R/19L 発"] },
};

initGuide<FlowId, Group, ExtraKey>({
  airport: new Airport(raw as unknown as RawData),
  storeKey: "rjcc-taxi-guide",
  defaultFlow: "N",
  defaultRunway: "01R",
  flows: FLOWS,
  flowShort: (id, lang, mode) => [FLOW_SHORT[id][lang][0], FLOW_SHORT[id][lang][mode === "arr" ? 1 : 2]],
  runwayNames: { "01L/19R": "rwyA", "01R/19L": "rwyB" },
  groups: ["Dom", "Intl", "North", "Cargo"],
  groupKeys: { Dom: "groupDom", Intl: "groupIntl", North: "groupNorth", Cargo: "groupCargo" },
  i18n,
  plan,
  minExitS: MIN_EXIT_S,
  fullThreshold: 60,
  depFilterSide: true,
  standGroupInMapTitle: true,
});
