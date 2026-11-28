// Downloads RJOO aeroway geometry from OpenStreetMap (ODbL) via Overpass.
// Usage: npm run fetch:osm:rjoo
import { writeFileSync } from "node:fs";

const BBOX = "34.76,135.40,34.81,135.46";
const query = `[out:json][timeout:90];(
way["aeroway"~"taxiway|runway|apron|terminal|taxilane|parking_position|holding_position|stopway"](${BBOX});
node["aeroway"~"parking_position|gate|holding_position"](${BBOX});
);out geom;`;

const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "taxi-guide-script" },
  body: "data=" + encodeURIComponent(query),
});
if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
writeFileSync(new URL("../data/osm-rjoo.json", import.meta.url), await res.text());
console.log("saved data/osm-rjoo.json");