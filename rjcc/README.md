# New Chitose Airport Taxi Guide (RJCC)

An Apple-style, full-screen taxi route guide for New Chitose Airport (RJCC / CTS), built for flight simulation.
Pick a runway configuration, a runway, a stand and (optionally) a runway exit or entry point, and the
guide draws the standard taxi route on a gridded airport map with turn-by-turn steps.

The UI is available in **English** and **Japanese** (switch in the panel header).

> For flight simulation only. Not for real-world navigation. ATC instructions always take precedence.

## Features

- **Arrival mode** – runway exit → stand. Rapid exits (`B4`/`B5`, `B9`/`B10`, `A5`/`A6`, `A8`/`A9S`) and
  standard turn-offs are detected from the taxiway network, labelled with turn side (L/R) and distance
  from the threshold, and can be picked from the list or on the map. "Auto" selects a realistic exit.
- **Departure mode** – stand → runway holding point, defaulting to the full-length entry (`A12`, `B12`,
  `A2`, `B3`), with intersection entries (`A11`/`A10`, `B11`, `A3`) also selectable.
- **Parallel-runway configurations** – North flow (`01R`/`01L`) and South flow (`19L`/`19R`). Outboard
  Runway B (`01R/19L`, 3,000 m × 60 m) is the default arrival runway and inboard Runway A (`01L/19R`,
  3,000 m × 60 m) is the default departure runway, with both runways selectable in either mode.
- **Standard runway crossings** – movements between Runway B (`01R/19L`) and the passenger/cargo aprons
  cross active Runway A (`01L/19R`) via the paired `B`/`A` connectors under ATC clearance, highlighted on
  the map and in the step list.
- **Terminals & aprons** – 64 civil stands across the crescent Domestic Terminal (`0–27`), International
  Terminal (`63–71`), North Remote Apron (`44–62`) and Cargo Apron (`80–91`). Adjacent JASDF Chitose Air
  Base (`RJCJ`, runways `18L/36R` & `18R/36L`) is excluded from the civil graph.
- **Chart grid & GSI basemap** – 500 m cells with edge rulers, GSI pale map / aerial photo switcher,
  light/dark mode and a mobile bottom sheet.

## Getting started

This guide is part of the combined [JPN Airport Taxi Guides](../README.md) site. Install and run once at
the repository root:

```bash
pnpm install
pnpm dev
```

`pnpm test:rjcc` routes all 64 stands on every runway in both arrival and departure mode, and
`node rjcc/scripts/test-loops.ts` verifies zero loops or self-intersections across all 3,394 combinations.

### Refreshing the data

```bash
pnpm extract:navdata:rjcc -- "<path to X-Plane 12/Custom Data>"  # new AIRAC cycle
pnpm fetch:osm:rjcc                                              # newer OSM geometry
pnpm data:rjcc                                                   # regenerate src/data/rjcc.json
```

## Data

| Source | File | Used for | Licence |
| --- | --- | --- | --- |
| X-Plane 12 Custom Data (Navigraph AIRAC, see `data/navdata/cycle.json`) | `data/navdata/RJCC.dat` | Runway thresholds | Navigraph / Jeppesen terms |
| OpenStreetMap via Overpass | `data/osm-rjcc.json` | Taxiways, stands, aprons, terminals, runway ends | © OpenStreetMap contributors, ODbL |
| [GSI Tiles](https://maps.gsi.go.jp/development/ichiran.html) (`pale`, `seamlessphoto`) | loaded at runtime | Background map | Geospatial Information Authority of Japan |

`scripts/build-data.ts` filters out adjacent RJCJ military elements, planarizes unjoined taxiway crossings,
snaps OSM micro-gaps (`A8`, `A9`, `D1`, `L3`, `B10S`), fixes the `B12` runway-end tag, and outputs
`src/data/rjcc.json`.

## Project layout

```
index.html            app shell
src/main.ts           guide config calling ../src/shared/guide.ts
src/airport.ts        RJCC Airport config extending ../src/shared/airport.ts
src/procedures.ts     standard flows and taxi templates per runway / apron
src/plan.ts           selection → routed options via ../src/shared/plan.ts
src/i18n.ts           RJCC-specific English / Japanese strings
src/data/rjcc.json    compiled metric airport graph
scripts/              navdata extract, OSM fetch, data build, route & loop tests
data/navdata/         runway records extracted from X-Plane Custom Data
RJCC.png              app icon
```

## Licence

GNU General Public License v2.0 — see [../LICENSE](../LICENSE).
