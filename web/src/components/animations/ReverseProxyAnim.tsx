import { useEffect, useRef, useState } from "react";
import { AnimControls, useAnimControls } from "./_controls";

/** Reverse proxy — Traefik route 50 services derrière un seul hostname et port. */

type Phase = "idle" | "request" | "inspect" | "route" | "response" | "rest";

interface Hostname {
  host: string;
  target: string;
  icon: string;
  color: string;
}

const HOSTS: Hostname[] = [
  { host: "lycee.nebulahost.tech",     target: "lycee-web:8080",     icon: "🎓", color: "#60a5fa" },
  { host: "heolstor.nebulahost.tech",  target: "heolstor-web:8000",  icon: "⚔️",  color: "#22c55e" },
  { host: "grafana.nebulahost.tech",   target: "grafana:3000",       icon: "📊", color: "#f97316" },
  { host: "matrix.nebulahost.tech",    target: "conduit:6167",       icon: "💬", color: "#a855f7" },
  { host: "hoarder.nebulahost.tech",   target: "hoarder-web:3000",   icon: "🔖", color: "#ec4899" },
];

const PHASE_META: Record<Phase, { label: string; color: string }> = {
  "idle":     { label: "EN ATTENTE",          color: "#475569" },
  "request":  { label: "→ REQUÊTE ENTRANTE", color: "#60a5fa" },
  "inspect":  { label: "🔍 LECTURE DU HOST",  color: "#a855f7" },
  "route":    { label: "↳ ROUTE VERS LE BON SERVICE", color: "#22c55e" },
  "response": { label: "← RÉPONSE",            color: "#22c55e" },
  "rest":     { label: "PRÊT POUR LA SUIVANTE", color: "#475569" },
};

const PHASE_NARR: Record<Phase, { title: string; body: string }> = {
  "idle":     { title: "Au repos", body: "Traefik écoute en permanence sur le port 443 (HTTPS), prêt à accueillir n'importe quelle requête." },
  "request":  { title: "Quelqu'un sonne à la porte", body: "Une requête HTTPS arrive. Le navigateur a écrit dans l'en-tête : « Host: <l'URL demandée> »." },
  "inspect":  { title: "Traefik lit l'étiquette", body: "Le reverse proxy regarde le Host header pour savoir à quel container interne il doit passer la requête." },
  "route":    { title: "Direction le bon container", body: "Selon les règles configurées, Traefik transmet la requête au service correspondant — sans que le client le sache." },
  "response": { title: "Renvoi de la réponse", body: "Le service interne répond, Traefik relaie au navigateur. Tout s'est passé sur la même IP publique." },
  "rest":     { title: "Et on recommence", body: "Une seule machine, un seul port public, des dizaines de services. C'est tout le truc du reverse proxy." },
};

const TICKS_BASE: { phase: Phase; ms: number }[] = [
  { phase: "request", ms: 1100 },
  { phase: "inspect", ms: 1400 },
  { phase: "route",   ms: 1400 },
  { phase: "response", ms: 1200 },
  { phase: "rest",    ms: 900 },
];

const TECH_TAGS = ["Traefik v3", "Docker labels", "Host header", "TLS SNI", "Let's Encrypt", "DNS Cloudflare"];

interface LogEntry { id: number; text: string; color: string }

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4, animation: "tea-ping 1.2s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

