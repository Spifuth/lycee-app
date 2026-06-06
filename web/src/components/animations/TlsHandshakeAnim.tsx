import { useEffect, useRef, useState } from "react";
import { AnimControls, useAnimControls } from "./_controls";

/** TLS handshake — comment le navigateur et le serveur établissent une connexion chiffrée. */

type Phase =
  | "idle"
  | "hello-client"
  | "hello-server"
  | "key-exchange"
  | "finished"
  | "encrypted"
  | "rest";

interface LogEntry { id: number; text: string; color: string }

const PHASE_META: Record<Phase, { label: string; color: string }> = {
  "idle":         { label: "EN ATTENTE",                color: "#475569" },
  "hello-client": { label: "1️⃣  CLIENT HELLO",          color: "#60a5fa" },
  "hello-server": { label: "2️⃣  SERVER HELLO + CERT",   color: "#a855f7" },
  "key-exchange": { label: "3️⃣  ÉCHANGE DE CLÉ",        color: "#f97316" },
  "finished":     { label: "4️⃣  HANDSHAKE FINI",        color: "#22c55e" },
  "encrypted":    { label: "🔒 TUNNEL CHIFFRÉ",         color: "#4ade80" },
  "rest":         { label: "PAUSE",                     color: "#475569" },
};

const NARR: Record<Phase, { title: string; body: string }> = {
  "idle":         { title: "Avant le cadenas", body: "Le navigateur veut parler au serveur en HTTPS. Pour ça, ils doivent d'abord se mettre d'accord sur comment chiffrer la conversation." },
  "hello-client": { title: "Salut, voilà ce que je sais faire", body: "Le client envoie la liste des protocoles TLS et suites de chiffrement qu'il supporte, ainsi qu'un nombre aléatoire." },
  "hello-server": { title: "Salut, j'ai choisi ça, et voici mon passeport", body: "Le serveur choisit une suite, envoie son certificat (signé par une autorité comme Let's Encrypt) et sa clé publique." },
  "key-exchange": { title: "Voilà notre secret commun", body: "Le client génère une clé de session, la chiffre avec la clé publique du serveur, et l'envoie. Seul le serveur peut la déchiffrer." },
  "finished":     { title: "On peut commencer", body: "Les deux côtés ont maintenant la même clé symétrique. Ils confirment et passent en mode chiffré." },
  "encrypted":    { title: "Tout est chiffré", body: "Toutes les requêtes HTTP qui suivent passent dans ce tunnel chiffré. Personne entre les deux ne peut lire." },
  "rest":         { title: "On rejoue", body: "Le cycle va recommencer. En vrai, ce handshake prend ~100ms et se fait une fois par session." },
};

const TICKS: { phase: Phase; ms: number; log?: { text: string; color: string } }[] = [
  { phase: "hello-client", ms: 1400, log: { text: "→ ClientHello: TLS 1.3, ciphers, random",      color: "#60a5fa" } },
  { phase: "hello-server", ms: 1600, log: { text: "← ServerHello + certificat + clé publique",     color: "#a855f7" } },
  { phase: "key-exchange", ms: 1500, log: { text: "→ pre-master secret chiffré (clé publique)",   color: "#f97316" } },
  { phase: "finished",     ms: 1300, log: { text: "↔ ChangeCipherSpec · Finished",                color: "#22c55e" } },
  { phase: "encrypted",    ms: 1700, log: { text: "🔒 GET / chiffré dans le tunnel",              color: "#4ade80" } },
  { phase: "rest",         ms: 1500, log: { text: "— pause —",                                    color: "#475569" } },
];

const TECH_TAGS = ["TLS 1.3", "X.509", "Let's Encrypt", "RSA / ECDHE", "AES-GCM", "SNI"];

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4, animation: "tea-ping 1.2s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

