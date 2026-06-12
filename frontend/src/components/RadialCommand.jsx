/**
 * RadialCommand — context-driven planetary control interface.
 *
 * Behaviour summary (matches user spec):
 *   • Idle: a single circle ("sun") with label "Control".
 *   • Hover anywhere over the control area → orbits + planets fade in.
 *   • Hover a planet → its label fills the central sun; on mouse-out → falls
 *     back to the current mode label.
 *   • Click a "mode" planet (outer orbit) → the system pivots:
 *       - The chosen outer planet rotates to 12 o'clock and stays bright.
 *       - Other outer planets stay visible but dim (still clickable).
 *       - Middle + inner orbits repopulate with that mode's planets,
 *         tinted/coloured for the new context.
 *   • Inside a mode, an "action" planet can transition the sun into a
 *     CROSSHAIR mode — only the relevant planet stays lit, all others fade.
 *   • In crosshair mode a planet may carry stateLabels (e.g. INICIO/DESTINO);
 *     each label turns green ✓ as the parent fills it. When all labels filled,
 *     the system returns to the previous mode and the result chip is shown
 *     in the central sun.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ParkingCircle, Bike, Zap, CloudRain, Train,
  Car, Bus, Footprints, CarTaxiFront,
  MapPin, Flag, Route, Ruler, Info, RotateCcw, MapPinned,
  ArrowLeft, ArrowLeftRight, Bookmark, Compass, Search, User, Mic, Clock,
  Layers, Crosshair, HelpCircle, Wrench, Minimize2, Maximize2, Palette,
  Megaphone, Share2, Utensils, ShoppingBag, Check, X as XIcon,
} from "lucide-react";
import {
  MODES, RING_THEME, CORE_SKINS,
  planetsFor, rotationForSlot, indexOfPlanet,
} from "@/lib/radialConfig";

const ICON_MAP = {
  AlertTriangle, ParkingCircle, Bike, Zap, CloudRain, Train,
  Car, Bus, Footprints, CarTaxiFront,
  MapPin, Flag, Route, Ruler, Info, RotateCcw, MapPinned,
  ArrowLeft, ArrowLeftRight, Bookmark, Compass, Search, User, Mic, Clock,
  Layers, Crosshair, HelpCircle, Wrench, Minimize2, Palette,
  Megaphone, Share2, Utensils, ShoppingBag,
};

/* =====================================================================
   Planet — one icon orbiting a ring
   ===================================================================== */
function Planet({ planet, idx, ringRotation, theme, dim, accent, onHover, onSelect, status }) {
  const Icon = ICON_MAP[planet.icon] || Info;
  const angle = idx * 60 - 90;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * theme.radius;
  const y = Math.sin(rad) * theme.radius;

  const opacity = dim ? 0.32 : 1;
  const scale = accent ? 1.18 : 1;

  return (
    <motion.button
      type="button"
      data-testid={`planet-${planet.id}`}
      onClick={(e) => { e.stopPropagation(); onSelect(planet); }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => onHover && onHover(planet)}
      onMouseLeave={() => onHover && onHover(null)}
      animate={{ opacity, scale }}
      whileHover={{ scale: scale * 1.08 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        transform: `translate(-50%, -50%) rotate(${-ringRotation}deg)`,
        width: 44, height: 44,
        borderRadius: "50%",
        background: accent ? theme.color : "rgba(2,10,20,0.86)",
        border: `1.5px solid ${theme.color}`,
        color: accent ? "#020a14" : theme.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        pointerEvents: "auto",
        boxShadow: accent
          ? `0 0 22px ${theme.glow}, 0 0 44px ${theme.glow}, inset 0 0 8px ${theme.glow}`
          : "none",
      }}
    >
      <Icon size={theme.iconSize - 2} strokeWidth={accent ? 2.4 : 1.8} />

      {/* Multi-label badge (e.g. INICIO / DESTINO turning green) */}
      {planet.stateLabels && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -bottom-9 font-mono text-[8px] tracking-widest pointer-events-none"
          style={{ transform: `translateX(-50%) rotate(${ringRotation}deg)`, whiteSpace: "nowrap" }}
        >
          {planet.stateLabels.map(({ key, text }) => {
            const filled = !!(status && status[key]);
            return (
              <div
                key={key}
                className="leading-tight"
                style={{
                  color: filled ? "#4ade80" : "rgba(34,211,238,0.55)",
                  textShadow: filled ? "0 0 8px rgba(74,222,128,0.6)" : "none",
                }}
              >
                {filled && <Check className="inline-block w-2 h-2 mr-0.5" />}
                {text}
              </div>
            );
          })}
        </div>
      )}
    </motion.button>
  );
}

