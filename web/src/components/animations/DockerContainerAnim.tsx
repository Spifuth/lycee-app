import { useEffect, useRef, useState } from "react";
import { AnimControls, useAnimControls } from "./_controls";

/** Container vs VM — boot time + RAM + densité, comparaison live. */

interface LogEntry { id: number; text: string; color: string }

const TECH_TAGS = ["Docker", "OCI", "namespaces", "cgroups", "containerd", "KVM/QEMU"];

const VM_STACK = [
  { label: "App", emoji: "📱", color: "#60a5fa" },
  { label: "Libs / binaries", emoji: "📚", color: "#94a3b8" },
  { label: "Guest OS (Ubuntu)", emoji: "🐧", color: "#fb7185" },
  { label: "Hyperviseur (KVM)", emoji: "🧱", color: "#a855f7" },
  { label: "Host OS (Linux)", emoji: "🖥️", color: "#94a3b8" },
  { label: "Matériel physique", emoji: "🔩", color: "#475569" },
];

const CT_STACK = [
  { label: "App", emoji: "📱", color: "#60a5fa" },
  { label: "Libs / binaries", emoji: "📚", color: "#94a3b8" },
  { label: "Docker engine (containerd)", emoji: "🐳", color: "#22c55e" },
  { label: "Host OS (Linux)", emoji: "🖥️", color: "#94a3b8" },
  { label: "Matériel physique", emoji: "🔩", color: "#475569" },
];

const VM_BOOT_MS = 4500;   // ~30 sec dans la vraie vie
const CT_BOOT_MS = 900;    // ~1 sec dans la vraie vie
const CYCLE_REST_MS = 2200;

