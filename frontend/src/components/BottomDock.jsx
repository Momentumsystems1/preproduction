/**
 * BottomDock — Atlantis-style HUD lower panel.
 * Three columns: live Diagnostic Stream · Tactical Table (events) · Telemetry.
 * Pure presentational — receives all data via props.
 */
import React from "react";
import { Tel } from "@/components/HudPrimitives";
import { KIND_LABEL, fmtTime, pad } from "@/lib/hudConstants";
import { logColor, severityColor } from "@/lib/styleHelpers";

function LogRow({ entry }) {
  return (
    <div className="flex gap-2 anim-fade-up" style={{ animationDuration: "180ms" }}>
      <span className="text-cyan-700 tabular-nums shrink-0">{fmtTime(entry.t)}</span>
      <span className={logColor(entry.kind)}>{entry.msg}</span>
    </div>
  );
}

function TacticalRow({ feature, idx, onClick }) {
  return (
    <div
      onClick={onClick}
      data-testid={`tactical-row-${feature.id}`}
      className="grid grid-cols-12 gap-px text-[10px] font-mono px-2 py-0.5 cursor-pointer atlantis-row tracking-wide"
    >
      <div className="col-span-1 text-cyan-700 tabular-nums">{pad(idx + 1, 3)}</div>
      <div className="col-span-2 text-cyan-200 truncate">{feature.id}</div>
      <div className="col-span-2 uppercase" style={{ color: `var(--${feature.kind}, #67e8f9)` }}>
        {KIND_LABEL[feature.kind] || feature.kind}
      </div>
      <div className="col-span-2" style={{ color: severityColor(feature.severity) }}>
        {(feature.severity || "info").toUpperCase()}
      </div>
      <div className="col-span-2 text-cyan-300/80">{(feature.source || "").split(" ")[0]}</div>
      <div className="col-span-3 text-right text-cyan-100 tabular-nums">
        {feature.lat?.toFixed(3)},{feature.lon?.toFixed(3)}
      </div>
    </div>
  );
}

export default function BottomDock({
  logs,
  features,
  onPickFeature,
  mapCenter, zoom, pitch, bearing, mapStyle, lastUpdate,
}) {
  return (
    <section
      className="absolute bottom-[30px] left-3 right-3 h-[160px] z-40 panel-solid brackets flex anim-fade-up"
      data-testid="diagnostic-panel"
    >
      {/* Diagnostic Stream */}
      <div className="w-[35%] border-r border-cyan-500/20 flex flex-col">
        <div className="section-head">
          <span>DIAGNOSTIC STREAM</span>
          <div className="flex items-center gap-1.5"><div className="live-dot" /><span className="text-cyan-300/60">RT</span></div>
        </div>
        <div className="flex-1 overflow-hidden relative bg-grid">
          <div className="absolute inset-0 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-relaxed">
            {logs.length === 0 && <div className="text-cyan-700">{"// awaiting telemetry..."}</div>}
            {logs.map((l) => <LogRow key={l.id} entry={l} />)}
          </div>
        </div>
      </div>

      {/* Tactical Table */}
      <div className="flex-1 border-r border-cyan-500/20 flex flex-col">
        <div className="section-head">
          <span>EVENT SUBSET · TACTICAL TABLE</span>
          <span className="text-cyan-300/60">FREQ 1.000Hz</span>
        </div>
        <div className="flex-1 overflow-hidden bg-stripes">
          <div className="grid grid-cols-12 gap-px text-[10px] font-mono px-2 py-1.5 text-cyan-500/70 tracking-wider border-b border-cyan-500/10">
            <div className="col-span-1">IDX</div>
            <div className="col-span-2">REC</div>
            <div className="col-span-2">KIND</div>
            <div className="col-span-2">SEV</div>
            <div className="col-span-2">SRC</div>
            <div className="col-span-3 text-right">COORDS</div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "104px" }}>
            {features.slice(0, 50).map((f, i) => (
              <TacticalRow key={f.id} feature={f} idx={i} onClick={() => onPickFeature(f)} />
            ))}
          </div>
        </div>
      </div>

      {/* Telemetry */}
      <div className="w-[22%] flex flex-col">
        <div className="section-head">
          <span>TELEMETRY</span>
          <span className="text-cyan-300/60">v2.0</span>
        </div>
        <div className="flex-1 px-3 py-2 font-mono text-[10px] space-y-1.5">
          <Tel label="LAT" value={mapCenter.lat.toFixed(5)} />
          <Tel label="LON" value={mapCenter.lng.toFixed(5)} />
          <Tel label="ZOOM" value={zoom} />
          <Tel label="PITCH" value={`${pitch}°`} />
          <Tel label="BEARING" value={`${bearing}°`} />
          <Tel label="MODE" value={mapStyle.toUpperCase()} />
          <Tel label="LAST SYNC" value={fmtTime(lastUpdate)} accent />
        </div>
      </div>
    </section>
  );
}
