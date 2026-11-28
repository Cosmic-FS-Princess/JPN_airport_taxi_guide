// Haneda (RJTT) airport data model, configured on the shared Airport graph.
import {
  Airport as BaseAirport,
  type RawData as BaseRawData,
  type Stand as BaseStand,
} from "../../src/shared/airport.ts";

export { alongCross, dist, toLatLon, toLocal, type Adj, type Exit, type Junction, type Leg, type RawRunway, type RunwayEnd, type XY } from "../../src/shared/airport.ts";
export type Group = "T1" | "T2" | "T3";
export type RawData = BaseRawData<Group>;
export type Stand = BaseStand<Group>;

export class Airport extends BaseAirport<Group> {
  constructor(data: RawData) {
    super(data, {
      // Runway 23 has turn-offs on one side only, so D3/D4 built for 05 are also used.
      exitAngleLimit: (ident) => (ident === "23" ? 115 : 100),
    });
  }
}
