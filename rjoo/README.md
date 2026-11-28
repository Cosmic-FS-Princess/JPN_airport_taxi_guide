# Osaka Itami Taxi Guide (RJOO)

An Apple-style, full-screen taxi route guide for Osaka Itami (RJOO), built for flight simulation.
Pick a runway configuration, a runway, a stand and (optionally) a runway exit or entry point, and the
guide draws the standard taxi route on a gridded airport map with turn-by-turn steps.

The UI is available in **English** and **Japanese** (switch in the panel header).

> For flight simulation only. Not for real-world navigation. ATC instructions always take precedence.

## Features

- **Arrival mode** – runway exit → stand. Exits are detected from the taxiway network, labelled with
  turn side (L/R) and distance from the threshold, and can be picked from the list or on the map.
  "Auto" picks a realistic exit for the published route.
- **Departure mode** – stand → runway holding point, with the published entry (C1, C6, C7, W2 or W10) as default.
- **Runway configurations** – North flow (32L/32R in/out) and South flow (14L/14R in/out). Both runway
  directions in each flow remain selectable for simulation.
- **Published taxi logic** – each runway/stand-area combination has one or more standard routes.
- **Runway crossings** are flagged on the map and in the step list.
- **Chart grid** – 500 m cells (columns A–Z without I/O, rows 1–n) with edge rulers; every step and stand shows its grid reference.
- **GSI background map** – the pale map or aerial photo from GSI Tiles (Geospatial Information Authority of Japan), or no background. Switch with the layers button.
- Full-screen map with pan, wheel/pinch zoom, taxiway signs, hover highlighting, light/dark mode and a mobile bottom sheet.

## Getting started

This guide is part of the combined [JPN Airport Taxi Guides](../README.md) site: the
chooser at the repository root links to it. Install and run once at the repository root:

```bash
pnpm install
pnpm dev
```

Chooser and all guides are served together. `pnpm build` produces the static site in `dist/`.
`pnpm test:rjoo` routes every one of the 56 stands on every runway in both arrival and departure mode
as a smoke test. All data the app needs is already in the repository, so no X-Plane install is required
to run it.

### Refreshing the data

```bash
pnpm extract:navdata:rjoo -- "<path to X-Plane 12/Custom Data>"  # new AIRAC cycle
pnpm fetch:osm:rjoo                                              # newer OSM geometry
pnpm data:rjoo                                                   # regenerate src/data/rjoo.json
```

`extract:navdata` copies only what the guide uses out of X-Plane's `Custom Data`: the `RWY:` records from
`CIFP/RJOO.dat` go into `data/navdata/RJOO.dat`, and the AIRAC cycle info goes into `data/navdata/cycle.json`.
It defaults to `K:/SteamLibrary/steamapps/common/X-Plane 12/Custom Data`, or you can set `XPLANE_CUSTOM_DATA`.

## Data

