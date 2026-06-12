import {
  AlertTriangle,
  Construction,
  TrendingUp,
  OctagonAlert,
  Cloud,
  AlertCircle,
} from "lucide-react";

// Icons by incident kind
export const KIND_ICON = {
  accidente: AlertTriangle,
  obras: Construction,
  congestion: TrendingUp,
  peligro: OctagonAlert,
  meteo: Cloud,
  incidencia: AlertCircle,
};

// Display labels
export const KIND_LABEL = {
  accidente: "Accident",
  obras: "Works",
  congestion: "Congestion",
  peligro: "Hazard",
  meteo: "Weather",
  incidencia: "Other",
};

// Color by severity
export const SEV_COLOR = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

// Utility: format time
export const fmtTime = (d) => {
  if (!d) return "--:--";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

// Utility: pad number
export const pad = (n, len = 2) => String(n).padStart(len, "0");

// Subroutines list (for display)
export const SUBROUTINES = [
  ["SYS/FLOW", "Traffic Flow Analysis", "ACTIVE"],
  ["SYS/INCIDENT", "Incident Detection", "ACTIVE"],
  ["SYS/WEATHER", "Weather Integration", "STANDBY"],
  ["SYS/ROUTING", "Route Optimization", "ACTIVE"],
  ["SYS/MOBILITY", "Mobility Hub", "ACTIVE"],
];