export default function ReverseProxyAnim() {
  const [tickIdx, setTickIdx] = useState(0);
  const [hostIdx, setHostIdx] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const timer = useRef<number | null>(null);
  const ctrl = useAnimControls();

  useEffect(() => {
    const t = TICKS_BASE[tickIdx];
    const host = HOSTS[hostIdx];

    if (t.phase === "request")   pushLog(`→ ${host.host}`, "#60a5fa");
    if (t.phase === "inspect")   pushLog(`Traefik: Host=${host.host}`, "#a855f7");
    if (t.phase === "route")     pushLog(`↳ proxy_pass → ${host.target}`, host.color);
    if (t.phase === "response")  pushLog(`← 200 OK depuis ${host.target}`, "#22c55e");

    if (ctrl.paused) return;
    timer.current = window.setTimeout(() => {
      const next = (tickIdx + 1) % TICKS_BASE.length;
      setTickIdx(next);
      if (next === 0) setHostIdx((h) => (h + 1) % HOSTS.length);
    }, t.ms / ctrl.speed);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickIdx, ctrl.speed, ctrl.paused]);

  function pushLog(text: string, color: string) {
    setLog((p) => [{ id: Date.now() + Math.random(), text, color }, ...p].slice(0, 12));
  }

  const phase = TICKS_BASE[tickIdx].phase;
  const host = HOSTS[hostIdx];
  const meta = PHASE_META[phase];
  const narr = PHASE_NARR[phase];

  const traefikActive = ["request", "inspect", "route", "response"].includes(phase);
  const clientActive = ["request", "response"].includes(phase);
  const serviceActive = ["route", "response"].includes(phase);

  return (
    <div className="tea-root">
      <style>{`
        @keyframes tea-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes tea-slide-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes tea-chevron-pulse { from { opacity: 0.15; } to { opacity: 1; } }
        @keyframes tea-badge-morph { 0% { transform: scaleX(1); opacity: 1; } 40% { transform: scaleX(0.15); opacity: 0; } 60% { transform: scaleX(0.15); opacity: 0; } 100% { transform: scaleX(1); opacity: 1; } }
        .tea-root { font-family: 'JetBrains Mono', ui-monospace, monospace; color: #94a3b8; background: #090e16; border: 1px solid #1e293b; border-radius: 14px; padding: 20px 16px; max-width: 100%; }
        .tea-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; transition: all 0.4s ease; }
        .tea-log { animation: tea-slide-in 0.25s ease; padding: 4px 8px; border-radius: 4px; font-size: 11px; background: #0d1520; border-left: 2px solid; margin-bottom: 4px; }
        .tea-stage { display: flex; gap: 6px; align-items: stretch; }
        .tea-chevron { display: flex; gap: 4px; padding: 0 4px; align-items: center; }
        .tea-chevron span { font-size: 18px; font-weight: 700; }
        @media (min-width: 780px) { .tea-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; align-items: start; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <span key={phase} className="tea-badge" style={{ background: meta.color + "15", border: `1px solid ${meta.color}55`, color: meta.color, animation: "tea-badge-morph 0.5s ease" }}>
          <PulsingDot color={meta.color} size={6} />
          {meta.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AnimControls ctrl={ctrl} compact />
          <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em" }}>HOST {hostIdx + 1}/{HOSTS.length}</span>
        </div>
      </div>

      <div className="tea-grid">
        <div>
          <div className="tea-stage">
            {/* Client */}
            <div style={{ flex: 1, minWidth: 0, background: clientActive ? "#3b82f618" : "#0d1520", border: `1px solid ${clientActive ? "#3b82f666" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={clientActive ? "#3b82f6" : "#1e293b"} size={6} />
                <span>navigateur</span>
              </div>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{host.icon}</div>
              <div style={{ fontSize: 10, color: clientActive ? "#f1f5f9" : "#64748b", wordBreak: "break-all", lineHeight: 1.3 }}>{host.host}</div>
            </div>

            <div className="tea-chevron">
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ color: clientActive && traefikActive ? "#60a5fa" : "#1e293b", animation: clientActive && traefikActive ? `tea-chevron-pulse 0.8s ${i * 0.15}s ease-in-out infinite alternate` : "none" }}>
                  {phase === "response" ? "‹" : "›"}
                </span>
              ))}
            </div>

            {/* Traefik */}
            <div style={{ flex: 1, minWidth: 0, background: traefikActive ? "#a855f718" : "#0d1520", border: `1px solid ${traefikActive ? "#a855f766" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={traefikActive ? "#a855f7" : "#1e293b"} size={6} />
                <span>traefik</span>
              </div>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🚪</div>
              <div style={{ fontSize: 11, color: traefikActive ? "#f1f5f9" : "#64748b" }}>reverse proxy<br /><span style={{ color: "#475569", fontSize: 10 }}>:443</span></div>
            </div>

            <div className="tea-chevron">
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ color: serviceActive ? host.color : "#1e293b", animation: serviceActive ? `tea-chevron-pulse 0.8s ${i * 0.15}s ease-in-out infinite alternate` : "none" }}>
                  {phase === "response" ? "‹" : "›"}
                </span>
              ))}
            </div>

            {/* Service */}
            <div style={{ flex: 1, minWidth: 0, background: serviceActive ? host.color + "18" : "#0d1520", border: `1px solid ${serviceActive ? host.color + "66" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={serviceActive ? host.color : "#1e293b"} size={6} />
                <span>service</span>
              </div>
              <div style={{ fontSize: 22, marginBottom: 4 }}>📦</div>
              <div style={{ fontSize: 10, color: serviceActive ? "#f1f5f9" : "#64748b", wordBreak: "break-all" }}>{host.target}</div>
            </div>
          </div>

          {/* mini liste des autres services */}
          <div style={{ marginTop: 14, padding: "8px 12px", background: "#0d1520", border: "1px solid #1e293b", borderRadius: 10 }}>
            <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>50+ SERVICES DERRIÈRE LE MÊME PORT 443</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {HOSTS.map((h, i) => (
                <span key={h.host} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 100, border: `1px solid ${i === hostIdx ? h.color + "88" : "#1e293b"}`, background: i === hostIdx ? h.color + "15" : "transparent", color: i === hostIdx ? h.color : "#475569", transition: "all 0.3s ease" }}>
                  {h.icon} {h.host.split(".")[0]}
                </span>
              ))}
              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 100, border: "1px solid #1e293b", color: "#334155" }}>...et 45 autres</span>
            </div>
          </div>

          <div key={phase + "-detail"} style={{ marginTop: 14, background: "#0d1520", border: `1px solid ${meta.color}33`, borderRadius: 10, padding: "12px 14px", animation: "tea-slide-in 0.35s ease" }}>
            <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>CE QUI SE PASSE</div>
            <div style={{ fontSize: 14, color: "#f1f5f9", marginBottom: 4 }}>{narr.title}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{narr.body}</div>
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

      <div style={{ marginTop: 16, fontSize: 10, color: "#475569", textAlign: "center", letterSpacing: "0.05em" }}>$ animation auto · lycee-app · reverse-proxy</div>
    </div>
  );
}
