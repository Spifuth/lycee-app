import { useEffect, useRef, useState } from "react";
import AiLockedAnim from "./animations/AiLockedAnim";

interface AiInfo {
  model: string;
  server: string;
  presets: string[];
  rate_limit_per_min: number;
  prompt_max_len: number;
  available: boolean;
  enabled: boolean;
}

const PRESET_META: Record<string, { label: string; emoji: string; placeholder: string }> = {
  resume:   { label: "Résume", emoji: "📝", placeholder: "Colle un texte à résumer..." },
  traduis:  { label: "Traduis (FR → EN)", emoji: "🌍", placeholder: "Colle une phrase ou un paragraphe en français..." },
  explique: { label: "Explique-moi", emoji: "🧒", placeholder: "Un concept que tu veux comprendre (ex: blockchain, photosynthèse, théorème de Pythagore...)" },
  poeme:    { label: "Poème", emoji: "🎭", placeholder: "Un thème ou une émotion..." },
};

interface Stats {
  tokens?: number;
  totalMs?: number;
  evalMs?: number;
}

export default function AiPanel() {
  const [info, setInfo] = useState<AiInfo | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/ai/info").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/profile/me", { credentials: "include" }).then((r) => r.ok),
    ]).then(([i, a]) => {
      setInfo(i);
      setAuthed(a);
    });
  }, []);

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  async function go() {
    if (!prompt.trim()) return;
    setOutput("");
    setError(null);
    setStats({});
    setRunning(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ prompt: prompt.trim(), preset }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("Pas de stream dans la réponse");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE frames are separated by \n\n
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          // each frame is "data: <json>"
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const ev = JSON.parse(json);
            if (ev.type === "token") {
              setOutput((prev) => prev + ev.text);
            } else if (ev.type === "done") {
              setStats({
                tokens: ev.eval_count,
                totalMs: ev.total_duration_ns ? Math.round(ev.total_duration_ns / 1_000_000) : undefined,
                evalMs:  ev.eval_duration_ns  ? Math.round(ev.eval_duration_ns  / 1_000_000) : undefined,
              });
            } else if (ev.type === "error") {
              setError(ev.detail);
            }
          } catch {}
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  if (!info) return <p className="font-mono text-sm text-ink-500">Chargement…</p>;
  if (!info.available) {
    return (
      <div className="rounded-lg border border-terminal-amber/40 bg-terminal-amber/5 p-5 text-sm">
        <p className="text-terminal-amber font-mono">⚠ module IA désactivé</p>
        <p className="mt-2 text-ink-300">Le proxy Ollama n'est pas configuré (LYCEE_OLLAMA_URL vide).</p>
      </div>
    );
  }
  if (!info.enabled) {
    // Verrouillé côté admin — on montre une animation pédago en attendant
    return <AiLockedAnim />;
  }
  if (authed === false) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5 text-sm text-ink-300">
        <p>Pour essayer l'IA, tu dois <a href="/login" className="text-accent-400 underline">te connecter</a> — c'est pour limiter l'abus (le serveur est petit, on peut pas laisser n'importe qui pinger l'IA).</p>
      </div>
    );
  }

  const tokensPerSec =
    stats.tokens && stats.evalMs && stats.evalMs > 0
      ? (stats.tokens / (stats.evalMs / 1000)).toFixed(1)
      : null;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-accent-500/30 bg-accent-500/5 p-4">
        <p className="font-mono text-xs text-accent-400">🤖 modèle : {info.model}</p>
        <p className="font-mono text-xs text-ink-400 mt-1">
          serveur : {info.server} · rate-limit {info.rate_limit_per_min}/min
        </p>
        <p className="mt-2 text-sm text-ink-300">
          Aucune de tes données ne part chez Google, OpenAI ou autre. Le modèle tourne juste à côté, sur le serveur où ce site est hébergé.
        </p>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs text-ink-500">CHOISIS UN MODE — OU TAPE EN MODE LIBRE</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {info.presets.map((p) => {
            const meta = PRESET_META[p];
            if (!meta) return null;
            const active = preset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(active ? null : p)}
                className={`rounded border p-3 text-sm transition ${
                  active
                    ? "border-accent-500 bg-accent-500/15 text-accent-400 shadow-glow"
                    : "border-ink-800 bg-ink-900/40 text-ink-200 hover:border-ink-700"
                }`}
              >
                <span className="block text-2xl">{meta.emoji}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <textarea
          rows={4}
          maxLength={info.prompt_max_len}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={preset && PRESET_META[preset] ? PRESET_META[preset].placeholder : "Écris ce que tu veux que l'IA fasse..."}
          className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-sm"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500">
          <span>{prompt.length}/{info.prompt_max_len}</span>
          <span>{preset ? `mode : ${preset}` : "mode libre"}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {running ? (
          <button onClick={stop} className="rounded border border-terminal-rose px-5 py-2 text-terminal-rose hover:bg-terminal-rose hover:text-ink-950">
            ⏹ Arrêter
          </button>
        ) : (
          <button
            onClick={go}
            disabled={!prompt.trim()}
            className="rounded bg-accent-500 px-5 py-2.5 font-semibold text-ink-950 shadow-glow hover:bg-accent-400 disabled:opacity-40"
          >
            ▶ Lancer
          </button>
        )}
        {output && !running && (
          <button onClick={() => { setOutput(""); setStats({}); setError(null); }} className="rounded border border-ink-700 px-4 py-2 text-sm text-ink-300 hover:border-accent-500">
            Effacer
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-terminal-rose/40 bg-terminal-rose/5 p-3 text-sm text-terminal-rose font-mono">
          ⚠ {error}
        </div>
      )}

      {(output || running) && (
        <div className="rounded-lg border border-ink-800 bg-ink-950 p-5">
          <p className="font-mono text-xs text-ink-500 mb-3">
            ▌ RÉPONSE {running && <span className="ml-2 inline-block w-2 h-3 bg-accent-400 animate-pulse" />}
          </p>
          <pre className="whitespace-pre-wrap font-mono text-sm text-ink-100 leading-relaxed">{output || "..."}</pre>
          {!running && stats.tokens && (
            <p className="mt-4 pt-3 border-t border-ink-800 font-mono text-xs text-ink-500">
              {stats.tokens} tokens · {tokensPerSec ? `${tokensPerSec} tok/s` : ""} {stats.totalMs ? ` · ${(stats.totalMs / 1000).toFixed(1)}s total` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
