import { useEffect, useRef, useState } from "react";
import { AnimControls, useAnimControls } from "./_controls";

/** Animation qui s'affiche quand le module IA est verrouillé.
 *  Style cohérent avec /comment-ca-marche : dark terminal, dots qui pulsent,
 *  event log. Mais ici le but c'est de transmettre 3-4 tips pendant l'attente.
 */

type Phase =
  | "knock"          // l'utilisateur frappe à la porte (POST /api/ai/chat)
  | "check"          // le portier (FastAPI) vérifie le flag ai_open
  | "locked"         // verdict : verrouillé
  | "tip-llm"        // tip 1 : ce que fait un LLM
  | "tip-resources"  // tip 2 : pourquoi c'est cher à faire tourner
  | "tip-local"      // tip 3 : pourquoi c'est cool en local
  | "tip-unlock";    // tip 4 : comment l'intervenant peut l'ouvrir

interface LogEntry { id: number; text: string; color: string }

const PHASE_META: Record<Phase, { label: string; color: string }> = {
  "knock":         { label: "🚪 TOC TOC", color: "#60a5fa" },
  "check":         { label: "🔎 LE PORTIER VÉRIFIE", color: "#a855f7" },
  "locked":        { label: "🔒 VERROUILLÉ POUR LE MOMENT", color: "#f87171" },
  "tip-llm":       { label: "💡 LE SAVAIS-TU ? · LLM", color: "#22c55e" },
  "tip-resources": { label: "💡 LE SAVAIS-TU ? · RESSOURCES", color: "#f97316" },
  "tip-local":     { label: "💡 LE SAVAIS-TU ? · LOCAL VS CLOUD", color: "#14b8a6" },
  "tip-unlock":    { label: "🎤 COMMENT ÇA SE DÉBLOQUE", color: "#ec4899" },
};

const NARRATION: Record<Phase, { title: string; body: string }> = {
  "knock": {
    title: "Tu as cliqué sur 'Lancer'…",
    body: "Ta requête part vers le serveur. Mais avant d'atteindre le modèle, elle passe par un portier qui vérifie qu'on a le droit d'allumer l'IA.",
  },
  "check": {
    title: "FastAPI lit l'état ai_open en BDD",
    body: "C'est un simple booléen, stocké dans la table app_state. L'admin peut le basculer depuis /admin.",
  },
  "locked": {
    title: "ai_open = false → 423 Locked",
    body: "Réponse renvoyée tout de suite, sans même consulter le modèle. Économie de RAM, de CPU, d'argent.",
  },
  "tip-llm": {
    title: "Un LLM, en vrai, ça fait quoi ?",
    body: "Il prédit le mot suivant. Encore et encore. À partir de tout ce qu'il a lu pendant son entraînement (des milliards de textes). C'est pour ça qu'il peut « halluciner » : il prédit ce qui sonne juste, pas ce qui EST juste.",
  },
  "tip-resources": {
    title: "Pourquoi on ne l'allume pas par défaut",
    body: "Un modèle qui répond à 25 lycéens simultanés sur un petit serveur CPU, ça queue. Le RAM se remplit, les réponses ralentissent à 1 token/seconde. L'intervenant préfère allumer le moteur juste avant la démo.",
  },
  "tip-local": {
    title: "Le truc cool : il tourne ICI",
    body: "Pas chez OpenAI ni Google. Sur le même serveur que ce site. Ce que tu lui demanderas ne servira pas à entraîner GPT-5. Tes prompts restent privés.",
  },
  "tip-unlock": {
    title: "L'intervenant clique 'Déverrouiller l'IA'",
    body: "Sur la page /admin (protégée par mot de passe). Bascule du booléen, et hop : ai_open = true. Le portier laisse passer, ton prompt arrive au modèle, qui répond token par token. Reviens essayer dans quelques minutes !",
  },
};

const TICKS: { phase: Phase; ms: number; log?: { text: string; color: string } }[] = [
  { phase: "knock",         ms: 1200, log: { text: "POST /api/ai/chat",                          color: "#60a5fa" } },
  { phase: "check",         ms: 1400, log: { text: "SELECT value FROM app_state WHERE key='ai_open'", color: "#a855f7" } },
  { phase: "locked",        ms: 1500, log: { text: "← HTTP 423 Locked",                          color: "#f87171" } },
  { phase: "tip-llm",       ms: 4500, log: { text: "💡 token = ~0.75 mot · contexte = mémoire courte", color: "#22c55e" } },
  { phase: "tip-resources", ms: 4500, log: { text: "💡 qwen 3b ≈ 2GB RAM · 5 tokens/s sur CPU",   color: "#f97316" } },
  { phase: "tip-local",     ms: 4500, log: { text: "💡 self-hosted = 0 fuite de données",        color: "#14b8a6" } },
  { phase: "tip-unlock",    ms: 4500, log: { text: "/admin → 🔓 Déverrouiller l'IA",             color: "#ec4899" } },
];

