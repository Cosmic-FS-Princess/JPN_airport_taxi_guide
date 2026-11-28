// Copies only the nav data this project needs out of X-Plane 12 "Custom Data"
// into data/navdata/, so the rest of the pipeline never touches the sim install.
// Usage: pnpm extract:navdata:rjbb [path-to-Custom-Data]
import { extractNavdata } from "../../scripts/shared.ts";

extractNavdata("RJBB", new URL("../data/navdata/", import.meta.url));
