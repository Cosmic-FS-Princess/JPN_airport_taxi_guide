# Kansai International Taxi Guide (RJBB)

An Apple-style, full-screen taxi route guide for Kansai International Airport (RJBB / KIX), built for flight simulation.
Pick a runway configuration, a runway, a stand and (optionally) a runway exit or entry point, and the
guide draws the standard taxi route on a gridded airport map with turn-by-turn steps.

The UI is available in **English** and **Japanese** (switch in the panel header).

> For flight simulation only. Not for real-world navigation. ATC instructions always take precedence.

## Features

- **Arrival mode** – runway exit → stand. Rapid exits and standard turn-offs are detected from the taxiway
  network, labelled with turn side (L/R) and distance from the threshold, and can be picked from the list
  or directly on the map. "Auto" selects a realistic exit for the published route.
- **Departure mode** – stand → runway holding point, defaulting to the full-length entry (`A14`, `A1`, `B14`, `B1`),
  with intersection entries (`A13`/`A12`, `A2`/`A3`, `B12`, `B3`) also selectable.
- **Runway configurations** – North flow (`06R`/`06L`) and South flow (`24L`/`24R`). Runway A (`06R/24L`, 3,500 m)
  is the default arrival runway and Runway B (`06L/24R`, 4,000 m) is the default departure runway, with both runways
  selectable in either mode for mixed-mode or maintenance operations.
- **Two artificial islands** – Terminal 1 (`1–41`, `V1`, `601–604`), Terminal 2 (`80–99R`), South Cargo & Remote
  (`101–111`, `201–215`, `306–307`, `M2–M9`), and Island 2 Cargo (`251–257`), linked via the `J3` and `J4`
  inter-island connecting taxiways.
- **Chart grid** – 500 m cells (columns A–Z without I/O, rows 1–n) with edge rulers; every step and stand shows its grid reference.
- **GSI background map** – the pale map or aerial photo from GSI Tiles (Geospatial Information Authority of Japan), or no background. Switch with the layers button.
- Full-screen map with pan, wheel/pinch zoom, taxiway signs, hover highlighting, light/dark mode and a mobile bottom sheet.

## Getting started

This guide is part of the combined [JPN Airport Taxi Guides](../README.md) site: the chooser at the repository
root links to it. Install and run once at the repository root:

```bash
pnpm install
pnpm dev
```

Chooser and all guides are served together. `pnpm build` produces the static site in `dist/`.
`pnpm test:rjbb` routes every one of the 113 stands on every runway in both arrival and departure mode
as a smoke test. All data the app needs is already in the repository, so no X-Plane install is required
to run it.

### Refreshing the data

```bash
pnpm extract:navdata:rjbb -- "<path to X-Plane 12/Custom Data>"  # new AIRAC cycle
pnpm fetch:osm:rjbb                                              # newer OSM geometry
pnpm data:rjbb                                                   # regenerate src/data/rjbb.json
```

`extract:navdata:rjbb` copies only what the guide uses out of X-Plane's `Custom Data`: the `RWY:` records from
`CIFP/RJBB.dat` go into `data/navdata/RJBB.dat`, and the AIRAC cycle info goes into `data/navdata/cycle.json`.

## Data

| Source | File | Used for | Licence |
| --- | --- | --- | --- |
| X-Plane 12 Custom Data (Navigraph AIRAC, see `data/navdata/cycle.json`) | `data/navdata/RJBB.dat` | Runway thresholds and displaced thresholds | Navigraph / Jeppesen terms |
| OpenStreetMap via Overpass | `data/osm-rjbb.json` | Taxiways, stands, aprons, terminals, runway ends | © OpenStreetMap contributors, ODbL |
| [GSI Tiles](https://maps.gsi.go.jp/development/ichiran.html) (`pale`, `seamlessphoto`) | loaded at runtime | Background map | Geospatial Information Authority of Japan (attribution shown on the map) |

`scripts/build-data.ts` merges the first two into `src/data/rjbb.json` (local metric coordinates around the ARP).

## Project layout

Core graph, routing, SVG map and UI controller live in `../src/shared/`; this directory holds the
Kansai-specific dataset, taxi logic and configuration:

```
index.html            app shell
src/main.ts           guide config calling ../src/shared/guide.ts
src/airport.ts        RJBB Airport config extending ../src/shared/airport.ts
src/plan.ts           selection → routed options via ../src/shared/plan.ts
src/procedures.ts     standard flows and taxi templates per runway / apron
src/i18n.ts           Kansai-specific English / Japanese strings
src/data/rjbb.json    compiled metric airport graph
scripts/              nav data extract, OSM fetch, data build, route & loop tests
data/navdata/         runway records extracted from X-Plane Custom Data
RJBB.png              app icon
```

## Licence

GNU General Public License v2.0 — see [../LICENSE](../LICENSE).
