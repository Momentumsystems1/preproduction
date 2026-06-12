/**
 * Small reusable HUD UI primitives extracted from CommandCenter.jsx.
 * Pure presentational components — no business logic.
 */
import React from "react";
import { Radio } from "lucide-react";
import { KIND_ICON, KIND_LABEL, SEV_COLOR, pad } from "@/lib/hudConstants";
import { statusBg } from "@/lib/styleHelpers";

export function KPI({ label, value, accent = "text-cyan-100", small = false, last = false }) {
  return (
    <div className={`px-3 py-2 border-b border-cyan-500/15 ${!last ? "border-r" : ""}`}>
      <div className="font-mono text-[8px] tracking-[0.25em] text-cyan-500/80 mb-0.5">{label}</div>
      <div className={`font-mono ${small ? "text-sm" : "text-xl"} font-semibold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

export function EventRow({ f, idx, active, onClick }) {
  const Icon = KIND_ICON[f.kind] || Radio;
  const color = SEV_COLOR[f.severity] || "var(--cyan)";
  return (
    <button
      data-testid={`event-row-${f.id}`}
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 border-b border-cyan-500/8 atlantis-row ${active ? "bg-cyan-500/15" : ""}`}
      style={{ borderLeft: `2px solid ${color}` }}
    >
      <span className="font-mono text-[10px] text-cyan-700 tabular-nums w-7 text-right">{pad(idx + 1, 3)}</span>
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-cyan-100">{KIND_LABEL[f.kind] || "INCIDENCIA"}</span>
          <span className="font-mono text-[9px] text-cyan-600">{(f.source || "").split(" ")[0]}</span>
        </div>
        <div className="font-mono text-[10px] text-cyan-300/80 truncate">{f.road || f.id}</div>
      </div>
    </button>
  );
}

export function EventDetail({ f, onClose }) {
  const Icon = KIND_ICON[f.kind] || Radio;
  const color = SEV_COLOR[f.severity] || "var(--cyan)";
  return (
    <div className="anim-fade-up" data-testid="event-detail">
      <div className="px-3 py-3 border-b border-cyan-500/15">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 flex items-center justify-center border" style={{ borderColor: color, background: `${color}1A` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div className="flex-1">
            <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80">REC · {f.id}</div>
            <div className="font-display font-semibold text-base text-cyan-100 mt-0.5 tracking-wide">{KIND_LABEL[f.kind] || f.title}</div>
            <div className="font-mono text-[10px] text-cyan-400 tracking-wider mt-0.5">{f.source}</div>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 space-y-2 border-b border-cyan-500/15">
        {f.road && <Field label="VECTOR / ROAD">{f.road}</Field>}
        <Field label="ANALYSIS">{f.description}</Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="LATITUDE" mono>{f.lat?.toFixed(5)}</Field>
          <Field label="LONGITUDE" mono>{f.lon?.toFixed(5)}</Field>
        </div>
        <Field label="SEVERITY">
          <span className="px-2 py-0.5 text-[10px] font-mono tracking-[0.18em]"
                style={{ background: `${color}1F`, color, border: `1px solid ${color}80` }}>
            {(f.severity || "info").toUpperCase()}
          </span>
        </Field>
      </div>

      <div className="px-3 py-2 grid grid-cols-2 gap-2">
        <a data-testid="event-gmaps" target="_blank" rel="noreferrer"
           href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}`}
           className="text-center px-2 py-1.5 bg-cyan-500/10 border border-cyan-500/40 hover:bg-cyan-500/20 text-[10px] font-mono tracking-wider text-cyan-100">
          ROUTE TO TARGET
        </a>
        <button data-testid="event-close" onClick={onClose}
          className="px-2 py-1.5 bg-transparent border border-cyan-500/40 hover:bg-cyan-500/10 text-[10px] font-mono tracking-wider text-cyan-100">
          DISENGAGE
        </button>
      </div>
    </div>
  );
}

export function Field({ label, children, mono = false }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-0.5">{label}</div>
      <div className={mono ? "font-mono text-[12px] text-cyan-100" : "text-[12px] text-cyan-100/90 leading-snug"}>{children}</div>
    </div>
  );
}

export function Tel({ label, value, accent = false }) {
  return (
    <div className="flex items-center justify-between border-b border-cyan-500/10 pb-1">
      <span className="text-cyan-500/80 tracking-wider">{label}</span>
      <span className={`tabular-nums ${accent ? "text-cyan-300" : "text-cyan-100"}`}>{value || "—"}</span>
    </div>
  );
}

export function StatusPill({ name, status }) {
  const ok = status === "OK";
  const textColor = ok ? "text-emerald-400" : status === "DOWN" ? "text-red-400" : "text-cyan-700";
  return (
    <div className="flex items-center gap-1.5" data-testid={`status-${name.toLowerCase().replace(/\s/g, "-").replace(".", "-")}`}>
      <div className={`w-1.5 h-1.5 ${statusBg(status)}`} />
      <span className="text-cyan-400/80">{name}</span>
      <span className={textColor}>{status || "—"}</span>
    </div>
  );
}

export function SourceBadge({ name, status }) {
  const ok = status === "OK";
  const textColor = ok ? "text-emerald-400" : status === "DOWN" ? "text-red-400" : "text-cyan-700";
  return (
    <div className="flex items-center justify-between py-1 border-b border-cyan-500/10 last:border-0">
      <span className="font-mono text-[10px] tracking-wider text-cyan-200">{name}</span>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 ${statusBg(status)}`} />
        <span className={`font-mono text-[9px] tracking-wider ${textColor}`}>{status || "—"}</span>
      </div>
    </div>
  );
}
