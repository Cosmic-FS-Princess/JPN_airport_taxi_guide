// Downloads RJCC (New Chitose) aeroway geometry from OpenStreetMap (ODbL) via Overpass.
// Usage: pnpm fetch:osm:rjcc
import { fetchOsm } from "../../scripts/shared.ts";

await fetchOsm({
  bbox: "42.74,141.65,42.81,141.73",
  outFile: new URL("../data/osm-rjcc.json", import.meta.url),
});
