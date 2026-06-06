import { useEffect, useRef, useState } from "react";
import { AnimControls, useAnimControls } from "./_controls";

/** Le voyage d'une requête HTTP — du navigateur au serveur et retour.
 *  Cycle automatique. Tout en français, esthétique dark terminal.
 */

type Phase =
  | "idle"
  | "type-url"
  | "dns-query"
  | "dns-response"
  | "http-request"
  | "server-processing"
  | "http-response"
  | "rendered";

const PHASE_META: Record<Phase, { label: string; color: string }> = {
  "idle": { label: "EN ATTENTE", color: "#475569" },
  "type-url": { label: "✍️  TU TAPES L'URL", color: "#60a5fa" },
  "dns-query": { label: "❓  RECHERCHE DNS", color: "#a855f7" },
  "dns-response": { label: "📬  IP TROUVÉE", color: "#a855f7" },
  "http-request": { label: "🚀  REQUÊTE HTTP", color: "#60a5fa" },
  "server-processing": { label: "⚙️  SERVEUR EN TRAVAIL", color: "#22c55e" },
  "http-response": { label: "📨  RÉPONSE HTTP 200", color: "#22c55e" },
  "rendered": { label: "✅  PAGE AFFICHÉE", color: "#4ade80" },
};

interface LogEntry {
  id: number;
  text: string;
  color: string;
}

const TICKS: { phase: Phase; ms: number; log?: { text: string; color: string } }[] = [
  { phase: "type-url",          ms: 1200, log: { text: "Tu tapes lycee.nebulahost.tech",           color: "#60a5fa" } },
  { phase: "dns-query",         ms: 1400, log: { text: "Navigateur → DNS : « c'est quelle IP ? »", color: "#a855f7" } },
  { phase: "dns-response",      ms: 1200, log: { text: "DNS → Navigateur : 78.46.x.y",             color: "#a855f7" } },
  { phase: "http-request",      ms: 1400, log: { text: "Navigateur → Serveur : GET /",             color: "#60a5fa" } },
  { phase: "server-processing", ms: 1500, log: { text: "Serveur : je prépare le HTML…",            color: "#22c55e" } },
  { phase: "http-response",     ms: 1400, log: { text: "Serveur → Navigateur : 200 OK + HTML",     color: "#22c55e" } },
  { phase: "rendered",          ms: 1800, log: { text: "✓ Page affichée à l'écran",                color: "#4ade80" } },
  { phase: "idle",              ms: 1600, log: { text: "— pause —",                                color: "#475569" } },
];

const NARRATION: Record<Phase, { title: string; body: string }> = {
  "idle":              { title: "On recommence ?",          body: "Le cycle va redémarrer pour que tu puisses revoir chaque étape." },
  "type-url":          { title: "L'URL dans la barre",       body: "Tu écris lycee.nebulahost.tech. Le navigateur doit traduire ce nom en IP." },
  "dns-query":         { title: "Question au DNS",           body: "Le navigateur demande à un serveur DNS (annuaire du web) à quelle IP correspond ce nom." },
  "dns-response":      { title: "Le DNS répond",             body: "Le DNS renvoie l'adresse IP. Le navigateur sait maintenant qui contacter." },
  "http-request":      { title: "GET / vers le serveur",     body: "Le navigateur ouvre une connexion TLS (cadenas vert) et envoie une requête HTTP : « donne-moi la page d'accueil »." },
  "server-processing": { title: "Le serveur bosse",          body: "Nginx + FastAPI s'activent : récupère le HTML, ajoute les headers, prépare la réponse." },
  "http-response":     { title: "200 OK",                    body: "Le serveur renvoie le code 200 (succès) avec le contenu HTML de la page." },
  "rendered":          { title: "Affichage",                 body: "Le navigateur reçoit, parse le HTML, télécharge le CSS/JS, et dessine la page que tu vois." },
};

const TECH_TAGS = ["HTTP/2", "TLS", "DNS", "TCP/IP", "Traefik", "nginx", "FastAPI"];

function PulsingDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: color,
          opacity: 0.4,
          animation: "rh-ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
        }}
      />
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

function FlowArrows({
  direction,
  color,
  active,
}: {
  direction: "right" | "left";
  color: string;
  active: boolean;
}) {
  const glyph = direction === "right" ? "›" : "‹";
  return (
    <div style={{ display: "flex", gap: 4, padding: "0 4px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 18,
            fontWeight: 700,
            color: active ? color : "#1e293b",
            animation: active
              ? `rh-chevron-pulse 0.8s ${i * 0.15}s ease-in-out infinite alternate`
              : "none",
          }}
        >
          {glyph}
        </span>
      ))}
    </div>
  );
}

function ActorPanel({
  label,
  detail,
  dotColor,
  active,
  icon,
}: {
  label: string;
  detail: string;
  dotColor: string;
  active: boolean;
  icon: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        background: active ? dotColor + "18" : "#0d1520",
        border: `1px solid ${active ? dotColor + "66" : "#1e293b"}`,
        borderRadius: 10,
        padding: "12px 10px",
        transition: "all 0.4s ease",
        position: "relative",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          marginBottom: 8,
        }}
      >
        <PulsingDot color={active ? dotColor : "#1e293b"} size={6} />
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: active ? "#f1f5f9" : "#64748b",
          wordBreak: "break-word",
          lineHeight: 1.3,
          transition: "color 0.4s ease",
        }}
      >
        {detail}
      </div>
    </div>
  );
}

