/**
 * UberFareTable — extracted from MobilityHub.
 * Shows per-product Uber estimates with image + capacity + ETA + price range.
 */
import React, { useEffect, useState } from "react";
import debug from "@/lib/debug";
import { Loader2 } from "lucide-react";
import { fetchUberEstimates } from "@/lib/api";

function FareRow({ product }) {
  const price = product.estimate || `${product.low_estimate}-${product.high_estimate} €`;
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-cyan-500/10 last:border-0 atlantis-row">
      <img
        src={product.image}
        alt={product.product}
        className="w-8 h-5 object-contain bg-white/5 rounded-sm"
        onError={(e) => { e.target.style.display = "none"; }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[11px] font-semibold text-cyan-100 truncate">{product.product}</div>
        <div className="font-mono text-[9px] text-cyan-500">
          {product.capacity} pax · ETA ~{product.duration_min || "?"}min
        </div>
      </div>
      <div className="font-mono text-xs font-semibold text-amber-300 tabular-nums">{price}</div>
    </div>
  );
}

export default function UberFareTable({ lat, lon, toLat, toLon }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!toLat || !toLon) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    fetchUberEstimates(lat, lon, toLat, toLon)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => debug("Uber est fail", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lat, lon, toLat, toLon]);

  if (!toLat || !toLon) return null;

  return (
    <div className="border border-cyan-500/20" data-testid="uber-grid">
      <div className="flex items-center justify-between px-2 py-1 bg-cyan-500/5 border-b border-cyan-500/15">
        <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300">UBER · TARIFAS</span>
        <span className="font-mono text-[9px] text-cyan-600">
          {data?.distance_km ? `${data.distance_km}km · ~${data.duration_min}min` : ""}
        </span>
      </div>
      {loading && (
        <div className="px-2 py-3 font-mono text-[10px] text-cyan-500/80 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Calculando…
        </div>
      )}
      {!loading && data?.prices?.map((p) => <FareRow key={p.product} product={p} />)}
      {data?.mode === "fare-estimation" && (
        <div className="px-2 py-1.5 bg-amber-500/5 border-t border-amber-500/20 font-mono text-[9px] text-amber-200/80 leading-snug">
          ▸ ESTIMACIÓN basada en tarifas públicas Uber España · Precio final en la app
        </div>
      )}
    </div>
  );
}
