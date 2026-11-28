// Downloads RJOO aeroway geometry from OpenStreetMap (ODbL) via Overpass.
// Usage: pnpm fetch:osm:rjoo
import { fetchOsm } from "../../scripts/shared.ts";

await fetchOsm({
  bbox: "34.76,135.40,34.81,135.46",
  outFile: new URL("../data/osm-rjoo.json", import.meta.url),
});