/* =====================================================================
   Orbit — one of the 3 concentric rings
   ===================================================================== */
function Orbit({ planets, theme, rotation, expanded, hiddenInOrbit, dimAll, accentId, hoverId, status, onHover, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: expanded && !hiddenInOrbit ? 1 : 0, scale: expanded ? 1 : 0.55 }}
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
      style={{
        position: "absolute",
        inset: 0,
        width: theme.radius * 2 + 60,
        height: theme.radius * 2 + 60,
        left: `calc(50% - ${theme.radius + 30}px)`,
        top: `calc(50% - ${theme.radius + 30}px)`,
        borderRadius: "50%",
        border: `1px dashed ${theme.color}40`,
        pointerEvents: expanded && !hiddenInOrbit ? "auto" : "none",
      }}
    >
      {/* 12 o'clock indicator */}
      <div style={{
        position: "absolute", left: "50%", top: -2,
        transform: "translateX(-50%)",
        width: 4, height: 18,
        background: theme.color, boxShadow: `0 0 10px ${theme.glow}`,
        borderRadius: 2,
      }} />
      {/* Orbit label */}
      <div style={{
        position: "absolute", left: "50%", top: 14,
        transform: "translateX(-50%)",
        fontFamily: "var(--font-mono,monospace)",
        fontSize: 9, letterSpacing: "0.32em",
        color: theme.color, opacity: 0.6, pointerEvents: "none",
      }}>{theme.name}</div>

      <motion.div animate={{ rotate: rotation }} transition={{ type: "spring", stiffness: 160, damping: 26 }}>
        {planets.map((p, i) => (
          <Planet
            key={`${p.id}-${i}`}
            planet={p}
            idx={i}
            ringRotation={rotation}
            theme={theme}
            dim={dimAll && p.id !== accentId}
            accent={p.id === accentId || p.id === hoverId}
            status={status?.[p.id]}
            onHover={onHover}
            onSelect={onSelect}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

/* =====================================================================
   CoreCircle — central sun: text / crosshair / result
   ===================================================================== */
function CoreSkinBg({ skin }) {
  if (skin === "minimal") {
    return <div className="absolute inset-0 rounded-full border-2 border-cyan-400/70 bg-[#020a14]/85 backdrop-blur-xl pointer-events-none" />;
  }
  if (skin === "crystal") {
    return (
      <div
        className="absolute inset-0 backdrop-blur-xl pointer-events-none"
        style={{
          background: "linear-gradient(135deg,#1e1b4b 0%,#020a14 50%,#831843 100%)",
          clipPath: "polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)",
          border: "1px solid #c084fc",
          boxShadow: "0 0 38px rgba(192,132,252,0.5), inset 0 0 20px rgba(34,211,238,0.4)",
        }}
      />
    );
  }
  return (
    <div
      className="absolute inset-0 rounded-full backdrop-blur-xl overflow-hidden pointer-events-none"
      style={{
        background: "radial-gradient(circle at 32% 32%, #22d3ee 0%, #0e7490 28%, #020a14 78%)",
        border: "2px solid rgba(34,211,238,0.65)",
        boxShadow: "0 0 36px rgba(34,211,238,0.55), inset 0 0 28px rgba(34,211,238,0.5)",
      }}
    >
      <motion.div
        className="absolute inset-2 rounded-full border border-cyan-300/30"
        animate={{ scale: [1, 1.12, 1], opacity: [0.55, 0.1, 0.55] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function CrosshairOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <motion.div
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-full h-full"
      >
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0.5 h-full bg-rose-400/80 shadow-[0_0_10px_#fb7185]" />
        <div className="absolute top-1/2 left-0 -translate-y-1/2 h-0.5 w-full bg-rose-400/80 shadow-[0_0_10px_#fb7185]" />
        <div className="absolute inset-[35%] rounded-full border-2 border-rose-400 shadow-[0_0_15px_rgba(251,113,133,0.6)]" />
        <div className="absolute inset-[44%] rounded-full bg-rose-400 shadow-[0_0_12px_#fb7185]" />
      </motion.div>
    </div>
  );
}

function CoreCircle({ skin, content, mode, crosshair, minimized }) {
  const baseSize = minimized ? 50 : 124;

  return (
    <div
      data-testid="radial-core"
      style={{
        position: "absolute",
        left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        width: baseSize, height: baseSize,
        zIndex: 30,
        pointerEvents: "none",
      }}
    >
      <CoreSkinBg skin={skin} />
      {crosshair && <CrosshairOverlay />}

      {/* Text content overlay */}
      {!minimized && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={content.title + (crosshair ? "-x" : "")}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="font-mono uppercase font-bold leading-tight"
              style={{
                color: crosshair ? "#fb7185" : (mode === "main" ? "#22d3ee" : "#67e8f9"),
                fontSize: content.title?.length > 9 ? "11px" : "13px",
                letterSpacing: "0.18em",
                textShadow: "0 0 10px rgba(34,211,238,0.6)",
              }}
            >
              {content.title}
            </motion.div>
          </AnimatePresence>
          {content.subtitle && (
            <div className="font-mono text-[9px] text-cyan-200/70 mt-1 leading-tight max-w-[110px]">
              {content.subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   RadialCommand — main exported component
   ===================================================================== */
export default function RadialCommand({
  origin, destination,
  onOriginSet, onDestSet, onResetPoints, onReversePoints, onStartPicking,
  onCompute, onToggleLayer, onPickInfo, onSearchNearby,
  onLocateMe, onOpenExpert, onGeocoderOpen,
  transportMode, onTransportChange,
  resultText,
}) {
  // -------- Position / drag / minimize / skin -------------------------------
  const [pos, setPos] = useState(() => ({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 700,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 400,
  }));
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ pointerX: 0, pointerY: 0, posX: 0, posY: 0 });
  const [minimized, setMinimized] = useState(false);
  const [skinIdx, setSkinIdx] = useState(0);

  // -------- Mode state ------------------------------------------------------
  const [mode, setMode] = useState("main");
  const [expanded, setExpanded] = useState(false);
  const [hoverPlanet, setHoverPlanet] = useState(null);

  // -------- Sub-state (crosshair, picking points, etc.) --------------------
  const [picking, setPicking] = useState(null);     // {planetId, fields, fieldIdx}
  const [planetState, setPlanetState] = useState({}); // { planetId: { origin: true, destination: true } }
  const [layerStatus, setLayerStatus] = useState({ traffic: true });

  // -------- Planet lists for this mode -------------------------------------
  const outerPlanets  = useMemo(() => planetsFor(mode, "outer"),  [mode]);
  const middlePlanets = useMemo(() => planetsFor(mode, "middle"), [mode]);
  const innerPlanets  = useMemo(() => planetsFor(mode, "inner"),  [mode]);

  // -------- Rotations: align active mode planet to 12 o'clock --------------
  const outerRotation = useMemo(() => {
    const cfg = MODES[mode];
    if (!cfg?.activeOuterId) return 0;
    const idx = indexOfPlanet(outerPlanets, cfg.activeOuterId);
    return idx >= 0 ? rotationForSlot(idx) : 0;
  }, [mode, outerPlanets]);
  const [middleRotation, setMiddleRotation] = useState(0);
  const [innerRotation, setInnerRotation] = useState(0);
  useEffect(() => { setMiddleRotation(0); setInnerRotation(0); }, [mode]);

  // -------- Drag the whole control around ----------------------------------
  const onDragStart = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = { pointerX: e.clientX, pointerY: e.clientY, posX: pos.x, posY: pos.y };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
  };
  const onDragMove = (e) => {
    setPos({ x: dragRef.current.posX + (e.clientX - dragRef.current.pointerX),
             y: dragRef.current.posY + (e.clientY - dragRef.current.pointerY) });
  };
  const onDragEnd = () => {
    setDragging(false);
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  };
  useEffect(() => () => {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Auto-collapse when pointer is far away -------------------------
  useEffect(() => {
    if (!expanded || dragging || minimized) return;
    const onMove = (e) => {
      const d = Math.hypot(e.clientX - pos.x, e.clientY - pos.y);
      if (d > 290) setExpanded(false);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [expanded, dragging, minimized, pos.x, pos.y]);

  // -------- Crosshair flow: parent feeds origin/destination back -----------
  useEffect(() => {
    if (!picking) return;
    const field = picking.fields[picking.fieldIdx];
    const value = field === "origin" ? origin : destination;
    if (!value) return;
    // mark this field as filled in the planet status
    setPlanetState(s => ({
      ...s,
      [picking.planetId]: { ...(s[picking.planetId] || {}), [field]: true },
    }));
    const nextIdx = picking.fieldIdx + 1;
    if (nextIdx >= picking.fields.length) {
      setPicking(null);   // exit crosshair, all fields filled
    } else {
      setPicking({ ...picking, fieldIdx: nextIdx });
    }
  // we only care about new origin/destination arrivals
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  // -------- Handle a planet click ------------------------------------------
  const handleSelect = (planet) => {
    if (planet.type === "mode" && planet.targetMode) {
      setMode(planet.targetMode);
      setPicking(null);
      return;
    }
    if (planet.type === "action") {
      runAction(planet);
      return;
    }
    if (planet.type === "select") {
      if (planet.group === "transport" && onTransportChange) {
        onTransportChange(planet.value);
      }
      return;
    }
    if (planet.type === "toggle") {
      const next = !layerStatus[planet.value];
      setLayerStatus(s => ({ ...s, [planet.value]: next }));
      if (onToggleLayer) onToggleLayer(planet.value, next);
      return;
    }
  };

  const runAction = (planet) => {
    switch (planet.action) {
      case "select_points":
        // reset previous fills
        setPlanetState(s => ({ ...s, [planet.id]: {} }));
        if (onResetPoints) onResetPoints();
        if (onStartPicking) onStartPicking();
        setPicking({ planetId: planet.id, fields: ["origin", "destination"], fieldIdx: 0 });
        return;
      case "compute":
        if (onCompute) onCompute();
        return;
      case "reverse_points":
        if (onReversePoints) onReversePoints();
        return;
      case "reset":
        setPlanetState({});
        if (onResetPoints) onResetPoints();
        return;
      case "toggle_layer":
        if (onToggleLayer) onToggleLayer(planet.value, true);
        return;
      case "search_nearby":
        if (onSearchNearby) onSearchNearby(planet.value);
        return;
      case "pick_info":
        if (onPickInfo) onPickInfo();
        return;
      case "locate_me":
        if (onLocateMe) onLocateMe();
        return;
      case "cycle_skin":
        setSkinIdx(i => (i + 1) % CORE_SKINS.length);
        return;
      case "minimize":
        setMinimized(true);
        return;
      case "expert_mode":
        if (onOpenExpert) onOpenExpert();
        return;
      case "open_geocoder":
        if (onGeocoderOpen) onGeocoderOpen();
        return;
      default:
    }
  };

  // -------- Resolve central sun content -------------------------------------
  const centerContent = useMemo(() => {
    if (picking) {
      const field = picking.fields[picking.fieldIdx];
      return {
        title: field === "origin" ? "INICIO" : "DESTINO",
        subtitle: "Click en el mapa",
      };
    }
    if (hoverPlanet) {
      return { title: hoverPlanet.label, subtitle: hoverPlanet.desc };
    }
    if (resultText && mode === "navegador") {
      return { title: "Listo", subtitle: resultText };
    }
    const cfg = MODES[mode];
    return { title: cfg.centerLabel, subtitle: expanded ? cfg.centerHint : "" };
  }, [picking, hoverPlanet, resultText, mode, expanded]);

  // ---------- Render --------------------------------------------------------
  const inCrosshair = !!picking;
  const interactiveOrbits = expanded && !minimized && !inCrosshair;

  return (
    <div
      data-testid="radial-command"
      style={{
        position: "fixed",
        left: pos.x, top: pos.y,
        transform: "translate(-50%, -50%)",
        width: minimized ? 70 : 560,
        height: minimized ? 70 : 560,
        zIndex: 60,
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      {/* Hover-trigger zone — small invisible disc around the sun */}
      <div
        data-testid="radial-hover-zone"
        onMouseEnter={() => setExpanded(true)}
        onClick={(e) => { e.stopPropagation(); if (minimized) setMinimized(false); else setExpanded(v => !v); }}
        onPointerDown={onDragStart}
        style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          width: minimized ? 60 : 150,
          height: minimized ? 60 : 150,
          borderRadius: "50%",
          cursor: dragging ? "grabbing" : "grab",
          zIndex: 35,
          pointerEvents: "auto",
        }}
      />

      <AnimatePresence>
        {expanded && !minimized && (
          <>
            {outerPlanets.length > 0 && (
              <Orbit
                planets={outerPlanets}
                theme={RING_THEME.outer}
                rotation={outerRotation}
                expanded={expanded}
                hiddenInOrbit={inCrosshair}
                dimAll={mode !== "main"}
                accentId={MODES[mode]?.activeOuterId}
                hoverId={hoverPlanet?.id}
                onHover={setHoverPlanet}
                onSelect={handleSelect}
              />
            )}
            {middlePlanets.length > 0 && (
              <Orbit
                planets={middlePlanets}
                theme={RING_THEME.middle}
                rotation={middleRotation}
                expanded={expanded}
                hiddenInOrbit={inCrosshair && (picking?.planetId !== "" /* keep visible */)}
                dimAll={inCrosshair}
                accentId={picking?.planetId || null}
                hoverId={hoverPlanet?.id}
                status={planetState}
                onHover={setHoverPlanet}
                onSelect={handleSelect}
              />
            )}
            {innerPlanets.length > 0 && (
              <Orbit
                planets={innerPlanets}
                theme={RING_THEME.inner}
                rotation={innerRotation}
                expanded={expanded}
                hiddenInOrbit={inCrosshair}
                dimAll={false}
                accentId={transportMode ? innerPlanets.find(p => p.value === transportMode)?.id : null}
                hoverId={hoverPlanet?.id}
                onHover={setHoverPlanet}
                onSelect={handleSelect}
              />
            )}
          </>
        )}
      </AnimatePresence>

      {/* Central sun (always rendered) */}
      <CoreCircle
        skin={CORE_SKINS[skinIdx]}
        content={centerContent}
        mode={mode}
        crosshair={inCrosshair}
        minimized={minimized}
      />

      {/* Inline mini-toolbar above the sun (only when expanded, no crosshair) */}
      {interactiveOrbits && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 -translate-x-1/2 -top-2 flex gap-1.5"
          style={{ zIndex: 40, pointerEvents: "auto" }}
        >
          <button
            type="button"
            data-testid="radial-skin-toggle"
            onClick={(e) => { e.stopPropagation(); setSkinIdx(i => (i + 1) % CORE_SKINS.length); }}
            className="p-1 bg-[#020a14]/90 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded-full"
            title="Cambiar aspecto"
          ><Palette size={10} /></button>
          <button
            type="button"
            data-testid="radial-minimize"
            onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
            className="p-1 bg-[#020a14]/90 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded-full"
            title="Minimizar"
          ><Minimize2 size={10} /></button>
        </motion.div>
      )}

      {/* Crosshair-mode cancel button */}
      {inCrosshair && (
        <motion.button
          type="button"
          data-testid="radial-cancel-pick"
          onClick={(e) => { e.stopPropagation(); setPicking(null); }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="absolute left-1/2 -translate-x-1/2 -bottom-4 px-2 py-0.5 bg-rose-500/15 border border-rose-400/60 hover:bg-rose-500/30 font-mono text-[9px] tracking-widest text-rose-200 rounded-full"
          style={{ pointerEvents: "auto" }}
        >
          <XIcon className="inline w-2.5 h-2.5 mr-0.5" /> CANCELAR
        </motion.button>
      )}

      {/* Maximize button when minimized */}
      {minimized && (
        <button
          type="button"
          data-testid="radial-maximize"
          onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
          className="absolute -right-1 -top-1 p-0.5 bg-cyan-400 text-[#020a14] rounded-full"
          style={{ pointerEvents: "auto" }}
        ><Maximize2 size={9} /></button>
      )}
    </div>
  );
}
