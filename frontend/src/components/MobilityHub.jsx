/**
 * MobilityHub — panel agregado de transporte: bicis/scooters (CityBikes GBFS)
 * + deep-links a apps de ride-hailing (Uber, Cabify, Bolt, FreeNow, Citymapper).
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  Bike, Car, Train, X, ExternalLink, Loader2, Zap, MapPin,
} from "lucide-react";
import { fetchMobilityStations, fetchRideDeeplinks } from "@/lib/api";
import UberFareTable from "@/components/UberFareTable";

function StationRow({ s, onPick }) {
  const lowBikes = s.bikes <= 1;
  return (
    <button
      onClick={() => onPick(s)}
      data-testid={`mob-station-${s.id}`}
      className="w-full text-left atlantis-row px-3 py-1.5 border-b border-cyan-500/10 flex items-center gap-2"
    >
      <Bike className={`w-3.5 h-3.5 flex-shrink-0 ${lowBikes ? "text-amber-400" : "text-emerald-400"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold text-cyan-100 truncate">{s.name}</span>
          <span className="font-mono text-[9px] text-cyan-500 shrink-0">{s.distance_m}m</span>
        </div>
        <div className="font-mono text-[10px] text-cyan-300/80 flex items-center gap-2">
          <span><span className={lowBikes ? "text-amber-300" : "text-emerald-300"}>{s.bikes}</span> bicis</span>
          <span className="text-cyan-700">·</span>
          <span>{s.slots} libres</span>
          {s.ebikes > 0 && <><span className="text-cyan-700">·</span><span className="text-amber-300 flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />{s.ebikes}</span></>}
        </div>
        <div className="font-mono text-[9px] text-cyan-700">{s.network_name}</div>
      </div>
    </button>
  );
}

function DeepLinkButton({ link }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`ride-${link.provider.toLowerCase().replace(/[^a-z]/g, "")}`}
      className="flex items-center justify-between gap-2 px-3 py-2 bg-cyan-500/5 border border-cyan-500/30 hover:bg-cyan-500/15 hover:border-cyan-500/60 transition-colors"
      style={{ borderLeftColor: link.color, borderLeftWidth: 3 }}
    >
      <div className="flex items-center gap-2">
        {link.kind === "ride-hailing" ? <Car className="w-3.5 h-3.5" style={{ color: link.color }} /> :
         link.kind === "taxi" ? <Car className="w-3.5 h-3.5" style={{ color: link.color }} /> :
         link.kind === "transit" ? <Train className="w-3.5 h-3.5" style={{ color: link.color }} /> :
         <MapPin className="w-3.5 h-3.5" style={{ color: link.color }} />}
        <span className="font-mono text-[11px] tracking-wide text-cyan-100">{link.provider}</span>
      </div>
      <ExternalLink className="w-3 h-3 text-cyan-500" />
    </a>
  );
}

export default function MobilityHub({ lat, lon, toLat, toLon, onClose, onPickStation, onSetDestinationHint }) {
  const [stations, setStations] = useState(null);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("bicis");
  const [radius, setRadius] = useState(2);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        fetchMobilityStations(lat, lon, radius),
        fetchRideDeeplinks(lat, lon, toLat, toLon),
      ]);
      setStations(s);
      setLinks(l.links || []);
    } catch (e) {
      console.debug("MobilityHub load error:", e);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, toLat, toLon, radius]);

  useEffect(() => { load(); }, [load]);

  const totalBikes = stations?.stations?.reduce((s, x) => s + x.bikes, 0) || 0;
  const totalEBikes = stations?.stations?.reduce((s, x) => s + (x.ebikes || 0), 0) || 0;

  return (
    <div
      className="absolute left-1/2 top-[150px] -translate-x-1/2 w-[440px] max-w-[95vw] panel-solid brackets z-[55] anim-fade-up"
      data-testid="mobility-hub"
    >
      <div className="section-head">
        <span>HUB MOVILIDAD · CERCA DE TI</span>
        <button onClick={onClose} className="text-cyan-300/60 hover:text-cyan-100" data-testid="mob-close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 border-b border-cyan-500/15">
        <div className="px-3 py-2 border-r border-cyan-500/15">
          <div className="font-mono text-[8px] tracking-[0.22em] text-cyan-500/80">ESTACIONES</div>
          <div className="font-mono text-lg text-cyan-100 tabular-nums">{stations?.count || 0}</div>
        </div>
        <div className="px-3 py-2 border-r border-cyan-500/15">
          <div className="font-mono text-[8px] tracking-[0.22em] text-cyan-500/80">BICIS LIBRES</div>
          <div className="font-mono text-lg text-emerald-300 tabular-nums">{totalBikes}</div>
        </div>
        <div className="px-3 py-2">
          <div className="font-mono text-[8px] tracking-[0.22em] text-cyan-500/80">E-BIKES</div>
          <div className="font-mono text-lg text-amber-300 tabular-nums">{totalEBikes}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cyan-500/15">
        <TabBtn active={tab === "bicis"} onClick={() => setTab("bicis")} testId="mob-tab-bicis">
          <Bike className="w-3 h-3" /> BICIS / SCOOTERS
        </TabBtn>
        <TabBtn active={tab === "ride"} onClick={() => setTab("ride")} testId="mob-tab-ride">
          <Car className="w-3 h-3" /> COCHE / TAXI
        </TabBtn>
      </div>

      {tab === "bicis" && (
        <>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-cyan-500/10 bg-cyan-500/3">
            <span className="font-mono text-[9px] tracking-[0.18em] text-cyan-500/80">RADIO</span>
            <div className="flex gap-1">
              {[1, 2, 5, 10].map((r) => (
                <button key={r} onClick={() => setRadius(r)}
                  data-testid={`mob-radius-${r}`}
                  className={`font-mono text-[10px] px-2 py-0.5 border ${radius === r ? "bg-cyan-400 text-[#020a14] border-cyan-400" : "border-cyan-500/30 text-cyan-300"}`}>
                  {r}km
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "330px" }}>
            {loading && (
              <div className="flex items-center justify-center py-6 text-cyan-500/70 text-[11px] gap-2 font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> CONSULTANDO REDES GBFS…
              </div>
            )}
            {!loading && stations?.stations?.length === 0 && (
              <div className="px-3 py-6 text-center font-mono text-[10px] text-cyan-700">[ NO HAY ESTACIONES EN EL RADIO ]</div>
            )}
            {!loading && stations?.stations?.slice(0, 60).map((s) => (
              <StationRow key={s.id} s={s} onPick={onPickStation} />
            ))}
          </div>
        </>
      )}

      {tab === "ride" && (
        <div className="px-3 py-3 space-y-2">
          <UberFareTable lat={lat} lon={lon} toLat={toLat} toLon={toLon} />
          {!toLat && (
            <div className="px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 font-mono text-[10px] tracking-wider text-amber-200">
              💡 Para ver tarifas en vivo de Uber, abre el panel RUTA y define un destino.
            </div>
          )}

          <div className="font-mono text-[9px] tracking-[0.22em] text-cyan-500/80 mb-1 mt-3">
            ▸ ABRE LA APP CON ORIGEN {toLat && toLon ? "Y DESTINO" : ""} PRE-RELLENADOS
          </div>
          {links.map((l) => <DeepLinkButton key={l.provider} link={l} />)}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 font-mono text-[10px] tracking-[0.18em] border-b-2 transition-colors ${
        active ? "border-cyan-400 text-cyan-200 bg-cyan-500/10" : "border-transparent text-cyan-500/80 hover:text-cyan-300"
      }`}
    >
      {children}
    </button>
  );
}
