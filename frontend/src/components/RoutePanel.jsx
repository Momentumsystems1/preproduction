/**
 * Route Optimizer floating panel — OSRM integration UI.
 * Self-contained: receives route state + handlers from parent.
 */
import React from "react";
import { X, Loader2, Navigation2 } from "lucide-react";

export default function RoutePanel({
  routeFrom, setRouteFrom,
  routeTo, setRouteTo,
  routeMode, setRouteMode,
  routeResult,
  routeLoading,
  onRun, onClear, onClose,
}) {
  return (
    <div
      className="absolute top-[150px] left-1/2 -translate-x-1/2 z-[55] w-[460px] panel-solid brackets anim-fade-up"
      data-testid="route-panel"
    >
      <div className="section-head">
        <span>ROUTE OPTIMIZER · OSRM</span>
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
      </div>
    </div>
  );
}
