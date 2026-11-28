// Downloads ROAH aeroway geometry from OpenStreetMap (ODbL) via Overpass.
// Usage: pnpm fetch:osm:roah
import { fetchOsm } from "../../scripts/shared.ts";

await fetchOsm({
  bbox: "26.16,127.61,26.23,127.67",
  outFile: new URL("../data/osm-roah.json", import.meta.url),
});
