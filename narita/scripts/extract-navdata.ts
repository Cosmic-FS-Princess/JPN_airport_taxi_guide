// Copies only the nav data this project needs out of X-Plane 12 "Custom Data"
// into data/navdata/, so the rest of the pipeline never touches the sim install.
// Usage: pnpm extract:navdata:narita [path-to-Custom-Data]
// Narita's checked-in RJAA.dat was taken from AIP Japan AD 2.12; this script
// refreshes it from an AIRAC cycle when needed.
import { extractNavdata } from "../../scripts/shared.ts";

extractNavdata("RJAA", new URL("../data/navdata/", import.meta.url));
