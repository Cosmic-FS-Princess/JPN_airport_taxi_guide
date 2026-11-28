# Naha Airport Taxi Guide (ROAH)

An Apple-style, full-screen taxi route guide for Naha Airport (ROAH / OKA), built for flight simulation.
Pick a runway configuration, a runway, a stand and (optionally) a runway exit or entry point, and the
guide draws the standard taxi route on a gridded airport map with turn-by-turn steps.

The UI is available in **English** and **Japanese** (switch in the panel header).

> For flight simulation only. Not for real-world navigation. ATC instructions always take precedence.

## Features

- **Arrival mode** – runway exit → stand. Rapid exits and standard turn-offs are detected from the taxiway
  network, labelled with turn side (L/R) and distance from the threshold, and can be picked from the list
  or directly on the map. "Auto" selects a realistic exit for the published route.
- **Departure mode** – stand → runway holding point, defaulting to the full-length entry (`E10`, `E1`, `T9`, `T1`),
  with intersection entries (`E9`/`E8`, `E2`/`E3`, `T8`/`T7`, `T2`/`T3`) also selectable.
- **Dual-runway configurations** – North flow (`36L`/`36R`) and South flow (`18R`/`18L`). Offshore Runway 2
  (`18R/36L`, 2,700 m) is the default arrival runway and inboard Runway 1 (`18L/36R`, 3,000 m) is the default
  departure runway, with both runways selectable in either mode.
- **Standard runway crossings** – movements between Runway 2 (`18R/36L`) and the passenger/cargo aprons cross
  seawall bridges `J1`/`J2` and active Runway 1 (`18L/36R`) via `W2 → E3` (or `W3 → E4`), with crossings
  highlighted on the map and in the step list.
- **Terminals & aprons** – Domestic Terminal (`21–37`), International Terminal (`41–43R`), and Cargo & North
  Apron (`51–66`).
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
`pnpm test:roah` routes every one of the 33 stands on every runway in both arrival and departure mode
as a smoke test. All data the app needs is already in the repository, so no X-Plane install is required
to run it.

### Refreshing the data

```bash
pnpm extract:navdata:roah -- "<path to X-Plane 12/Custom Data>"  # new AIRAC cycle
pnpm fetch:osm:roah                                              # newer OSM geometry
pnpm data:roah                                                   # regenerate src/data/roah.json
```

## Data

| Source | File | Used for | Licence |
| --- | --- | --- | --- |
| X-Plane 12 Custom Data (Navigraph AIRAC, see `data/navdata/cycle.json`) | `data/navdata/ROAH.dat` | Runway thresholds and displaced thresholds | Navigraph / Jeppesen terms |
| OpenStreetMap via Overpass | `data/osm-roah.json` | Taxiways, stands, gates/jet bridges, aprons, terminals, runway ends | © OpenStreetMap contributors, ODbL |
| [GSI Tiles](https://maps.gsi.go.jp/development/ichiran.html) (`pale`, `seamlessphoto`) | loaded at runtime | Background map | Geospatial Information Authority of Japan (attribution shown on the map) |

`scripts/build-data.ts` merges the first two into `src/data/roah.json` (local metric coordinates around the ARP).

## Licence

GNU General Public License v2.0 — see [../LICENSE](../LICENSE).