export default function RequeteHttpAnim() {
  const [tickIdx, setTickIdx] = useState(0);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const timerRef = useRef<number | null>(null);
  const ctrl = useAnimControls();

  useEffect(() => {
    const current = TICKS[tickIdx];
    if (current.log) {
      setLogEntries((prev) =>
        [{ id: Date.now() + Math.random(), text: current.log!.text, color: current.log!.color }, ...prev].slice(0, 12),
      );
    }
    if (ctrl.paused) return;
    timerRef.current = window.setTimeout(() => {
      setTickIdx((i) => (i + 1) % TICKS.length);
    }, current.ms / ctrl.speed);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [tickIdx, ctrl.speed, ctrl.paused]);

  const phase = TICKS[tickIdx].phase;
  const meta = PHASE_META[phase];
  const narr = NARRATION[phase];

  const browserActive = ["type-url", "dns-query", "http-request", "rendered"].includes(phase);
  const dnsActive = ["dns-query", "dns-response"].includes(phase);
  const serverActive = ["http-request", "server-processing", "http-response"].includes(phase);

  const browserToDns = phase === "dns-query";
  const dnsToBrowser = phase === "dns-response";
  const browserToServer = phase === "http-request";
  const serverToBrowser = phase === "http-response";

  return (
    <div className="rh-root">
      <style>{`
        @keyframes rh-ping  { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes rh-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes rh-slide-in {
          from { transform: translateY(-8px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes rh-chevron-pulse {
          from { opacity: 0.15; }
          to   { opacity: 1;    }
        }
        @keyframes rh-badge-morph {
          0%   { transform: scaleX(1);    opacity: 1; }
          40%  { transform: scaleX(0.15); opacity: 0; }
          60%  { transform: scaleX(0.15); opacity: 0; }
          100% { transform: scaleX(1);    opacity: 1; }
        }
        .rh-root {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          color: #94a3b8;
          background: #090e16;
          border: 1px solid #1e293b;
          border-radius: 14px;
          padding: 20px 16px;
          max-width: 100%;
        }
        .rh-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          font-family: 'JetBrains Mono', monospace;
          transition: all 0.4s ease;
        }
        .rh-stage {
          display: flex;
          gap: 6px;
          align-items: stretch;
        }
        .rh-log-entry {
          animation: rh-slide-in 0.25s ease;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          background: #0d1520;
          border-left: 2px solid;
          margin-bottom: 4px;
        }
        @media (min-width: 780px) {
          .rh-grid {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 16px;
            align-items: start;
          }
        }
      `}</style>

      {/* status badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <span
          key={phase}
          className="rh-badge"
          style={{
            background: meta.color + "15",
            border: `1px solid ${meta.color}55`,
            color: meta.color,
            animation: "rh-badge-morph 0.5s ease",
          }}
        >
          <PulsingDot color={meta.color} size={6} />
          {meta.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AnimControls ctrl={ctrl} compact />
          <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em" }}>
            ÉTAPE {tickIdx + 1}/{TICKS.length}
          </span>
        </div>
      </div>

      <div className="rh-grid">
        <div>
          {/* Stage: 3 actors */}
          <div className="rh-stage">
            <ActorPanel
              label="navigateur"
              icon="🌐"
              detail="lycee.nebulahost.tech"
              dotColor="#3b82f6"
              active={browserActive}
            />
            <FlowArrows
              direction={browserToDns || browserToServer ? "right" : dnsToBrowser || serverToBrowser ? "left" : "right"}
              color={browserToDns || dnsToBrowser ? "#a855f7" : "#22c55e"}
              active={browserToDns || dnsToBrowser}
            />
            <ActorPanel
              label="DNS"
              icon="📖"
              detail="annuaire du web"
              dotColor="#a855f7"
              active={dnsActive}
            />
            <FlowArrows
              direction={browserToServer ? "right" : serverToBrowser ? "left" : "right"}
              color="#22c55e"
              active={browserToServer || serverToBrowser}
            />
            <ActorPanel
              label="serveur"
              icon="🖥️"
              detail="lycee-web container"
              dotColor="#22c55e"
              active={serverActive}
            />
          </div>

          {/* detail panel */}
          <div
            key={phase + "-detail"}
            style={{
              marginTop: 14,
              background: "#0d1520",
              border: `1px solid ${meta.color}33`,
              borderRadius: 10,
              padding: "12px 14px",
              animation: "rh-slide-in 0.35s ease",
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "#64748b",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              CE QUI SE PASSE
            </div>
            <div style={{ fontSize: 14, color: "#f1f5f9", marginBottom: 4 }}>{narr.title}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{narr.body}</div>
          </div>
        </div>

        <div>
          {/* event log */}
          <div
            style={{
              marginTop: 14,
              background: "#0d1520",
              border: "1px solid #1e293b",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "#64748b",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              LIVE LOG
            </div>
            <div style={{ maxHeight: 280, overflow: "hidden" }}>
              {logEntries.length === 0 ? (
                <div style={{ fontSize: 11, color: "#1e293b", padding: 4 }}>$ waiting...</div>
              ) : (
                logEntries.map((e) => (
                  <div
                    key={e.id}
                    className="rh-log-entry"
                    style={{ borderLeftColor: e.color, color: "#cbd5e1" }}
                  >
                    <span style={{ color: e.color }}>›</span> {e.text}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* tech tags */}
          <div
            style={{
              marginTop: 14,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {TECH_TAGS.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  color: "#334155",
                  border: "1px solid #1e293b",
                  borderRadius: 100,
                  padding: "3px 10px",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          fontSize: 10,
          color: "#475569",
          textAlign: "center",
          letterSpacing: "0.05em",
        }}
      >
        $ animation auto · lycee-app · {new Date().getFullYear()}
      </div>
    </div>
  );
}
