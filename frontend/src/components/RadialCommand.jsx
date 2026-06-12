/**
 * RadialCommand — radial dial interface for fleet/mobility control.
 * 3 concentric ring of 6 slots each + central draggable "Core".
 *
 * Pure-presentational: parent owns selection + map context.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ParkingCircle, Bike, Zap, CloudRain, Train,
  Car, Bus, Footprints,
  MapPin, Flag, Route, Ruler, Info, RotateCcw,
  Minus, Maximize2, Palette, X, ChevronRight,
} from "lucide-react";
import {
  RING_THEME, RING_SLOTS, SMART_LINKS, CORE_SKINS,
  rotationForSlot, activeSlotIndex,
} from "@/lib/radialConfig";

const ICON_MAP = {
  AlertTriangle, ParkingCircle, Bike, Zap, CloudRain, Train,
  Car, Bus, Footprints,
  MapPin, Flag, Route, Ruler, Info, RotateCcw,
};

/* =====================================================================
   Slot — a single icon positioned on a ring
   ===================================================================== */
function Slot({ slot, idx, theme, isActive, ringRotation, onSelect, onHover }) {
  const Icon = ICON_MAP[slot.icon] || Info;
  const angleDeg = idx * 60 - 90; // 12 o'clock = top
  const rad = (angleDeg * Math.PI) / 180;
  const x = Math.cos(rad) * theme.radius;
  const y = Math.sin(rad) * theme.radius;

  return (
    <motion.button
      type="button"
      data-testid={`radial-slot-${slot.id}`}
      onClick={(e) => { e.stopPropagation(); onSelect(idx); }}
      onMouseEnter={() => onHover && onHover(slot)}
      onMouseLeave={() => onHover && onHover(null)}
      animate={{
        scale: isActive ? 1.18 : 1,
        boxShadow: isActive
          ? `0 0 22px ${theme.glow}, 0 0 40px ${theme.glow}, inset 0 0 8px ${theme.glow}`
          : `0 0 0px ${theme.glow}`,
      }}
      whileHover={{ scale: 1.25 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      style={{
        position: "absolute",
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        transform: `translate(-50%, -50%) rotate(${-ringRotation}deg)`, // counter-rotate so icons stay upright
        width: 42, height: 42,
        borderRadius: "50%",
        background: isActive ? theme.color : "rgba(2,10,20,0.85)",
        border: `1.5px solid ${theme.color}`,
        color: isActive ? "#020a14" : theme.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        pointerEvents: "auto",
      }}
    >
      <Icon size={theme.iconSize - 2} strokeWidth={isActive ? 2.5 : 1.8} />
    </motion.button>
  );
}

/* =====================================================================
   Ring — a single rotatable circle of 6 slots
   ===================================================================== */
function Ring({ which, theme, rotation, activeIdx, expanded, onRotate, onSelect, onHover }) {
  const slots = RING_SLOTS[which];
  const ringRef = useRef(null);
  const dragState = useRef({ active: false, lastAngle: 0 });

  // Convert pointer position → angle relative to ring center
  const angleFromPointer = (e) => {
    const el = ringRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  const handlePointerDown = (e) => {
    // Don't start ring drag if user clicked on a slot button — let the slot handle the click
    if (e.target.closest('button')) return;
    e.stopPropagation();
    dragState.current = { active: true, lastAngle: angleFromPointer(e), totalDelta: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragState.current.active) return;
    const a = angleFromPointer(e);
    let delta = a - dragState.current.lastAngle;
    // Normalize wrap-around (jumps across ±180°)
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    dragState.current.lastAngle = a;
    dragState.current.totalDelta += Math.abs(delta);
    onRotate(rotation + delta);
  };

  const handlePointerUp = (e) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* pointer no longer captured */ }
    // Snap to nearest 60°
    const stepped = Math.round(rotation / 60) * 60;
    onRotate(stepped);
  };

  return (
    <motion.div
      ref={ringRef}
      data-testid={`radial-ring-${which}`}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: expanded ? 1 : 0, scale: expanded ? 1 : 0.4 }}
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "absolute",
        inset: 0,
        width: theme.radius * 2 + 50,
        height: theme.radius * 2 + 50,
        left: `calc(50% - ${theme.radius + 25}px)`,
        top: `calc(50% - ${theme.radius + 25}px)`,
        borderRadius: "50%",
        border: `1px dashed ${theme.color}55`,
        background: `radial-gradient(circle, transparent 60%, ${theme.bg} 100%)`,
        cursor: "grab",
        pointerEvents: expanded ? "auto" : "none",
      }}
    >
      {/* Track gradient highlight at 12 o'clock to mark active sector */}
      <div
        style={{
          position: "absolute",
          width: 4, height: 22,
          left: "50%", top: -2,
          transform: "translateX(-50%)",
          background: theme.color,
          boxShadow: `0 0 10px ${theme.glow}`,
          borderRadius: 2,
        }}
      />
      {/* Ring label */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 16,
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono,monospace)",
          fontSize: 9,
          letterSpacing: "0.32em",
          color: theme.color,
          opacity: 0.7,
          pointerEvents: "none",
        }}
      >
        {theme.name}
      </div>

      {/* Rotating slot container */}
      <motion.div
        animate={{ rotate: rotation }}
        transition={{ type: "spring", stiffness: 160, damping: 26 }}
        style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
      >
        {slots.map((s, i) => (
          <Slot
            key={s.id}
            slot={s}
            idx={i}
            theme={theme}
            isActive={i === activeIdx}
            ringRotation={rotation}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

/* =====================================================================
   Core — the central draggable/minimizable control button
   ===================================================================== */
function SkinView({ skin }) {
  if (skin === "minimal") {
    return (
      <div className="absolute inset-0 rounded-full border-2 border-cyan-400/70 bg-[#020a14]/85 backdrop-blur-xl flex items-center justify-center pointer-events-none">
        <div className="w-3 h-3 rounded-full bg-cyan-300 shadow-[0_0_18px_#22d3ee]" />
      </div>
    );
  }
  if (skin === "crystal") {
    return (
      <div
        className="absolute inset-0 backdrop-blur-xl flex items-center justify-center pointer-events-none"
        style={{
          background: "linear-gradient(135deg,#1e1b4b 0%,#020a14 50%,#831843 100%)",
          clipPath: "polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)",
          border: "1px solid #c084fc",
          boxShadow: "0 0 40px rgba(192,132,252,0.55),inset 0 0 22px rgba(34,211,238,0.4)",
        }}
      >
        <div className="w-4 h-4 rotate-45 bg-cyan-300 shadow-[0_0_22px_#22d3ee]" />
      </div>
    );
  }
  // orb (default)
  return (
    <div
      className="absolute inset-0 rounded-full backdrop-blur-xl flex items-center justify-center overflow-hidden pointer-events-none"
      style={{
        background: "radial-gradient(circle at 35% 35%,#22d3ee 0%,#0e7490 30%,#020a14 75%)",
        border: "2px solid rgba(34,211,238,0.6)",
        boxShadow: "0 0 36px rgba(34,211,238,0.55),inset 0 0 30px rgba(34,211,238,0.55)",
      }}
    >
      <motion.div
        className="absolute inset-2 rounded-full border border-cyan-300/40"
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.1, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="w-3 h-3 rounded-full bg-white/90 shadow-[0_0_12px_#fff]" />
    </div>
  );
}

function Core({ skin, expanded, minimized, context, hoverSlot, onToggle, onConfirm, onSkin, onMinimize }) {

  const size = minimized ? 48 : 110;

  return (
    <div
      data-testid="radial-core"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: size,
        height: size,
        zIndex: 30,
        pointerEvents: "none",   // hover-zone above handles toggle/drag
      }}
    >
      <SkinView skin={skin} />

      {/* Hover label or context */}
      {!minimized && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-3 font-mono text-[10px] tracking-[0.2em] text-center"
          style={{ color: "#22d3ee", whiteSpace: "nowrap", pointerEvents: "none" }}
        >
          {hoverSlot
            ? <span className="text-cyan-200">▸ {hoverSlot.label.toUpperCase()}</span>
            : (expanded
                ? <span className="text-cyan-400/80">CONTROL · ACTIVO</span>
                : <span className="text-cyan-400/60 animate-pulse">HOVER · ABRIR</span>)}
        </div>
      )}

      {/* Mini-toolbar: skin / minimize / confirm */}
      {expanded && !minimized && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 -translate-x-1/2 -top-9 flex gap-1.5"
          style={{ zIndex: 40, pointerEvents: "auto" }}
        >
          <button
            type="button"
            data-testid="radial-skin-toggle"
            onClick={(e) => { e.stopPropagation(); onSkin(); }}
            className="p-1 bg-[#020a14]/90 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded-full"
            title="Cambiar aspecto"
          >
            <Palette size={11} />
          </button>
          <button
            type="button"
            data-testid="radial-minimize"
            onClick={(e) => { e.stopPropagation(); onMinimize(); }}
            className="p-1 bg-[#020a14]/90 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 rounded-full"
            title="Minimizar"
          >
            <Minus size={11} />
          </button>
          {context && context.length > 0 && (
            <button
              type="button"
              data-testid="radial-confirm"
              onClick={(e) => { e.stopPropagation(); onConfirm(); }}
              className="px-2 py-0.5 bg-emerald-400 text-[#020a14] hover:bg-emerald-300 text-[9px] font-mono tracking-wider font-bold rounded-full flex items-center gap-0.5"
              title="Entrar"
            >
              ENTRAR <ChevronRight size={10} />
            </button>
          )}
        </motion.div>
      )}

      {minimized && (
        <button
          type="button"
          data-testid="radial-maximize"
          onClick={(e) => { e.stopPropagation(); onMinimize(); }}
          className="absolute -right-1 -top-1 p-0.5 bg-cyan-400 text-[#020a14] rounded-full"
          style={{ pointerEvents: "auto" }}
          title="Restaurar"
        >
          <Maximize2 size={9} />
        </button>
      )}
    </div>
  );
}

