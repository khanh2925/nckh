import terminals from "../data/terminals";
import { createProjection } from "./projection";

// The terminal that has a floor plan, and its pixel <-> lat/lng converter.
// Shared by MapView (drawing) and routing.js (measuring distances in meters).
export const mainTerminal = terminals.find(terminal => terminal.id === "T1");
export const projection = createProjection(mainTerminal.plan);
