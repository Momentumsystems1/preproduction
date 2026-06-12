// Risk color mapping
export const riskColor = (risk) => {
  if (!risk) return "text-cyan-200";
  const level = String(risk).toLowerCase();
  if (level.includes("critical") || level.includes("alto")) return "text-red-400";
  if (level.includes("warning") || level.includes("medio")) return "text-amber-400";
  if (level.includes("info") || level.includes("bajo")) return "text-cyan-300";
  return "text-cyan-200";
};

// Severity to color
export const severityColor = (sev) => {
  if (!sev) return "#67e8f9";
  switch (String(sev).toLowerCase()) {
    case "critical":
      return "#ef4444";
    case "warning":
      return "#f59e0b";
    case "info":
      return "#3b82f6";
    default:
      return "#67e8f9";
  }
};