export default function DockerContainerAnim() {
  const [running, setRunning] = useState(false);
  const [vmProgress, setVmProgress] = useState(0);
  const [ctProgress, setCtProgress] = useState(0);
  const [vmBootedAt, setVmBootedAt] = useState<number | null>(null);
  const [ctBootedAt, setCtBootedAt] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [cycle, setCycle] = useState(0);
  const ctrl = useAnimControls();
  // Refs pour que la rAF loop voit toujours la dernière valeur sans dépendances
  const speedRef = useRef(ctrl.speed);
  const pausedRef = useRef(ctrl.paused);
  useEffect(() => { speedRef.current = ctrl.speed; }, [ctrl.speed]);
  useEffect(() => { pausedRef.current = ctrl.paused; }, [ctrl.paused]);

  function pushLog(text: string, color: string) {
    setLog((p) => [{ id: Date.now() + Math.random(), text, color }, ...p].slice(0, 12));
  }

  useEffect(() => {
    let cancelled = false;
    let restTimer: number | null = null;
    setRunning(true);
    setVmProgress(0); setCtProgress(0); setVmBootedAt(null); setCtBootedAt(null);
    pushLog("→ démarrage VM + container en parallèle", "#94a3b8");

    // Compteur d'elapsed manuel : on accumule dt * speed à chaque frame,
    // sauf si paused. Permet 0.5x / 1x / 2x / pause sans casser la cinétique.
    let elapsed = 0;
    let lastFrame = performance.now();
    let vmDone = false;
    let ctDone = false;

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      const dt = now - lastFrame;
      lastFrame = now;
      if (!pausedRef.current) {
        elapsed += dt * speedRef.current;
      }
      const vmP = Math.min(1, elapsed / VM_BOOT_MS);
      const ctP = Math.min(1, elapsed / CT_BOOT_MS);
      setVmProgress(vmP);
      setCtProgress(ctP);
      if (ctP >= 1 && !ctDone) {
        ctDone = true;
        setCtBootedAt(elapsed);
        pushLog("✓ container démarré ~1s (perçu)", "#22c55e");
      }
      if (vmP >= 1 && !vmDone) {
        vmDone = true;
        setVmBootedAt(elapsed);
        pushLog("✓ VM démarrée ~30s (perçu)", "#a855f7");
      }
      if (vmP < 1 || ctP < 1) {
        requestAnimationFrame(tick);
      } else {
        setRunning(false);
        pushLog("pause — relance dans 2s", "#475569");
        // CYCLE_REST_MS aussi affecté par speed (mais pas par pause)
        const restMs = CYCLE_REST_MS / Math.max(0.01, speedRef.current);
        restTimer = window.setTimeout(() => {
          if (!cancelled) setCycle((c) => c + 1);
        }, restMs);
      }
    };
    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (restTimer) window.clearTimeout(restTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle]);

  const phaseLabel = running ? "🚀 BOOT EN COURS" : "⏸  PAUSE — RELANCE";
  const phaseColor = running ? "#60a5fa" : "#475569";

  return (
    <div className="tea-root">
      <style>{`
        @keyframes tea-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes tea-slide-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes tea-badge-morph { 0% { transform: scaleX(1); opacity: 1; } 40% { transform: scaleX(0.15); opacity: 0; } 60% { transform: scaleX(0.15); opacity: 0; } 100% { transform: scaleX(1); opacity: 1; } }
        .tea-root { font-family: 'JetBrains Mono', ui-monospace, monospace; color: #94a3b8; background: #090e16; border: 1px solid #1e293b; border-radius: 14px; padding: 20px 16px; max-width: 100%; }
        .tea-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; transition: all 0.4s ease; }
        .tea-log { animation: tea-slide-in 0.25s ease; padding: 4px 8px; border-radius: 4px; font-size: 11px; background: #0d1520; border-left: 2px solid; margin-bottom: 4px; }
        .tea-stack-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 11px; background: #0d1520; border: 1px solid #1e293b; margin-bottom: 3px; transition: all 0.3s ease; }
        @media (min-width: 780px) { .tea-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; align-items: start; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <span key={phaseLabel} className="tea-badge" style={{ background: phaseColor + "15", border: `1px solid ${phaseColor}55`, color: phaseColor, animation: "tea-badge-morph 0.5s ease" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: phaseColor, opacity: running ? 1 : 0.4 }} />
          {phaseLabel}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AnimControls ctrl={ctrl} compact />
          <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em" }}>CYCLE #{cycle + 1}</span>
        </div>
      </div>

      <div className="tea-grid">
        <div>
          {/* Side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* VM side */}
            <div style={{ background: "#0d1520", border: "1px solid #a855f733", borderRadius: 10, padding: "10px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#c084fc" }}>🧱 Machine virtuelle</span>
                <span style={{ fontSize: 9, color: "#475569" }}>~30s</span>
              </div>
              {VM_STACK.map((s) => (
                <div key={s.label} className="tea-stack-row" style={{ borderColor: vmProgress > 0 ? "#a855f744" : "#1e293b" }}>
                  <span>{s.emoji}</span>
                  <span style={{ color: vmProgress > 0 ? "#cbd5e1" : "#64748b", flex: 1 }}>{s.label}</span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 9, color: "#64748b" }}>RAM ~512MB · Disque ~5GB</div>
              <div style={{ marginTop: 4, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${vmProgress * 100}%`, height: "100%", background: "#a855f7", transition: "width 0.1s linear" }} />
              </div>
              {vmBootedAt !== null && <div style={{ marginTop: 4, fontSize: 10, color: "#a855f7" }}>✓ démarrée</div>}
            </div>

            {/* Container side */}
            <div style={{ background: "#0d1520", border: "1px solid #22c55e33", borderRadius: 10, padding: "10px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>🐳 Container</span>
                <span style={{ fontSize: 9, color: "#475569" }}>~1s</span>
              </div>
              {CT_STACK.map((s) => (
                <div key={s.label} className="tea-stack-row" style={{ borderColor: ctProgress > 0 ? "#22c55e44" : "#1e293b" }}>
                  <span>{s.emoji}</span>
                  <span style={{ color: ctProgress > 0 ? "#cbd5e1" : "#64748b", flex: 1 }}>{s.label}</span>
                </div>
              ))}
              {/* spacer pour aligner avec la VM */}
              <div style={{ height: 24 }} />
              <div style={{ marginTop: 8, fontSize: 9, color: "#64748b" }}>RAM ~50MB · Disque ~200MB</div>
              <div style={{ marginTop: 4, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${ctProgress * 100}%`, height: "100%", background: "#22c55e", transition: "width 0.1s linear" }} />
              </div>
              {ctBootedAt !== null && <div style={{ marginTop: 4, fontSize: 10, color: "#22c55e" }}>✓ démarré</div>}
            </div>
          </div>

          <div style={{ marginTop: 14, background: "#0d1520", border: "1px solid #1e293b33", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>CE QU'IL FAUT RETENIR</div>
            <ul style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
              <li>Une <span style={{ color: "#c084fc" }}>VM</span> embarque tout un OS guest → grosse, lente à démarrer, mais isolation matérielle forte.</li>
              <li>Un <span style={{ color: "#4ade80" }}>container</span> partage le noyau Linux de l'hôte → léger, démarrage instantané, beaucoup plus dense sur la même machine.</li>
              <li>On parle de Docker, mais sous le capot ce sont surtout des <strong>namespaces</strong> et <strong>cgroups</strong> du kernel Linux.</li>
            </ul>
          </div>
        </div>

        <div>
          <div style={{ marginTop: 14, background: "#0d1520", border: "1px solid #1e293b", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>LIVE LOG</div>
            <div style={{ maxHeight: 280, overflow: "hidden" }}>
              {log.length === 0 ? <div style={{ fontSize: 11, color: "#1e293b", padding: 4 }}>$ waiting...</div> : log.map((e) => (
                <div key={e.id} className="tea-log" style={{ borderLeftColor: e.color, color: "#cbd5e1" }}>
                  <span style={{ color: e.color }}>›</span> {e.text}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TECH_TAGS.map((tag) => (
              <span key={tag} style={{ fontSize: 10, color: "#334155", border: "1px solid #1e293b", borderRadius: 100, padding: "3px 10px" }}>#{tag}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 10, color: "#475569", textAlign: "center", letterSpacing: "0.05em" }}>$ animation auto · lycee-app · container-vs-vm</div>
    </div>
  );
}
