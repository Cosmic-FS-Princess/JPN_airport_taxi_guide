// Turns a user selection into one routed option per published template for ROAH.
import type { Airport } from "./airport.ts";
import { ARRIVALS, DEPARTURES, templates, type FlowId, type Template } from "./procedures.ts";
import { planStandard, type BasePlanOption, type BasePlanRequest } from "../../src/shared/plan.ts";

export type PlanRequest = BasePlanRequest<FlowId>;
export type PlanOption = BasePlanOption<Template>;
export { bestIndex, exitKey } from "../../src/shared/plan.ts";

export const MIN_EXIT_S = 1300;
const LIKELY_EXIT_S = 1900;

export function plan(ap: Airport, req: PlanRequest): PlanOption[] {
  return planStandard(ap, req, {
    minExitS: MIN_EXIT_S,
    likelyExitS: LIKELY_EXIT_S,
    templates: (mode, rwy, group, flow) => templates(mode === "arr" ? ARRIVALS : DEPARTURES, rwy, group, flow),
    excludeStopEnd: true,
    preferSameSideDep: true,
  });
}