const TECH_TAGS = ["Ollama", "Qwen 2.5 3B", "SSE streaming", "Rate-limit 3/min/user", "FastAPI", "Pas de OpenAI"];

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4, animation: "tea-ping 1.2s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

export default function AiLockedAnim() {
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
  const narr = NARRATION[phase];

  const userActive = ["knock", "tip-llm", "tip-local"].includes(phase);
  const gateActive = ["check", "locked", "tip-resources", "tip-unlock"].includes(phase);
  const modelActive = !["locked", "knock"].includes(phase) && phase !== "check";

  const isLocked = ["knock", "check", "locked"].includes(phase);

  return (
    <div className="tea-root">
      <style>{`
        @keyframes tea-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes tea-slide-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes tea-chevron-pulse { from { opacity: 0.15; } to { opacity: 1; } }
        @keyframes tea-badge-morph { 0% { transform: scaleX(1); opacity: 1; } 40% { transform: scaleX(0.15); opacity: 0; } 60% { transform: scaleX(0.15); opacity: 0; } 100% { transform: scaleX(1); opacity: 1; } }
        @keyframes tea-lock-shake { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
        @keyframes tea-tip-glow { 0%, 100% { box-shadow: 0 0 0 transparent; } 50% { box-shadow: 0 0 18px var(--tip-color, #22c55e44); } }
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
          {/* User / Gate / Model */}
          <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
            {/* User */}
            <div style={{ flex: 1, background: userActive ? "#3b82f618" : "#0d1520", border: `1px solid ${userActive ? "#3b82f666" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={userActive ? "#3b82f6" : "#1e293b"} size={6} /> toi
              </div>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🧒</div>
              <div style={{ fontSize: 11, color: userActive ? "#f1f5f9" : "#64748b" }}>prompt envoyé</div>
            </div>

            {/* arrow */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
              {[0,1,2].map((i) => (
                <span key={i} style={{ fontSize: 18, fontWeight: 700, color: userActive && gateActive ? "#60a5fa" : "#1e293b", animation: userActive && gateActive ? `tea-chevron-pulse 0.8s ${i*0.15}s ease-in-out infinite alternate` : "none" }}>›</span>
              ))}
            </div>

            {/* Gate */}
            <div style={{ flex: 1, background: gateActive ? "#a855f718" : "#0d1520", border: `1px solid ${gateActive ? "#a855f766" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={gateActive ? "#a855f7" : "#1e293b"} size={6} /> portier
              </div>
              <div style={{ fontSize: 22, marginBottom: 4, display: "inline-block", animation: phase === "locked" ? "tea-lock-shake 0.4s ease" : "none" }}>
                {phase === "locked" ? "🔒" : "🛡️"}
              </div>
              <div style={{ fontSize: 11, color: gateActive ? "#f1f5f9" : "#64748b" }}>
                ai_open = <span style={{ color: "#f87171" }}>false</span>
              </div>
            </div>

            {/* arrow blocked */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
              {[0,1,2].map((i) => (
                <span key={i} style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>·</span>
              ))}
            </div>

            {/* Model — toujours en mode "veille" */}
            <div style={{ flex: 1, background: "#0d1520", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 10px", opacity: 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color="#1e293b" size={6} /> modèle
              </div>
              <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.5 }}>💤</div>
              <div style={{ fontSize: 11, color: "#475569" }}>qwen 3b<br />en veille</div>
            </div>
          </div>

          {/* Detail panel (narration courante) */}
          <div
            key={phase + "-detail"}
            style={{
              marginTop: 14,
              background: "#0d1520",
              border: `1px solid ${meta.color}44`,
              borderRadius: 10,
              padding: "14px 16px",
              animation: !isLocked ? "tea-tip-glow 3s ease-in-out infinite" : "tea-slide-in 0.35s ease",
              ["--tip-color" as never]: meta.color + "44",
            }}
          >
            <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
              {isLocked ? "CE QUI SE PASSE" : "DERRIÈRE LA PORTE FERMÉE"}
            </div>
            <div style={{ fontSize: 15, color: "#f1f5f9", marginBottom: 6 }}>{narr.title}</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55 }}>{narr.body}</div>
          </div>
        </div>

        <div>
          {/* Live log */}
          <div style={{ marginTop: 14, background: "#0d1520", border: "1px solid #1e293b", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>TRACE</div>
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

      <div style={{ marginTop: 16, fontSize: 10, color: "#475569", textAlign: "center", letterSpacing: "0.05em" }}>
        $ animation auto · lycee-app · ai-locked · ça se débloquera pendant la démo
      </div>
    </div>
  );
}
