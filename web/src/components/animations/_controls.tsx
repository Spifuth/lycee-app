import { useState } from "react";

/** Hook + UI partagés pour les contrôles de vitesse/pause des animations.
 *  Usage :
 *    const ctrl = useAnimControls();
 *    // dans setTimeout : ms / ctrl.speed   (skip si ctrl.paused)
 *    <AnimControls ctrl={ctrl} />
 */

const SPEEDS = [0.5, 1, 2] as const;
type Speed = (typeof SPEEDS)[number];

export interface AnimCtrl {
  speed: Speed;
  paused: boolean;
  setSpeed: (s: Speed) => void;
  togglePause: () => void;
}

export function useAnimControls(initial: Speed = 1): AnimCtrl {
  const [speed, setSpeed] = useState<Speed>(initial);
  const [paused, setPaused] = useState(false);
  return {
    speed,
    paused,
    setSpeed,
    togglePause: () => setPaused((p) => !p),
  };
}

export function AnimControls({ ctrl, compact = false }: { ctrl: AnimCtrl; compact?: boolean }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 4px",
        borderRadius: 100,
        background: "#0d1520",
        border: "1px solid #1e293b",
        fontFamily: "'JetBrains Mono', monospace",
      }}
      aria-label="Contrôles d'animation"
    >
      {SPEEDS.map((s) => {
        const active = ctrl.speed === s && !ctrl.paused;
        return (
          <button
            key={s}
            type="button"
            onClick={() => {
              ctrl.setSpeed(s);
              if (ctrl.paused) ctrl.togglePause();
            }}
            title={s === 1 ? "Vitesse normale" : `Vitesse × ${s}`}
            style={{
              fontFamily: "inherit",
              fontSize: compact ? 10 : 11,
              fontWeight: 700,
              padding: compact ? "3px 7px" : "4px 9px",
              borderRadius: 100,
              border: 0,
              cursor: "pointer",
              background: active ? "#38bdf8" : "transparent",
              color: active ? "#0a0a0b" : "#64748b",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1";
            }}
            onMouseLeave={(e) => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
            }}
          >
            {s}×
          </button>
        );
      })}
      <span style={{ width: 1, height: 14, background: "#1e293b", margin: "0 2px" }} aria-hidden />
      <button
        type="button"
        onClick={ctrl.togglePause}
        title={ctrl.paused ? "Reprendre" : "Pause"}
        aria-label={ctrl.paused ? "Reprendre" : "Pause"}
        style={{
          fontFamily: "inherit",
          fontSize: compact ? 11 : 12,
          padding: compact ? "3px 8px" : "4px 10px",
          borderRadius: 100,
          border: 0,
          cursor: "pointer",
          background: ctrl.paused ? "#fbbf24" : "transparent",
          color: ctrl.paused ? "#0a0a0b" : "#94a3b8",
          fontWeight: 700,
          transition: "all 0.2s ease",
        }}
      >
        {ctrl.paused ? "▶" : "⏸"}
      </button>
    </div>
  );
}
