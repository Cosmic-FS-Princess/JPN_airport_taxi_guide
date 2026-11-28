// Downloads RJTT aeroway geometry from OpenStreetMap (ODbL) via Overpass.
// Usage: pnpm fetch:osm:haneda
import { fetchOsm } from "../../scripts/shared.ts";

await fetchOsm({
  bbox: "35.525,139.74,35.575,139.83",
  outFile: new URL("../data/osm-rjtt.json", import.meta.url),
});
