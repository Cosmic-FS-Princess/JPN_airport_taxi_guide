// Downloads ROAH aeroway geometry from OpenStreetMap (ODbL) via Overpass.
// Includes building=terminal and jet_bridge ways so the passenger terminal and
// domestic contact gates (mapped as aeroway=gate in OSM) resolve cleanly.
// Usage: npm run fetch:osm:roah
import { writeFileSync } from "node:fs";

const BBOX = "26.16,127.61,26.23,127.67";
const query = `[out:json][timeout:90];(
way["aeroway"~"taxiway|runway|apron|terminal|taxilane|parking_position|holding_position|stopway|jet_bridge"](${BBOX});
way["building"="terminal"](${BBOX});
relation["aeroway"~"terminal|apron"](${BBOX});
relation["building"="terminal"](${BBOX});
node["aeroway"~"parking_position|gate|holding_position"](${BBOX});
);out geom;`;

const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "taxi-guide-script" },
  body: "data=" + encodeURIComponent(query),
});
if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
writeFileSync(new URL("../data/osm-roah.json", import.meta.url), await res.text());
console.log("saved data/osm-roah.json");
