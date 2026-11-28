# JPN Airport Taxi Guides

An Apple-style, full-screen taxi route guide for five Japanese airports — **Haneda (RJTT)**,
**Narita (RJAA)**, **Osaka Itami (RJOO)**, **Kansai (RJBB)** and **Naha (ROAH)** — built for flight simulation. The site
opens on an airport chooser; each guide keeps its own map, runway configurations, stands and published taxi logic.

**Live:** <https://jpntaxi.ソラ.jp/> (punycode `jpntaxi.xn--3ckue.jp`)

Pick a runway configuration, a runway, a stand and (optionally) a runway exit or entry point, and the
guide draws the standard taxi route on a gridded airport map with turn-by-turn steps. The UI is
available in **English** and **Japanese**; the chooser passes the selected language on to the guide.

![Airport chooser](docs/chooser.png)

On a phone the airport cards stack into one column:

<img src="docs/chooser-mobile.png" alt="Airport chooser on a phone" width="320" />

> For flight simulation only. Not for real-world navigation. ATC instructions always take precedence.

## The five guides

| | Haneda | Narita | Osaka Itami | Kansai | Naha |
| --- | --- | --- | --- | --- | --- |
| Code | RJTT · Tokyo International | RJAA · Narita International | RJOO · Osaka International | RJBB · Kansai International | ROAH · Naha Airport |
| Runways | 16R/34L, 16L/34R, 04/22, 05/23 | 16R/34L, 16L/34R | 14L/32R, 14R/32L | 06R/24L, 06L/24R | 18L/36R, 18R/36L |
| Flows | North, South · Bay, South · City | South, North | North, South | North (06), South (24) | North (36), South (18) |
| Extras | three terminals, published exits for every runway | AIP departure routes, apron gateways, CAT II/III LVP | standard runway crossings, published arrival/departure routes | two islands linked by J3/J4 bridges, T1/T2 & cargo aprons | offshore Runway 2, J1/J2 bridges, standard runway crossings |
| Details | [haneda/README.md](haneda/README.md) | [narita/README.md](narita/README.md) | [rjoo/README.md](rjoo/README.md) | [rjbb/README.md](rjbb/README.md) | [roah/README.md](roah/README.md) |

All five guides share the same map, grid, router technique and UI, but keep the data and taxi logic
of their own airport.

## Getting started

Requirements: Node.js 22.6+ (the data and test scripts run TypeScript directly) and pnpm.

```bash
pnpm install
pnpm dev      # chooser at /, guides at /haneda/, /narita/, /rjoo/, /rjbb/ and /roah/
pnpm build    # static site in dist/
pnpm preview  # serve the production build
pnpm test     # route smoke tests for all five airports
```

`pnpm test:extras` also sweeps every stand on every runway and lists winding routes. The RJOO, RJBB
and ROAH smoke tests cover every stand (56, 113 and 33 stands respectively) in both arrival and
departure mode. All data the apps need is already in the repository, so no X-Plane install is required.

### Refreshing the airport data

Each guide keeps its own data pipeline under `haneda/scripts/`, `narita/scripts/`, `rjoo/scripts/`, `rjbb/scripts/` and `roah/scripts/`.
From the repository root:

```bash
pnpm extract:navdata:haneda -- "<path to X-Plane 12/Custom Data>"  # new AIRAC cycle
pnpm fetch:osm:haneda                                              # newer OSM geometry
pnpm data:haneda                                                   # regenerate src/data/rjtt.json

pnpm fetch:osm:narita
pnpm data:narita

pnpm extract:navdata:rjoo -- "<path to X-Plane 12/Custom Data>"
pnpm fetch:osm:rjoo
pnpm data:rjoo

pnpm extract:navdata:rjbb -- "<path to X-Plane 12/Custom Data>"
pnpm fetch:osm:rjbb
pnpm data:rjbb

pnpm extract:navdata:roah -- "<path to X-Plane 12/Custom Data>"
pnpm fetch:osm:roah
pnpm data:roah
```

