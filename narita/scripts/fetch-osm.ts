// Downloads RJAA aeroway geometry from OpenStreetMap (ODbL) via Overpass.
// Usage: pnpm fetch:osm:narita
import { fetchOsm } from "../../scripts/shared.ts";

await fetchOsm({
  bbox: "35.685,140.305,35.825,140.465",
  timeout: 180,
  outFile: new URL("../data/osm-rjaa.json", import.meta.url),
});
