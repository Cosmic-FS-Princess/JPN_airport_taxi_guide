// Copies only the nav data this project needs out of X-Plane 12 "Custom Data"
// into data/navdata/, so the rest of the pipeline never touches the sim install.
// Usage: pnpm extract:navdata:rjcc [path-to-Custom-Data]
import { extractNavdata } from "../../scripts/shared.ts";

extractNavdata("RJCC", new URL("../data/navdata/", import.meta.url));
