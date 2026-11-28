// Downloads RJBB aeroway geometry from OpenStreetMap (ODbL) via Overpass.
// Usage: pnpm fetch:osm:rjbb
import { fetchOsm } from "../../scripts/shared.ts";

await fetchOsm({
  bbox: "34.40,135.19,34.47,135.28",
  outFile: new URL("../data/osm-rjbb.json", import.meta.url),
});