| Source | File | Used for | Licence |
| --- | --- | --- | --- |
| X-Plane 12 Custom Data (Navigraph AIRAC, see `data/navdata/cycle.json`) | `data/navdata/RJOO.dat` | Runway thresholds and displaced thresholds | Navigraph / Jeppesen terms |
| OpenStreetMap via Overpass | `data/osm-rjoo.json` | Taxiways, stands, aprons, terminals, runway ends | © OpenStreetMap contributors, ODbL |
| [GSI Tiles](https://maps.gsi.go.jp/development/ichiran.html) (`pale`, `seamlessphoto`) | loaded at runtime | Background map | Geospatial Information Authority of Japan (attribution shown on the map) |

`scripts/build-data.ts` merges the first two into `src/data/rjoo.json` (local metric coordinates around the ARP).

## How routing works

1. Taxiway ways become an undirected graph. Stands connect to it through their OSM lead-in lines (or
   the nearest taxiway segment).
2. Runway centerlines come from the CIFP thresholds. Taxiway nodes within 14 m of a centerline are runway
   nodes. Named taxiways connected through short unnamed OSM connectors are traced through those
   connectors (up to 250 m) to the runway. That gives exits and entries, and lets the router penalise
   crossings and forbid back-taxi on the active runway.
3. Each published route is a list of taxiways (`src/procedures.ts`). The router (`src/router.ts`) runs
   Dijkstra over `(directed edge, progress)` states. Edges on the current or next listed taxiway cost 1×,
   unnamed apron lines cost 1.35×, and any other taxiway costs 2.4×. So the path follows the published
   flow and still connects through short links; finishing the route without a listed taxiway costs 4 km,
   and one taxiway of the list may be skipped at a fixed cost instead of detouring just to touch it.
   Because the state is the edge just travelled, turns sharper than 105° are not allowed at a junction
   (metre-long junction stubs are exempt, their direction is noise). Every degree of turning costs a
   little, and so does every change of taxiway name, so gentle curves can't add up to a loop and the
   path doesn't weave between parallel taxiways. Arrivals must also enter the stand
   lead-in line in the direction of travel, and the turn out of it is charged on departure; departures
   must reach the runway along the chosen entry taxiway.
   The finished path is then inspected for the two detours a taxi clearance never contains: a closed
   excursion that leaves a junction and comes back to it, and a reversal that sweeps round a long fillet.
   When one is found, the search is repeated with those edges excluded, so the result is the shortest
   path that still makes sense to taxi. A published taxiway that cannot be reached without such a detour
   is left out and reported as missed rather than driven around.
4. Exits and entries are traced back to their true turn-off point, where the taxiway leaves the runway
   pavement rather than where it happens to touch the centerline — a shallow connector would otherwise
   be pulled hundreds of metres down the runway and onto its neighbour's junction. An exit
   must leave at 100° or less to the landing direction. An entry must not need more than a 105° turn onto
   the runway (140° within 300 m of the runway end). So high-speed exits built for the opposite
   direction are never offered. When an exit or entry is picked by hand, published-route options that
   come out more than 35% longer than the best one are dropped.
5. The path is grouped into steps by taxiway name, with turn direction and runway-crossing callouts.

## Credits

Built by [lpxlpx7](https://github.com/lpxlpx7) and [xiaotian7196](https://github.com/xiaotian7196).
Source: <https://github.com/xiaotian7196/Osaka_Itami_taxi_route_manual>.

Taxi logic follows the Squawk.ID [RJOO landing guide](https://squawk.id/vatsim-commentary/for-all-members/airport/rjoo/osaka-international-airport-land/)
and [Osaka Itami departure guide](https://squawk.id/vatsim-commentary/for-all-members/airport/osaka-international-airport-dep/),
together with published charts and simulation community guidelines for RJOO.

## Project layout

Core graph, routing, SVG map and UI controller live in `../src/shared/`; this directory holds the
Itami-specific dataset, taxi logic and configuration:

```
index.html            app shell
src/main.ts           guide config calling ../src/shared/guide.ts
src/airport.ts        RJOO Airport config extending ../src/shared/airport.ts
src/plan.ts           selection → routed options via ../src/shared/plan.ts
src/procedures.ts     published taxi routes per runway / stand range
src/i18n.ts           Itami-specific English / Japanese strings
src/data/rjoo.json    compiled metric airport graph
scripts/              nav data extract, OSM fetch, data build, route & loop tests
data/navdata/         runway records extracted from X-Plane Custom Data
RJOO.png              app icon
```

## Licence

Copyright (C) 2026 xiaotian7196.

This project is free software, released under the **GNU General Public License, version 2**
(SPDX: `GPL-2.0-only`). You may copy, modify and redistribute it under the terms of that licence; the
full text is in [../LICENSE](../LICENSE).

It is distributed in the hope that it will be useful, but **without any warranty**, without even the
implied warranty of merchantability or fitness for a particular purpose. See the GNU General Public
License for details.

The licence covers the guide's own source code. Bundled third-party data keeps its own terms — see the
Data table above: the OpenStreetMap extract is © OpenStreetMap contributors under the ODbL, and the
runway records come from Navigraph / Jeppesen.
