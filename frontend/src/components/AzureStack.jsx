/**
 * Azure Mobility Stack — toolbar + EV stations panel + Weather chip.
 * Talks to backend /api/azure/* (key never leaves the server).
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  Zap, Cloud, Plug, Activity, Loader2, X, Wind, Eye, Sun, Droplets,
  AlertTriangle, Sparkles,
} from "lucide-react";
import {
  azureWeatherCurrent, azureWeatherAlerts, azureSearchEV,
} from "@/lib/api";
import { pad } from "@/lib/hudConstants";

export function AzureToolbar({
  showFlow, onToggleFlow,
  showAzureIncidents, onToggleAzureIncidents,
  showWeatherRadar, onToggleWeatherRadar,
  showSatellite, onToggleSatellite,
  onOpenEV,
}) {
  return (
    <div className="flex items-center gap-2 ml-2 pl-3 border-l border-cyan-500/20" data-testid="azure-toolbar">
      <span className="font-mono text-[9px] tracking-[0.25em] text-cyan-500/80">AZURE</span>
      <ToolBtn active={showFlow} onClick={onToggleFlow} testId="azure-flow-btn" label="FLOW" icon={Activity} />
      <ToolBtn active={showAzureIncidents} onClick={onToggleAzureIncidents} testId="azure-incidents-btn" label="INCIDENTS" icon={AlertTriangle} />
      <ToolBtn active={showWeatherRadar} onClick={onToggleWeatherRadar} testId="azure-weather-btn" label="RADAR" icon={Cloud} />
      <ToolBtn active={showSatellite} onClick={onToggleSatellite} testId="azure-sat-btn" label="MS SAT" icon={Sparkles} />
      <button data-testid="azure-ev-btn" onClick={onOpenEV}
        className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10">
        <Plug className="w-3 h-3" /> EV
      </button>
    </div>
  );
}

function ToolBtn({ active, onClick, label, icon: Icon, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono tracking-wide border transition-colors ${
        active
          ? "bg-cyan-400 text-[#020a14] border-cyan-400"
          : "bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
      }`}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

/* -------- Weather Chip + Severe alerts (in the right panel) -------- */
export function WeatherChip({ lat, lon }) {
  const [w, setW] = useState(null);
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    if (!lat || !lon) return;
    let cancelled = false;
    azureWeatherCurrent(lat, lon).then((d) => !cancelled && setW(d)).catch(() => {});
    azureWeatherAlerts(lat, lon).then((d) => !cancelled && setAlerts(d.alerts || [])).catch(() => {});
    return () => { cancelled = true; };
  }, [lat, lon]);

  if (!w) return null;
  return (
    <div className="px-3 py-3 border-b border-cyan-500/15" data-testid="weather-chip">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80">ATMOSPHERIC · AZURE</div>
        <div className="font-mono text-[9px] text-cyan-300">{w.phrase}</div>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        <Metric label="TEMP" value={`${w.temperature_c?.toFixed(0)}°`} accent="text-amber-300" />
        <Metric label="FEEL" value={`${w.real_feel_c?.toFixed(0)}°`} />
        <Metric label="WIND" value={`${w.wind_kph?.toFixed(0)}`} unit="km/h" />
        <Metric label="UV" value={w.uv_index} accent={w.uv_index >= 8 ? "text-red-400" : w.uv_index >= 6 ? "text-amber-400" : "text-emerald-400"} />
      </div>
      <div className="grid grid-cols-3 gap-1 text-center mt-1">
        <Metric label="HUM" value={`${w.humidity}%`} icon={Droplets} />
        <Metric label="VIS" value={`${w.visibility_km?.toFixed(0)}`} unit="km" icon={Eye} />
        <Metric label="DIR" value={w.wind_dir || "—"} icon={Wind} small />
      </div>
      {alerts.length > 0 && (
        <div className="mt-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="font-mono text-[9px] tracking-[0.2em] text-red-300">SEVERE ALERTS · {alerts.length}</span>
          </div>
          {alerts.slice(0, 3).map((a, i) => (
            <div key={`alert-${i}`} className="mt-1 font-mono text-[10px] text-red-200/90">
              ▸ {a.description?.localized || a.alertId || "Alerta meteorológica"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, unit, accent = "text-cyan-100", icon: Icon = null, small = false }) {
  return (
    <div className="border border-cyan-500/15 px-1 py-1">
      <div className="font-mono text-[8px] tracking-[0.22em] text-cyan-500/80 flex items-center justify-center gap-0.5">
        {Icon && <Icon className="w-2.5 h-2.5" />} {label}
      </div>
      <div className={`font-mono ${small ? "text-[10px]" : "text-sm"} font-semibold tabular-nums ${accent}`}>
        {value}{unit ? <span className="text-[8px] text-cyan-500"> {unit}</span> : null}
      </div>
    </div>
  );
}

/* -------- EV Charging Stations Modal -------- */
export function EVPanel({ lat, lon, onClose, onPick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(5000);
  const [connector, setConnector] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await azureSearchEV(lat, lon, radius, 50, connector || undefined);
      setData(d);
    } catch (e) {
      console.debug("EV fetch failed", e);
    } finally { setLoading(false); }
  }, [lat, lon, radius, connector]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="absolute right-[360px] top-[150px] w-[380px] panel-solid brackets z-[55] anim-fade-up" data-testid="ev-panel">
      <div className="section-head">
        <span>EV CHARGING STATIONS · AZURE</span>
        <button onClick={onClose} className="text-cyan-300/60 hover:text-cyan-100" data-testid="ev-close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-2 space-y-2 border-b border-cyan-500/15">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 block mb-1">RADIUS · m</label>
            <select value={radius} onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              data-testid="ev-radius"
              className="w-full bg-cyan-500/5 border border-cyan-500/25 px-2 py-1 text-xs font-mono outline-none text-cyan-100 cursor-pointer">
              {[1000, 2500, 5000, 10000, 20000, 50000].map((r) => (
                <option key={r} value={r} className="bg-[#020a14]">{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 block mb-1">CONNECTOR</label>
            <select value={connector} onChange={(e) => setConnector(e.target.value)}
              data-testid="ev-connector"
              className="w-full bg-cyan-500/5 border border-cyan-500/25 px-2 py-1 text-xs font-mono outline-none text-cyan-100 cursor-pointer">
              <option value="" className="bg-[#020a14]">ANY</option>
              <option value="IEC62196Type2CCS" className="bg-[#020a14]">CCS Type 2</option>
              <option value="IEC62196Type2Outlet" className="bg-[#020a14]">Type 2</option>
              <option value="Chademo" className="bg-[#020a14]">CHAdeMO</option>
              <option value="Tesla" className="bg-[#020a14]">Tesla</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between font-mono text-[10px] tracking-wider text-cyan-300">
          <span>{loading ? "QUERYING AZURE..." : `${data?.count || 0} STATIONS LOCATED`}</span>
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
        {data?.stations?.map((s) => (
          <button key={s.id}
            onClick={() => onPick && onPick(s)}
            data-testid={`ev-station-${s.id}`}
            className="w-full text-left atlantis-row px-3 py-2 border-b border-cyan-500/10 flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 mt-0.5 text-amber-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-cyan-100 truncate">{s.name}</span>
                <span className="font-mono text-[9px] text-cyan-500">{s.total_connectors > 0 ? `${s.total_connectors}×` : "—"}</span>
              </div>
              {s.address && <div className="font-mono text-[10px] text-cyan-300/80 truncate">{s.address}</div>}
              {s.brand && <div className="font-mono text-[9px] text-cyan-500/80">▸ {s.brand}</div>}
              {s.connectors.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.connectors.slice(0, 3).map((c, i) => (
                    <span key={`${s.id}-conn-${c.type || "x"}-${i}`}
                      className="font-mono text-[8px] tracking-wider px-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-200">
                      {(c.type || "?").replace("IEC62196", "")} {c.kw ? `· ${c.kw}kW` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}
        {!loading && (!data?.stations || data.stations.length === 0) && (
          <div className="px-3 py-6 text-center font-mono text-[10px] text-cyan-700">[ NO STATIONS IN SECTOR ]</div>
        )}
      </div>
    </div>
  );
}
