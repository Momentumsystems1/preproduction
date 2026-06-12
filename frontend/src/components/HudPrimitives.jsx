import React from "react";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { KIND_ICON, KIND_LABEL, SEV_COLOR } from "@/lib/hudConstants";

// KPI Card
export const KPI = ({ label, value, accent = "text-cyan-100", small = false, last = false }) => (
  <div
    className={`px-3 py-2 border-r border-b border-cyan-500/15 ${last ? "border-b-0" : ""}`}
  >
    <div className={`font-mono ${small ? "text-[8px]" : "text-[9px]"} tracking-[0.22em] text-cyan-500/80 mb-1`}>
      {label}
    </div>
    <div className={`font-mono ${small ? "text-lg" : "text-2xl"} ${accent} tabular-nums`}>
      {value}
    </div>
  </div>
);

// Event Row in queue
export const EventRow = ({ f, idx, active, onClick }) => {
  const Icon = KIND_ICON[f.kind] || AlertCircle;
  const severityColor = SEV_COLOR[f.severity] || "#67e8f9";

  return (
    <div
      onClick={onClick}
      className={`px-3 py-2 border-l-2 cursor-pointer transition-colors ${
        active ? "bg-cyan-500/15" : "hover:bg-cyan-500/8"
      }`}
      style={{ borderLeftColor: severityColor }}
      data-testid={`event-row-${f.id}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: severityColor }} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] font-bold text-cyan-100 truncate">{f.kind.toUpperCase()}</div>
          <div className="font-mono text-[9px] text-cyan-400/70 truncate">{f.title || f.road}</div>
          <div className="font-mono text-[8px] text-cyan-600/60 truncate">{f.lat.toFixed(4)}, {f.lon.toFixed(4)}</div>
        </div>
      </div>
    </div>
  );
};

// Event Detail panel
export const EventDetail = ({ f, onClose }) => {
  const Icon = KIND_ICON[f.kind] || AlertCircle;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <div className="font-mono text-[11px] font-bold text-cyan-100">{f.kind.toUpperCase()}</div>
        </div>
        <button onClick={onClose} className="text-cyan-400 hover:text-cyan-100 text-xs">✕</button>
      </div>
      <div className="border-t border-cyan-500/15 pt-3">
        <div className="font-mono text-[9px] text-cyan-500/70 mb-1">TITLE</div>
        <div className="font-mono text-[10px] text-cyan-100">{f.title}</div>
      </div>
      <div>
        <div className="font-mono text-[9px] text-cyan-500/70 mb-1">DESCRIPTION</div>
        <div className="font-mono text-[9px] text-cyan-400/80 line-clamp-3">{f.description}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="font-mono text-[8px] text-cyan-500/70">SEVERITY</div>
          <div className="font-mono text-[10px] font-bold" style={{ color: SEV_COLOR[f.severity] || "#67e8f9" }}>
            {f.severity?.toUpperCase() || "INFO"}
          </div>
        </div>
        <div>
          <div className="font-mono text-[8px] text-cyan-500/70">SOURCE</div>
          <div className="font-mono text-[9px] text-cyan-200">{f.source || "OSM"}</div>
        </div>
      </div>
    </div>
  );
};

// Status Pill
export const StatusPill = ({ name, status }) => {
  let icon = CheckCircle;
  let color = "text-emerald-400";

  if (status === "ERROR" || status === "OFFLINE") {
    icon = AlertTriangle;
    color = "text-red-400";
  } else if (status === "DEGRADED") {
    icon = AlertTriangle;
    color = "text-amber-400";
  }

  const Icon = icon;
  return (
    <div className="flex items-center gap-1">
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="font-mono text-[9px] text-cyan-300">{name}</span>
    </div>
  );
};

// Source Badge
export const SourceBadge = ({ name, status }) => {
  const isOK = status === "OK" || status === "ACTIVE";
  return (
    <div className={`px-2 py-1.5 mb-1.5 border rounded text-[9px] font-mono ${
      isOK ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300" : "border-amber-500/40 bg-amber-500/5 text-amber-300"
    }`}>
      <span className={isOK ? "text-emerald-400" : "text-amber-400"}>●</span> {name}: {status || "UNKNOWN"}
    </div>
  );
};