/**
 * Shared constants for event kinds, labels, icons, severity colors and HUD subroutines.
 * Extracted from CommandCenter.jsx to reduce its size and complexity.
 */
import {
  Radio, AlertTriangle, Construction, OctagonAlert, TrendingUp, CloudRain,
} from "lucide-react";

export const KIND_ICON = {
  obras: Construction,
  accidente: AlertTriangle,
  congestion: TrendingUp,
  peligro: OctagonAlert,
  meteo: CloudRain,
  incidencia: Radio,
};

export const KIND_GLYPH = {
  obras: "!",
  accidente: "X",
  congestion: "≋",
  peligro: "▲",
  meteo: "~",
  incidencia: "i",
};

export const KIND_LABEL = {
  obras: "OBRAS",
  accidente: "ACCIDENTE",
  congestion: "CONGESTIÓN",
  peligro: "PELIGRO",
  meteo: "METEO",
  incidencia: "INCIDENCIA",
};

export const SEV_COLOR = {
  critical: "var(--accidente)",
  warning: "var(--obras)",
  info: "var(--cyan)",
};

export const SUBROUTINES = [
  ["GTF-001", "DATEX2 STREAM",        "ACTIVE"],
  ["GTF-002", "SCT FEED",             "ACTIVE"],
  ["GTF-003", "MADRID KML",           "ACTIVE"],
  ["GTF-004", "OSM OVERPASS",         "STANDBY"],
  ["GTF-005", "NOMINATIM GEOCODE",    "STANDBY"],
  ["GTF-006", "MAPTILE RASTER",       "ACTIVE"],
  ["GTF-007", "TERRAIN RGB",          "STANDBY"],
  ["GTF-008", "EVENT CLASSIFIER",     "ACTIVE"],
  ["GTF-009", "SEVERITY MATRIX",      "ACTIVE"],
  ["GTF-010", "GEOSPATIAL FILTER",    "ACTIVE"],
  ["GTF-011", "PARKING AGGREGATOR",   "STANDBY"],
  ["GTF-012", "ROUTE OPTIMIZER",      "ACTIVE"],
  ["GTF-013", "DENSITY HEATMAP",      "STANDBY"],
  ["GTF-014", "EXPORT ENGINE",        "ACTIVE"],
];

export const fmtTime = (d) => {
  if (!d) return "--:--:--";
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

export const pad = (n, w = 4) => String(n).padStart(w, "0");