export default function TlsHandshakeAnim() {
  const [tickIdx, setTickIdx] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const timer = useRef<number | null>(null);
  const ctrl = useAnimControls();

  useEffect(() => {
    const t = TICKS[tickIdx];
    if (t.log) setLog((p) => [{ id: Date.now() + Math.random(), ...t.log! }, ...p].slice(0, 12));
    if (ctrl.paused) return;
    timer.current = window.setTimeout(() => setTickIdx((i) => (i + 1) % TICKS.length), t.ms / ctrl.speed);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [tickIdx, ctrl.speed, ctrl.paused]);

  const phase = TICKS[tickIdx].phase;
  const meta = PHASE_META[phase];
  const narr = NARR[phase];

  const clientActive = ["hello-client", "key-exchange", "finished", "encrypted"].includes(phase);
  const serverActive = ["hello-server", "finished", "encrypted"].includes(phase);
  const tunnelActive = phase === "encrypted";

  // Direction de la flèche selon la phase
  const arrowDir: "right" | "left" | "both" | "none" =
    phase === "hello-client" || phase === "key-exchange" ? "right" :
    phase === "hello-server" ? "left" :
    phase === "finished" || phase === "encrypted" ? "both" : "none";

  return (
    <div className="tea-root">
      <style>{`
        @keyframes tea-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes tea-slide-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes tea-chevron-pulse { from { opacity: 0.15; } to { opacity: 1; } }
        @keyframes tea-badge-morph { 0% { transform: scaleX(1); opacity: 1; } 40% { transform: scaleX(0.15); opacity: 0; } 60% { transform: scaleX(0.15); opacity: 0; } 100% { transform: scaleX(1); opacity: 1; } }
        @keyframes tea-tunnel-glow { 0%, 100% { box-shadow: 0 0 0 transparent; } 50% { box-shadow: 0 0 20px #4ade8033, inset 0 0 10px #4ade8011; } }
        .tea-root { font-family: 'JetBrains Mono', ui-monospace, monospace; color: #94a3b8; background: #090e16; border: 1px solid #1e293b; border-radius: 14px; padding: 20px 16px; max-width: 100%; }
        .tea-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; transition: all 0.4s ease; }
        .tea-log { animation: tea-slide-in 0.25s ease; padding: 4px 8px; border-radius: 4px; font-size: 11px; background: #0d1520; border-left: 2px solid; margin-bottom: 4px; }
        @media (min-width: 780px) { .tea-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; align-items: start; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <span key={phase} className="tea-badge" style={{ background: meta.color + "15", border: `1px solid ${meta.color}55`, color: meta.color, animation: "tea-badge-morph 0.5s ease" }}>
          <PulsingDot color={meta.color} size={6} />
          {meta.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AnimControls ctrl={ctrl} compact />
          <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em" }}>ÉTAPE {tickIdx + 1}/{TICKS.length}</span>
        </div>
      </div>

      <div className="tea-grid">
        <div>
          {/* Client | tunnel | Server */}
          <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
            {/* Client */}
            <div style={{ flex: 1, background: clientActive ? "#3b82f618" : "#0d1520", border: `1px solid ${clientActive ? "#3b82f666" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={clientActive ? "#3b82f6" : "#1e293b"} size={6} /> navigateur
              </div>
              <div style={{ fontSize: 22 }}>🌐</div>
              <div style={{ fontSize: 11, color: clientActive ? "#f1f5f9" : "#64748b", marginTop: 4 }}>
                {phase === "key-exchange" || phase === "finished" || phase === "encrypted" ? "🔑 clé de session" : "génère un random"}
              </div>
            </div>

            {/* Tunnel area */}
            <div style={{ flex: 1.2, background: tunnelActive ? "#4ade8008" : "#0d1520", border: `1px solid ${tunnelActive ? "#4ade8055" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", textAlign: "center", transition: "all 0.4s ease", animation: tunnelActive ? "tea-tunnel-glow 2s ease-in-out infinite" : "none" }}>
              <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>canal réseau</div>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{tunnelActive ? "🔒" : "📡"}</div>

              {/* arrows */}
              <div style={{ display: "flex", justifyContent: "center", gap: 4, alignItems: "center" }}>
                {arrowDir === "right" && [0,1,2].map(i => (
                  <span key={i} style={{ fontSize: 18, fontWeight: 700, color: meta.color, animation: `tea-chevron-pulse 0.8s ${i*0.15}s ease-in-out infinite alternate` }}>›</span>
                ))}
                {arrowDir === "left" && [0,1,2].map(i => (
                  <span key={i} style={{ fontSize: 18, fontWeight: 700, color: meta.color, animation: `tea-chevron-pulse 0.8s ${i*0.15}s ease-in-out infinite alternate` }}>‹</span>
                ))}
                {arrowDir === "both" && (
                  <span style={{ fontSize: 16, color: meta.color, fontWeight: 700 }}>‹  ›</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: tunnelActive ? "#4ade80" : "#475569", marginTop: 6 }}>
                {tunnelActive ? "AES-GCM" : "encore en clair"}
              </div>
            </div>

            {/* Server */}
            <div style={{ flex: 1, background: serverActive ? "#a855f718" : "#0d1520", border: `1px solid ${serverActive ? "#a855f766" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={serverActive ? "#a855f7" : "#1e293b"} size={6} /> serveur
              </div>
              <div style={{ fontSize: 22 }}>🖥️</div>
              <div style={{ fontSize: 11, color: serverActive ? "#f1f5f9" : "#64748b", marginTop: 4 }}>
                {phase === "hello-server" ? "📜 cert + clé pub" : phase === "finished" || phase === "encrypted" ? "🔑 clé de session" : "écoute :443"}
              </div>
            </div>
          </div>

          {/* roadmap des étapes */}
          <div style={{ marginTop: 14, padding: "8px 12px", background: "#0d1520", border: "1px solid #1e293b", borderRadius: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, fontSize: 10 }}>
              {(["hello-client","hello-server","key-exchange","finished"] as Phase[]).map((p, i) => {
                const done = TICKS.findIndex(t => t.phase === phase) >= TICKS.findIndex(t => t.phase === p);
                const active = phase === p;
                return (
                  <div key={p} style={{ padding: "5px 6px", borderRadius: 6, border: `1px solid ${active ? PHASE_META[p].color + "88" : done ? PHASE_META[p].color + "44" : "#1e293b"}`, background: active ? PHASE_META[p].color + "15" : "transparent", color: done ? PHASE_META[p].color : "#475569", textAlign: "center" }}>
                    {i+1}. {PHASE_META[p].label.replace(/^[0-9️⃣🔒]+\s+/, "")}
                  </div>
                );
              })}
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

      <div style={{ marginTop: 16, fontSize: 10, color: "#475569", textAlign: "center", letterSpacing: "0.05em" }}>$ animation auto · lycee-app · tls-handshake</div>
    </div>
  );
}
