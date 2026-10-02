// Runs automatically before "npm run build" (see "prebuild" in package.json).
// The backend's JSON file stays the ONLY source of truth: we copy it, never edit the copy by hand.
import { copyFileSync, mkdirSync } from "node:fs";

const source = "../Back-End/data/airport-locations.json";
const target = "public/data/locations.json";

mkdirSync("public/data", { recursive: true });
copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
