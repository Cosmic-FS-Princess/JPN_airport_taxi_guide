# JPN Airport Taxi Guides

An Apple-style, full-screen taxi route guide for six major Japanese airports — **Haneda (RJTT)**,
**Narita (RJAA)**, **Osaka Itami (RJOO)**, **Kansai (RJBB)**, **Naha (ROAH)** and **New Chitose (RJCC)** —
built for flight simulation. The site opens on an airport chooser; each guide shares a common routing,
map and UI engine while keeping its own airport data, runway configurations, stands and published taxi logic.

**Live:** <https://jpntaxi.ソラ.jp/> (punycode `jpntaxi.xn--3ckue.jp`)

Pick a runway configuration, a runway, a stand and (optionally) a runway exit or entry point, and the
guide draws the standard taxi route on a gridded airport map with turn-by-turn steps. The UI is
available in **English** and **Japanese**; the chooser passes the selected language on to the guide.

![Airport chooser](docs/chooser.png)

On a phone the airport cards stack into one column:

<img src="docs/chooser-mobile.png" alt="Airport chooser on a phone" width="320" />

> For flight simulation only. Not for real-world navigation. ATC instructions always take precedence.

## The six guides

| | Haneda | Narita | Osaka Itami | Kansai | Naha | New Chitose |
| --- | --- | --- | --- | --- | --- | --- |
| Code | RJTT · Tokyo International | RJAA · Narita International | RJOO · Osaka International | RJBB · Kansai International | ROAH · Naha Airport | RJCC · New Chitose Airport |
| Runways | 16R/34L, 16L/34R, 04/22, 05/23 | 16R/34L, 16L/34R | 14L/32R, 14R/32L | 06R/24L, 06L/24R | 18L/36R, 18R/36L | 01L/19R, 01R/19L |
| Flows | North, South · Bay, South · City | South (16), North (34) | North (32), South (14) | North (06), South (24) | North (36), South (18) | North (01), South (19) |
| Highlights | 4 runways, 3 terminals, L12 runout & published exits | AIP ROUTE 7–10, mandatory `GWY` apron gateways, CAT II/III LVP | Standard `14L/32R` crossings, Squawk.ID arrival/departure routes | Two artificial islands linked by `J3`/`J4`, 113 stands across T1/T2/Cargo | Offshore Runway 2, `J1`/`J2` seawall bridges, `18L/36R` crossings | Closely spaced parallel `01L/19R` & `01R/19L`, 64 stands across Dom/Intl/North/Cargo |
| Details | [haneda/README.md](haneda/README.md) | [narita/README.md](narita/README.md) | [rjoo/README.md](rjoo/README.md) | [rjbb/README.md](rjbb/README.md) | [roah/README.md](roah/README.md) | [rjcc/README.md](rjcc/README.md) |

## Getting started

Requirements: **Node.js 22.6+** (data and test scripts run TypeScript directly via native type stripping) and **pnpm**.

```bash
pnpm install
pnpm dev      # chooser at /, guides at /haneda/, /narita/, /rjoo/, /rjbb/, /roah/ and /rjcc/
pnpm build    # type-check all guides + build static site in dist/
pnpm preview  # serve the production build locally
pnpm test     # route smoke tests for all six airports
```

Additional checks:

```bash
pnpm test:loops   # verify no routes wind excessively, revisit junctions, or self-intersect
pnpm test:extras  # full Narita sweep + all six loop checks
```

Per-airport smoke tests (`pnpm test:haneda`, `pnpm test:narita`, `pnpm test:rjoo`, `pnpm test:rjbb`,
`pnpm test:roah`, `pnpm test:rjcc`) verify every stand on RJOO (56), RJBB (113), ROAH (33) and RJCC (64)
in both arrival and departure mode, plus every flow/runway/terminal combination on Haneda and Narita.
All compiled airport datasets are checked into the repository, so no X-Plane installation is required.

### Refreshing the airport data

Each guide keeps its own data pipeline under `<airport>/scripts/`, built on shared helpers in
[scripts/shared.ts](scripts/shared.ts). From the repository root:

```bash
# Replace <key> with haneda | narita | rjoo | rjbb | roah | rjcc
pnpm extract:navdata:<key> -- "<path to X-Plane 12/Custom Data>"  # new AIRAC cycle
pnpm fetch:osm:<key>                                              # newer OSM geometry
pnpm data:<key>                                                   # regenerate <key>/src/data/*.json
```

