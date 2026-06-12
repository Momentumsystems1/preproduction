/**
 * Small helpers to make conditional className composition readable
 * (kills nested ternaries which the linter and humans both hate).
 */

/**
 * Map a value to a className using a lookup table with optional fallback.
 *   cls(severity, { critical: "text-red-400", warning: "text-amber-400" }, "text-emerald-400")
 */
export function cls(value, map, fallback = "") {
  return map[value] || fallback;
}

/**
 * Risk → tailwind text color (used in KPIs and HUD).
 */
export function riskColor(risk) {
  return cls(risk, {
    ALTO: "text-red-400",
    MEDIO: "text-amber-400",
    BAJO: "text-emerald-400",
  }, "text-zinc-300");
}

/**
 * Severity → CSS color variable.
 */
export function severityColor(severity) {
  return cls(severity, {
    critical: "var(--accidente)",
    warning: "var(--obras)",
    info: "var(--cyan)",
  }, "var(--cyan)");
}

/**
 * Health status → tailwind background color for a status dot.
 */
export function statusBg(status) {
  return cls(status, {
    OK: "bg-emerald-400",
    DOWN: "bg-red-500",
  }, "bg-cyan-700");
}

/**
 * Log level → text color for the diagnostic stream.
 */
export function logColor(kind) {
  return cls(kind, {
    err: "text-red-400",
    ok: "text-emerald-400",
  }, "text-cyan-300");
}
