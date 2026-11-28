import "../../src/style.css";
import raw from "./data/roah.json";
import { Airport, type Group, type RawData } from "./airport.ts";
import i18n, { type ExtraKey } from "./i18n.ts";
import { MIN_EXIT_S, plan } from "./plan.ts";
import { FLOWS, type FlowId } from "./procedures.ts";
import { initGuide } from "../../src/shared/guide.ts";
import type { Lang } from "../../src/shared/i18n.ts";

const FLOW_SHORT: Record<FlowId, Record<Lang, [string, string, string]>> = {
  N: { en: ["North (36)", "36L/36R in", "36R/36L out"], ja: ["北風（36）", "36L/36R 着", "36R/36L 発"] },
  S: { en: ["South (18)", "18R/18L in", "18L/18R out"], ja: ["南風（18）", "18R/18L 着", "18L/18R 発"] },
};

initGuide<FlowId, Group, ExtraKey>({
  airport: new Airport(raw as unknown as RawData),
  storeKey: "roah-taxi-guide",
  defaultFlow: "N",
  defaultRunway: "36L",
  flows: FLOWS,
  flowShort: (id, lang, mode) => [FLOW_SHORT[id][lang][0], FLOW_SHORT[id][lang][mode === "arr" ? 1 : 2]],
  runwayNames: { "18L/36R": "rwy1", "18R/36L": "rwy2" },
  groups: ["Dom", "Intl", "Cargo"],
  groupKeys: { Dom: "groupDom", Intl: "groupIntl", Cargo: "groupCargo" },
  i18n,
  plan,
  minExitS: MIN_EXIT_S,
  depFilterSide: true,
  standGroupInMapTitle: true,
});