After refreshing any airport's dataset, regenerate the chooser SVG previews and commit the result:

```bash
pnpm previews   # rewrites src/previews.ts
```

For Narita, runway records are sourced from AIP Japan (`narita/data/navdata/RJAA.dat`); see
[narita/README.md](narita/README.md).

## Architecture & repository layout

All six guides share a single core under `src/shared/` (bundled by Vite into one shared chunk across
all guide pages), so each airport folder only defines its own data, procedures, strings and configuration:

```
index.html                   chooser page (bilingual, light/dark, live SVG diagrams)
src/
  chooser.ts                 chooser logic: language switch, links, inline diagrams
  chooser.css                chooser layout & card styling
  style.css                  shared design system used by the chooser and all guides
  previews.ts                generated airport diagrams (scripts/make-previews.mjs)
  shared/
    airport.ts               graph model, runway projection, exit & entry detection
    router.ts                template-constrained edge Dijkstra, loop/hairpin removal, step grouping
    plan.ts                  shared option builders, stand filtering, pruning & planStandard()
    map.ts                   full-screen SVG map, 500 m chart grid, GSI tiles, pan/zoom, pins
    guide.ts                 shared UI controller (controls, stand search, steps, LVP support)
    i18n.ts                  common EN/JA UI dictionary & createI18n() factory
    test-helpers.ts          shared reversal, winding, revisit & self-crossing test checks
haneda/                      Haneda (RJTT): index.html, src/{airport,procedures,plan,i18n,main}.ts, data/, scripts/
narita/                      Narita (RJAA): same layout + docs/ screenshots & LVP/gateway routing
rjoo/                        Osaka Itami (RJOO): same layout
rjbb/                        Kansai (RJBB): same layout
roah/                        Naha (ROAH): same layout
rjcc/                        New Chitose (RJCC): same layout
scripts/
  shared.ts                  shared CIFP navdata extractor & multi-mirror Overpass fetcher
  make-previews.mjs          renders the chooser diagrams from each airport's src/data/*.json
  publish-pages.mjs          publishes dist/ to the gh-pages branch
```

The seven static pages (chooser + six guides) are built together by Vite (`vite.config.ts`, MPA input)
and type-checked together by `tsc --noEmit` (`tsconfig.json`). `base` is `./`, so the same `dist/` works
at a custom domain root and under a `github.io/<repo>/` subpath.

## Deployment

GitHub Pages is served from the `gh-pages` branch:

```bash
pnpm build
pnpm publish:pages   # force-pushes dist/ (plus .nojekyll) to gh-pages
```

Set it up once under **Settings → Pages → Source: Deploy from a branch → Branch: `gh-pages` /
`(root)`**. Run the two commands again after each change.

The custom domain is `public/CNAME` (`jpntaxi.xn--3ckue.jp`, i.e. `jpntaxi.ソラ.jp`); Vite copies it
into `dist/CNAME`. DNS points the apex domain at the Pages site through Cloudflare, which terminates
TLS for visitors.

## Data and credits

| Source | Used for | Licence |
| --- | --- | --- |
| OpenStreetMap via Overpass (`data/osm-*.json`) | Taxiways, stands, aprons, terminals, runway ends | © OpenStreetMap contributors, ODbL |
| X-Plane 12 Custom Data / AIP Japan (`data/navdata/*.dat`) | Runway thresholds and displaced thresholds | Navigraph / Jeppesen terms; JCAB AIP terms |
| [GSI Tiles](https://maps.gsi.go.jp/development/ichiran.html) (`pale`, `seamlessphoto`) | Background map, loaded at runtime | Geospatial Information Authority of Japan |

Taxi logic for Haneda follows Kono_Hana, “Tokyo International (Haneda) departure & arrival taxi
overview”; Narita follows AIP Japan RJAA AD 2.22 (V) and AD 2.20 taxiing charts; Osaka Itami follows
the Squawk.ID RJOO landing and departure guides; Kansai, Naha and New Chitose follow AIP Japan
aerodrome charts and standard parallel-runway ground operations. See each guide's README for details.

## Licence

GNU General Public License v2.0 — see [LICENSE](LICENSE). The initial three guides were merged from
[Haneda_taxi_route_manual](https://github.com/xiaotian7196/Haneda_taxi_route_manual),
[Narita_Taxi_Guide](https://github.com/xiaotian7196/Narita_Taxi_Guide) and
[Osaka_Itami_taxi_route_manual](https://github.com/xiaotian7196/Osaka_Itami_taxi_route_manual).
