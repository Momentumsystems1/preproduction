import React, { useState } from "react";
import MapContainer from "@/components/MapContainer";
import { Maximize2, Minimize2 } from "lucide-react";

export default function App() {
  const [mapStyle, setMapStyle] = useState("normal");
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020a14]" data-testid="app-container">
      {/* Map */}
      <MapContainer style={mapStyle} />

      {/* Scanline overlay */}
      <div className="scanline" style={{ top: 0 }} />

      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-40 flex gap-2">
        <button
          data-testid="focus-toggle"
          onClick={() => setFocusMode(!focusMode)}
          className="px-3 py-1.5 bg-[#020a14]/85 border border-cyan-500/40 hover:border-cyan-300 font-mono text-[10px] tracking-[0.22em] text-cyan-300 flex items-center gap-2"
          title="Toggle focus mode"
        >
          {focusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          {focusMode ? "NORMAL" : "FOCUS"}
        </button>
      </div>

      {/* Status bar */}
      <footer className="absolute bottom-0 left-0 right-0 z-50 panel-solid border-x-0 border-b-0">
        <div className="flex items-center justify-between px-5 py-1.5 text-[10px] font-mono tracking-wider">
          <div className="live-dot" />
          <div className="text-cyan-300">MOMENTUM · ROAD · COMMAND · v3.0</div>
        </div>
      </footer>
    </div>
  );
}