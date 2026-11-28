// Shared helpers for Node data extraction and Overpass OSM fetch scripts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DEFAULT_CUSTOM_DATA = "D:/Project/JPN_airport_taxi_guide/Custom Data";

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export function extractNavdata(icao: string, outDir: URL, defaultPath = DEFAULT_CUSTOM_DATA) {
  const customData = process.argv[2] ?? process.env.XPLANE_CUSTOM_DATA ?? defaultPath;
  const cifp = `${customData}/CIFP/${icao}.dat`;
  if (!existsSync(cifp)) {
    console.error(`Not found: ${cifp}\nPass the X-Plane 12 "Custom Data" folder as an argument.`);
    process.exit(1);
  }
  const rwy = readFileSync(cifp, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.startsWith("RWY:"));
  if (!rwy.length) throw new Error(`no RWY records in ${cifp}`);

  let cycle: Record<string, string> = {};
  try {
    const c = JSON.parse(readFileSync(`${customData}/cycle.json`, "utf8"));
    cycle = { cycle: c.cycle, revision: c.revision, validityPeriod: c.validityPeriod, provider: c.provider };
  } catch {
    /* cycle.json is optional */
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(new URL(`${icao}.dat`, outDir), rwy.join("\n") + "\n");
  writeFileSync(new URL("cycle.json", outDir), JSON.stringify({ airport: icao, ...cycle, records: rwy.length }, null, 2) + "\n");
  console.log(`data/navdata/${icao}.dat: ${rwy.length} runway records (AIRAC ${cycle.cycle ?? "?"})`);
}

export async function fetchOsm(opts: { bbox: string; outFile: URL; timeout?: number; extraQuery?: string }) {
  const timeout = opts.timeout ?? 90;
  const query = `[out:json][timeout:${timeout}];(
way["aeroway"~"taxiway|runway|apron|terminal|taxilane|parking_position|holding_position|stopway|jet_bridge"](${opts.bbox});
way["building"="terminal"](${opts.bbox});
relation["aeroway"~"terminal|apron"](${opts.bbox});
relation["building"="terminal"](${opts.bbox});
node["aeroway"~"parking_position|gate|holding_position"](${opts.bbox});${opts.extraQuery ? `\n${opts.extraQuery}` : ""}
);out geom;`;

  let body = "";
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "taxi-guide-script" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout((timeout + 30) * 1000),
      });
      if (!res.ok) { console.warn(`${url} -> HTTP ${res.status}`); continue; }
      const text = await res.text();
      const json = JSON.parse(text);
      if (!json.elements?.length) { console.warn(`${url} -> no elements`); continue; }
      body = text;
      console.log(`${url} -> ${json.elements.length} elements`);
      break;
    } catch (e) {
      console.warn(`${url} -> ${(e as Error).message}`);
    }
  }
  if (!body) throw new Error("all Overpass mirrors failed");
  mkdirSync(new URL("./", opts.outFile), { recursive: true });
  writeFileSync(opts.outFile, body);
  console.log(`saved ${opts.outFile.pathname}`);
}
