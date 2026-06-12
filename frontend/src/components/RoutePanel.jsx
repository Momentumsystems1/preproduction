/**
 * Route Optimizer floating panel — OSRM + Azure multimodal integration.
 * Self-contained: receives route state + handlers from parent.
 */
import React from "react";
import { X, Loader2, Navigation2, Layers, ExternalLink, Car, Footprints, Bus } from "lucide-react";

const MODE_ICON = {
  car: Car,
  foot: Footprints,
  transit: Bus,
};

function SegmentRow({ seg }) {
  const Icon = MODE_ICON[seg.mode] || Layers;
  return (
    <div className="flex items-start gap-2 text-[10px] font-mono text-cyan-100/90 py-0.5">
      <Icon className="w-3 h-3 mt-0.5 text-cyan-300 flex-shrink-0" />
      <div className="flex-1 leading-tight">
        <span className="text-cyan-200">{seg.label}</span>
        <span className="text-cyan-500/70 ml-1">
          · {seg.duration_min}min{seg.distance_m ? ` · ${(seg.distance_m / 1000).toFixed(2)}km` : ""}
        </span>
      </div>
      {seg.deeplink && (
        <a
          href={seg.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-200 flex-shrink-0"
          title="Abrir en Google Maps Transit"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function getDeltaText(deltaMin) {
  if (deltaMin == null) return null;
  if (deltaMin > 0) return `−${deltaMin}min vs coche`;
  if (deltaMin < 0) return `+${Math.abs(deltaMin)}min vs coche`;
  return "igual vs coche";
}

function MultimodalCard({ opt, idx, onPick }) {
  const isBest = opt.best;
  const deltaTxt = getDeltaText(opt.delta_vs_car_min);

  return (
    <button
      type="button"
      data-testid={`multimodal-opt-${idx}`}
      onClick={() => onPick && onPick(opt)}
      className={`w-full text-left border transition-colors p-2.5 ${
        isBest
          ? "border-emerald-400/60 bg-emerald-500/8 hover:bg-emerald-500/15"
          : "border-cyan-500/25 bg-cyan-500/3 hover:bg-cyan-500/10"
      }`}
      style={{ borderLeftColor: opt.color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="font-mono text-[10px] tracking-[0.18em] text-cyan-100 font-bold">
          {isBest && <span className="text-emerald-300">★ </span>}
          {opt.label}
        </div>
        <div className="font-mono text-[11px] text-amber-300 tabular-nums">
          {opt.total_duration_min}<span className="text-[9px] text-cyan-500/70"> min</span>
        </div>
      </div>
      <div className="font-mono text-[9px] text-cyan-400/70 tracking-wide mb-1.5 flex items-center justify-between">
        <span>
          {opt.total_distance_km} km
          {deltaTxt && <span className="ml-2 text-cyan-300/80">· {deltaTxt}</span>}
        </span>
      </div>
      <div className="font-mono text-[10px] text-cyan-200/80 italic mb-1.5 leading-snug">
        {opt.description}
      </div>
      <div className="border-t border-cyan-500/15 pt-1.5 space-y-0.5">
        {opt.segments.map((s, i) => <SegmentRow key={`${s.mode}-${s.label}-${i}`} seg={s} />)}
      </div>
    </button>
  );
}

export default function RoutePanel({
  routeFrom, setRouteFrom,
  routeTo, setRouteTo,
  routeMode, setRouteMode,
  routeResult,
  routeLoading,
  multimodalData,
  multimodalLoading,
  onRun, onClear, onClose, onPickMultimodal,
}) {
  return (
    <div
      className="absolute top-[150px] left-1/2 -translate-x-1/2 z-[55] w-[480px] max-h-[78vh] panel-solid brackets anim-fade-up overflow-y-auto"
      data-testid="route-panel"
    >
      <div className="section-head sticky top-0 bg-[#020a14] z-10">
        <span>ROUTE OPTIMIZER · OSRM + MULTIMODAL</span>
        <button onClick={onClose} className="text-cyan-300/60 hover:text-cyan-100" data-testid="route-close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-3 space-y-2">
        <div>
          <label className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 block mb-1">ORIGIN</label>
          <input
            data-testid="route-from"
            value={routeFrom}
            onChange={(e) => setRouteFrom(e.target.value)}
            placeholder="dirección, ciudad o 'lat,lon'"
            className="w-full bg-cyan-500/5 border border-cyan-500/25 px-2 py-1.5 text-xs font-mono outline-none text-cyan-100 placeholder:text-cyan-700/70"
          />
        </div>
        <div>
          <label className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 block mb-1">DESTINATION</label>
          <input
            data-testid="route-to"
            value={routeTo}
            onChange={(e) => setRouteTo(e.target.value)}
            placeholder="dirección, ciudad o 'lat,lon'"
            className="w-full bg-cyan-500/5 border border-cyan-500/25 px-2 py-1.5 text-xs font-mono outline-none text-cyan-100 placeholder:text-cyan-700/70"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 block mb-1">VEHICLE PROFILE</label>
            <select
              data-testid="route-mode"
              value={routeMode}
              onChange={(e) => setRouteMode(e.target.value)}
              className="w-full bg-cyan-500/5 border border-cyan-500/25 px-2 py-1.5 text-xs font-mono outline-none text-cyan-100 cursor-pointer"
            >
              <option value="car" className="bg-[#020a14]">CAR · 120 g CO₂/km</option>
              <option value="truck" className="bg-[#020a14]">TRUCK · 280 g CO₂/km</option>
              <option value="bike" className="bg-[#020a14]">BIKE · 0 g CO₂/km</option>
              <option value="foot" className="bg-[#020a14]">FOOT · 0 g CO₂/km</option>
            </select>
          </div>
          <button
            data-testid="route-run"
            onClick={onRun}
            disabled={routeLoading}
            className="self-end flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400 text-[#020a14] hover:bg-cyan-300 disabled:opacity-50 text-[11px] font-mono tracking-wider font-bold"
          >
            {routeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation2 className="w-3 h-3" />}
            {routeLoading ? "RUN..." : "OPTIMIZE"}
          </button>
          <button
            data-testid="route-clear"
            onClick={onClear}
            className="self-end px-2 py-1.5 bg-transparent border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-[10px] font-mono tracking-wider"
          >
            CLR
          </button>
        </div>

        {routeResult && !routeResult.error && (
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-cyan-500/15 pt-3">
            <div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80">DISTANCE</div>
              <div className="font-mono text-lg text-cyan-100 tabular-nums">
                {routeResult.distance_km}<span className="text-[10px] text-cyan-500"> km</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80">ETA</div>
              <div className="font-mono text-lg text-amber-300 tabular-nums">
                {routeResult.duration_min}<span className="text-[10px] text-cyan-500"> min</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80">CO₂ EST.</div>
              <div className="font-mono text-lg text-emerald-300 tabular-nums">
                {routeResult.co2_g}<span className="text-[10px] text-cyan-500"> g</span>
              </div>
            </div>
          </div>
        )}
        {routeResult && routeResult.error && (
          <div className="mt-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 font-mono text-[10px] tracking-wider text-red-300">
            ▸ {routeResult.error}
          </div>
        )}

        {/* ===== MULTIMODAL OPTIONS ===== */}
        {(multimodalLoading || multimodalData) && (
          <div className="mt-3 border-t border-cyan-500/15 pt-3" data-testid="multimodal-section">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80">
                ALTERNATIVAS MULTIMODALES · AZURE
              </div>
              {multimodalLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
              )}
            </div>
            {multimodalLoading && !multimodalData && (
              <div className="font-mono text-[10px] text-cyan-700 italic">
                ▸ Calculando combinaciones (coche · parking · transporte)...
              </div>
            )}
            {multimodalData && multimodalData.options && multimodalData.options.length > 0 && (
              <div className="space-y-1.5" data-testid="multimodal-options">
                {multimodalData.options.map((o, i) => (
                  <MultimodalCard key={o.label || `opt-${i}`} idx={i} opt={o} onPick={onPickMultimodal} />
                ))}
              </div>
            )}
            {multimodalData && (!multimodalData.options || multimodalData.options.length === 0) && (
              <div className="font-mono text-[10px] text-cyan-700 italic">
                ▸ Sin alternativas disponibles para este trayecto.
              </div>
            )}
            {multimodalData?.parkings_considered?.length > 0 && (
              <div className="mt-2 font-mono text-[9px] text-cyan-500/70 tracking-wide">
                ▸ Parkings evaluados cerca del destino:{" "}
                <span className="text-cyan-300/90">
                  {multimodalData.parkings_considered.map((p) => p.name).join(" · ")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