The chooser diagrams are rendered from the same `src/data/*.json` files; regenerate them after a data
refresh and commit the result:

```bash
pnpm previews   # rewrites src/previews.ts
```

For Narita, runway records come from AIP Japan (`data/navdata/RJAA.dat`); see
[narita/README.md](narita/README.md) for the source conventions. RJOO uses X-Plane CIFP runway
records and the Squawk.ID landing/departure guides; see [rjoo/README.md](rjoo/README.md).

## Repository layout

```
index.html               chooser (bilingual, light/dark, live airport diagrams)
src/chooser.ts           chooser logic: language, links, diagrams
src/chooser.css          chooser styling
src/style.css            shared design system used by the chooser and all guides
src/previews.ts          generated airport diagrams (scripts/make-previews.mjs)
haneda/                  Haneda guide: index.html, src/, data/, scripts/
narita/                  Narita guide: index.html, src/, data/, scripts/, docs/
rjoo/                    Osaka Itami guide: index.html, src/, data/, scripts/
rjbb/                    Kansai guide: index.html, src/, data/, scripts/
roah/                    Naha guide: index.html, src/, data/, scripts/
scripts/make-previews.mjs  renders the chooser diagrams from the guides' data
scripts/publish-pages.mjs  publishes dist/ to the gh-pages branch
```

The six pages are built together by Vite (`vite.config.ts`, multi-page input). `base` is `./`, so
the same `dist/` works on a custom domain and under a `github.io/<repo>/` subpath.

## Deployment

The site is a static build in `dist/` with relative asset paths, so it works at a custom domain root
and under `https://<user>.github.io/JPN_airport_taxi_guide/`.

GitHub Pages is served from the `gh-pages` branch:

```bash
pnpm build
pnpm publish:pages   # force-pushes dist/ (plus .nojekyll) to gh-pages
```

Set it up once under **Settings → Pages → Source: Deploy from a branch → Branch: `gh-pages` /
`(root)`**. Run the two commands again after each change.

The custom domain is `public/CNAME` (`jpntaxi.xn--3ckue.jp`, i.e. `jpntaxi.ソラ.jp`); Vite copies it
into `dist/CNAME`. DNS points the apex domain at the Pages site through Cloudflare, which terminates
TLS for visitors. For a different domain, edit that file (punycode for internationalised names) and
update the DNS records.

If you prefer GitHub Actions instead, add a workflow that runs `pnpm install --frozen-lockfile`,
`pnpm test` and `pnpm build`, uploads `dist/` and deploys it with `actions/deploy-pages`, then set
**Settings → Pages → Source: GitHub Actions**.

## Data and credits

| Source | Used for | Licence |
| --- | --- | --- |
| OpenStreetMap via Overpass (`data/osm-*.json`) | Taxiways, stands, aprons, terminals, runway ends | © OpenStreetMap contributors, ODbL |
| X-Plane 12 Custom Data / AIP Japan (`data/navdata/*.dat`) | Runway thresholds and displaced thresholds | Navigraph / Jeppesen terms; JCAB AIP terms |
| [GSI Tiles](https://maps.gsi.go.jp/development/ichiran.html) (`pale`, `seamlessphoto`) | Background map, loaded at runtime | Geospatial Information Authority of Japan |

Taxi logic for Haneda follows Kono_Hana, “Tokyo International (Haneda) departure & arrival taxi
overview”; the Narita departure routes follow AIP Japan RJAA AD 2.22 (V) and the AD 2.20 taxiing
charts. Osaka Itami follows the Squawk.ID RJOO landing and departure guides. See each guide's README
for details.

## Licence

GNU General Public License v2.0 — see [LICENSE](LICENSE). The three guides were merged from
[Haneda_taxi_route_manual](https://github.com/xiaotian7196/Haneda_taxi_route_manual),
[Narita_Taxi_Guide](https://github.com/xiaotian7196/Narita_Taxi_Guide) and
[Osaka_Itami_taxi_route_manual](https://github.com/xiaotian7196/Osaka_Itami_taxi_route_manual).
