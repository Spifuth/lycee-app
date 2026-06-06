import { useEffect, useRef, useState } from "react";
import { AnimControls, useAnimControls } from "./_controls";

/** Animation affichée quand le vote est fermé. Esthétique terminal dark,
 *  cohérente avec AiLockedAnim, RequeteHttpAnim, etc.
 *  Affiche en boucle : verrouillage + 4 tips éducatifs sur le module vote.
 */

type Phase =
  | "knock"
  | "check"
  | "locked"
  | "tip-why"
  | "tip-howmany"
  | "tip-howitworks"
  | "tip-when";

interface LogEntry { id: number; text: string; color: string }

const PHASE_META: Record<Phase, { label: string; color: string }> = {
  "knock":          { label: "🗳️ TU CLIQUES POUR VOTER",  color: "#60a5fa" },
  "check":          { label: "🔎 LE PORTIER VÉRIFIE",      color: "#a855f7" },
  "locked":         { label: "🔒 VOTE FERMÉ POUR LE MOMENT", color: "#f87171" },
  "tip-why":        { label: "💡 LE SAVAIS-TU ? · POURQUOI VOTER", color: "#22c55e" },
  "tip-howmany":    { label: "💡 LE SAVAIS-TU ? · 3 VOTES MAX",    color: "#f97316" },
  "tip-howitworks": { label: "💡 LE SAVAIS-TU ? · COMMENT ÇA MARCHE", color: "#14b8a6" },
  "tip-when":       { label: "🎤 QUAND ÇA SE DÉBLOQUE",    color: "#ec4899" },
};

const NARRATION: Record<Phase, { title: string; body: string }> = {
  "knock": {
    title: "Tu as cliqué sur une carte sujet…",
    body: "Ta requête part vers le serveur. Mais avant de compter le vote, il vérifie qu'on a le droit de voter là, tout de suite.",
  },
  "check": {
    title: "FastAPI lit l'état vote_open en BDD",
    body: "C'est un simple booléen, stocké dans la table app_state. L'intervenant peut le basculer depuis /admin.",
  },
  "locked": {
    title: "vote_open = false → 409 Conflict",
    body: "Réponse instantanée, ton vote n'est PAS enregistré. Tu attendras l'ouverture officielle.",
  },
  "tip-why": {
    title: "Pourquoi un vote ?",
    body: "C'est toi qui orientes la session. Les sujets les plus votés seront approfondis en live. Pas de programme imposé : tu choisis ce qui t'intéresse.",
  },
  "tip-howmany": {
    title: "3 votes maximum par personne",
    body: "Pourquoi pas un seul ? Pour t'obliger à hiérarchiser : tu n'es pas obligé·e d'aimer un seul sujet. Pourquoi pas 10 ? Parce que ça reviendrait à voter pour tout, et donc pour rien.",
  },
  "tip-howitworks": {
    title: "Vote pondéré ? Non, vote simple.",
    body: "Chaque vote vaut 1 point. Le classement live est juste un compteur. Tu peux changer d'avis et modifier tes votes tant que le vote est ouvert.",
  },
  "tip-when": {
    title: "L'intervenant clique 'Ouvrir le vote'",
    body: "Sur la page /admin. Bascule du booléen, et hop : vote_open = true. Reviens dans 2 minutes — tu verras les cartes devenir cliquables et le classement live se remplir.",
  },
};

const TICKS: { phase: Phase; ms: number; log?: { text: string; color: string } }[] = [
  { phase: "knock",          ms: 1200, log: { text: "POST /api/vote",                                 color: "#60a5fa" } },
  { phase: "check",          ms: 1400, log: { text: "SELECT value FROM app_state WHERE key='vote_open'", color: "#a855f7" } },
  { phase: "locked",         ms: 1500, log: { text: "← HTTP 409 Conflict",                            color: "#f87171" } },
  { phase: "tip-why",        ms: 4500, log: { text: "💡 c'est toi qui choisis l'ordre du jour",       color: "#22c55e" } },
  { phase: "tip-howmany",    ms: 4500, log: { text: "💡 max 3 votes · hiérarchise tes préférences",   color: "#f97316" } },
  { phase: "tip-howitworks", ms: 4500, log: { text: "💡 chaque vote = 1 pt · modifiable en live",     color: "#14b8a6" } },
  { phase: "tip-when",       ms: 4500, log: { text: "/admin → 🔓 Ouvrir le vote",                     color: "#ec4899" } },
];

const TECH_TAGS = ["AppState booléen", "FastAPI", "Vote idempotent", "Refresh 15s", "Top 3 live", "Public"];

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4, animation: "tea-ping 1.2s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

export default function VoteClosedAnim() {
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

  const userActive = ["knock", "tip-why", "tip-howmany"].includes(phase);
  const gateActive = ["check", "locked", "tip-howitworks", "tip-when"].includes(phase);
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
          {/* User / Gate / Vote box (closed) */}
          <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
            {/* User */}
            <div style={{ flex: 1, background: userActive ? "#3b82f618" : "#0d1520", border: `1px solid ${userActive ? "#3b82f666" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={userActive ? "#3b82f6" : "#1e293b"} size={6} /> toi
              </div>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🧒</div>
              <div style={{ fontSize: 11, color: userActive ? "#f1f5f9" : "#64748b" }}>clique sur 3 sujets</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
              {[0,1,2].map((i) => (
                <span key={i} style={{ fontSize: 18, fontWeight: 700, color: userActive && gateActive ? "#60a5fa" : "#1e293b", animation: userActive && gateActive ? `tea-chevron-pulse 0.8s ${i*0.15}s ease-in-out infinite alternate` : "none" }}>›</span>
              ))}
            </div>

            {/* Gate */}
            <div style={{ flex: 1, background: gateActive ? "#a855f718" : "#0d1520", border: `1px solid ${gateActive ? "#a855f766" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={gateActive ? "#a855f7" : "#1e293b"} size={6} /> portier
              </div>
              <div style={{ fontSize: 22, marginBottom: 4, display: "inline-block", animation: phase === "locked" ? "tea-lock-shake 0.4s ease" : "none" }}>
                {phase === "locked" ? "🔒" : "🛡️"}
              </div>
              <div style={{ fontSize: 11, color: gateActive ? "#f1f5f9" : "#64748b" }}>
                vote_open = <span style={{ color: "#f87171" }}>false</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
              {[0,1,2].map((i) => (
                <span key={i} style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>·</span>
              ))}
            </div>

            {/* Vote box — toujours en veille */}
            <div style={{ flex: 1, background: "#0d1520", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 10px", opacity: 0.55 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color="#1e293b" size={6} /> urne
              </div>
              <div style={{ fontSize: 22, marginBottom: 4, opacity: 0.5 }}>🗳️</div>
              <div style={{ fontSize: 11, color: "#475569" }}>fermée<br />à clé</div>
            </div>
          </div>

          {/* Detail panel */}
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
              {isLocked ? "CE QUI SE PASSE" : "DERRIÈRE LE VERROU"}
            </div>
            <div style={{ fontSize: 15, color: "#f1f5f9", marginBottom: 6 }}>{narr.title}</div>
            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.55 }}>{narr.body}</div>
          </div>
        </div>

        <div>
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
        $ animation auto · lycee-app · vote-closed · ça ouvrira pendant l'intervention
      </div>
    </div>
  );
}