/* =====================================================================
   RadialCommand — full component
   ===================================================================== */
export default function RadialCommand({
  origin, destination, contextFeature,
  onSelectionChange, onConfirm, onPointerMoveOverMap,
  initialPos,
}) {
  const containerRef = useRef(null);

  // expansion state — opens on hover (desktop) or click (mobile)
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [skinIdx, setSkinIdx] = useState(0);
  const [hoverSlot, setHoverSlot] = useState(null);

  // Position of the whole control on screen
  const [pos, setPos] = useState(() => initialPos || {
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 480,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 360,
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ pointerX: 0, pointerY: 0, posX: 0, posY: 0 });

  // Rotation per ring (degrees). Slot 0 active = rotation 0.
  const [rotations, setRotations] = useState({ outer: 0, middle: 0, inner: 0 });

  // Drag the whole control via the SVG dragHandle area (transparent overlay)
  const handleDragStart = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { pointerX: e.clientX, pointerY: e.clientY, posX: pos.x, posY: pos.y };
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
  };
  const handleDragMove = (e) => {
    setPos({
      x: dragStart.current.posX + (e.clientX - dragStart.current.pointerX),
      y: dragStart.current.posY + (e.clientY - dragStart.current.pointerY),
    });
    if (onPointerMoveOverMap) onPointerMoveOverMap({ x: e.clientX, y: e.clientY });
  };
  const handleDragEnd = (e) => {
    setDragging(false);
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", handleDragEnd);
    if (onPointerMoveOverMap) onPointerMoveOverMap({ x: e.clientX, y: e.clientY, dropped: true });
  };
  useEffect(() => () => {
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", handleDragEnd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Active slot per ring
  const active = useMemo(() => ({
    outer:  RING_SLOTS.outer[activeSlotIndex(rotations.outer)],
    middle: RING_SLOTS.middle[activeSlotIndex(rotations.middle)],
    inner:  RING_SLOTS.inner[activeSlotIndex(rotations.inner)],
  }), [rotations]);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectionChange) onSelectionChange({
      layer: active.outer.id, mode: active.middle.id, action: active.inner.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.outer.id, active.middle.id, active.inner.id]);

  // Cross-ring smart links
  const handleSelect = (ring, slotIdx) => {
    setRotations(prev => {
      const next = { ...prev, [ring]: rotationForSlot(slotIdx) };
      const chosenId = RING_SLOTS[ring][slotIdx].id;
      const link = SMART_LINKS[ring]?.[chosenId] || {};
      Object.entries(link).forEach(([otherRing, otherSlotId]) => {
        const otherIdx = RING_SLOTS[otherRing].findIndex(s => s.id === otherSlotId);
        if (otherIdx >= 0) next[otherRing] = rotationForSlot(otherIdx);
      });
      return next;
    });
  };

  // Build context summary for the center
  const context = [
    contextFeature ? `📍 ${contextFeature.label || "Punto"}` : null,
    origin ? "ORG✓" : null,
    destination ? "DST✓" : null,
  ].filter(Boolean);

  // Auto-collapse when pointer leaves the radial area (no pointer-events box blocking the map)
  useEffect(() => {
    if (!expanded || dragging || minimized) return;
    const onMove = (e) => {
      const dx = e.clientX - pos.x;
      const dy = e.clientY - pos.y;
      if (Math.hypot(dx, dy) > 280) setExpanded(false);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [expanded, dragging, minimized, pos.x, pos.y]);

  return (
    <div
      ref={containerRef}
      data-testid="radial-command"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, -50%)",
        width: minimized ? 70 : 560,
        height: minimized ? 70 : 560,
        zIndex: 60,
        userSelect: "none",
        pointerEvents: "none",   // never block the map; child elements re-enable events
      }}
    >
      {/* Hover-trigger area = small circle around the core, the only element that
          captures pointer events when collapsed. zIndex 35 keeps it above the visual
          Core (30) but below the floating toolbar (40). */}
      <div
        data-testid="radial-hover-zone"
        onMouseEnter={() => setExpanded(true)}
        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
        onPointerDown={handleDragStart}
        style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          width: minimized ? 60 : 130,
          height: minimized ? 60 : 130,
          borderRadius: "50%",
          cursor: dragging ? "grabbing" : "grab",
          zIndex: 35,
          pointerEvents: "auto",
        }}
      />

      <AnimatePresence>
        {expanded && !minimized && (
          <>
            <Ring
              key="outer"
              which="outer"
              theme={RING_THEME.outer}
              rotation={rotations.outer}
              activeIdx={activeSlotIndex(rotations.outer)}
              expanded={expanded}
              onRotate={(r) => setRotations(p => ({ ...p, outer: r }))}
              onSelect={(i) => handleSelect("outer", i)}
              onHover={setHoverSlot}
            />
            <Ring
              key="middle"
              which="middle"
              theme={RING_THEME.middle}
              rotation={rotations.middle}
              activeIdx={activeSlotIndex(rotations.middle)}
              expanded={expanded}
              onRotate={(r) => setRotations(p => ({ ...p, middle: r }))}
              onSelect={(i) => handleSelect("middle", i)}
              onHover={setHoverSlot}
            />
            <Ring
              key="inner"
              which="inner"
              theme={RING_THEME.inner}
              rotation={rotations.inner}
              activeIdx={activeSlotIndex(rotations.inner)}
              expanded={expanded}
              onRotate={(r) => setRotations(p => ({ ...p, inner: r }))}
              onSelect={(i) => handleSelect("inner", i)}
              onHover={setHoverSlot}
            />
          </>
        )}
      </AnimatePresence>

      <Core
        skin={CORE_SKINS[skinIdx]}
        expanded={expanded}
        minimized={minimized}
        context={context}
        hoverSlot={hoverSlot}
        onToggle={() => setExpanded(v => !v)}
        onConfirm={onConfirm}
        onSkin={() => setSkinIdx(i => (i + 1) % CORE_SKINS.length)}
        onMinimize={() => setMinimized(v => !v)}
      />

      {/* Hover descriptor (below the entire control) */}
      {expanded && hoverSlot && !minimized && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-wide text-cyan-100/90 italic px-2"
          style={{ top: "calc(50% + 240px)", whiteSpace: "nowrap", pointerEvents: "none" }}
        >
          ▸ {hoverSlot.desc}
        </motion.div>
      )}
    </div>
  );
}
