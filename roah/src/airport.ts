// Naha (ROAH) airport data model, configured on the shared Airport graph.
import {
  Airport as BaseAirport,
  type RawData as BaseRawData,
  type Stand as BaseStand,
} from "../../src/shared/airport.ts";

export { alongCross, dist, toLatLon, toLocal, type Adj, type Exit, type Junction, type Leg, type RawRunway, type RunwayEnd, type XY } from "../../src/shared/airport.ts";
export type Group = "Dom" | "Intl" | "Cargo";
export type RawData = BaseRawData<Group>;
export type Stand = BaseStand<Group>;

export class Airport extends BaseAirport<Group> {
  constructor(data: RawData) {
    super(data, {
      allowUnnamedPortal: true,
      legDedupeDist: 300,
      preferShallowLeg: true,
    });
  }
}
