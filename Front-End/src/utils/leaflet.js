import * as Leaflet from "leaflet";

// "leaflet-rotate" is an old-style plugin: it reads and patches a GLOBAL variable named "L".
// ES modules don't create globals, so we create it here. Import this file BEFORE "leaflet-rotate".
const L = { ...Leaflet };
window.L = L;

export default L;
