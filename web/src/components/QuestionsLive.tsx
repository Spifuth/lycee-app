import { useEffect, useState } from "react";

interface QuestionLive {
  id: number;
  theme: string;
  content: string;
  ts: string;
  answered: boolean;
  reactions: Record<string, number>;
  my_reactions: string[];
}

const REFRESH_MS = 8_000;

const THEME_META: Record<string, { emoji: string; color: string }> = {
  cyber:         { emoji: "🛡️", color: "#f87171" },
  dev:           { emoji: "💻", color: "#60a5fa" },
  etudes:        { emoji: "🎓", color: "#a855f7" },
  "vie-de-geek": { emoji: "🎮", color: "#22c55e" },
  autre:         { emoji: "❓", color: "#94a3b8" },
};

export default function QuestionsLive() {
  const [questions, setQuestions] = useState<QuestionLive[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [allowedEmojis, setAllowedEmojis] = useState<string[]>([]);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/profile/me", { credentials: "include" }).then((r) => setAuthed(r.ok));
    fetch("/api/questions/reactions/allowed").then((r) => r.json()).then((d) => setAllowedEmojis(d));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const r = await fetch("/api/questions/live?limit=100", { credentials: "include" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as QuestionLive[];
        if (!cancelled) {
          setQuestions(data);
          setLastFetch(new Date());
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  async function toggleReaction(questionId: number, emoji: string) {
    if (!authed) {
      if (confirm("Pour réagir, il faut être connecté. Aller sur /login ?")) {
        window.location.href = "/login";
      }
      return;
    }
    const key = `${questionId}:${emoji}`;
    if (pending.has(key)) return;
    setPending((p) => new Set(p).add(key));

    // Optimistic update
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== questionId) return q;
        const had = q.my_reactions.includes(emoji);
        const nextMine = had ? q.my_reactions.filter((e) => e !== emoji) : [...q.my_reactions, emoji];
        const cur = q.reactions[emoji] ?? 0;
        const nextCount = had ? Math.max(0, cur - 1) : cur + 1;
        const nextReactions = { ...q.reactions, [emoji]: nextCount };
        if (nextReactions[emoji] === 0) delete nextReactions[emoji];
        return { ...q, my_reactions: nextMine, reactions: nextReactions };
      }),
    );

    try {
      const r = await fetch(`/api/questions/${questionId}/react`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      // reconcile with server truth
      setQuestions((qs) =>
        qs.map((q) => (q.id === questionId ? { ...q, reactions: data.reactions, my_reactions: data.my_reactions } : q)),
      );
    } catch (e) {
      // rollback: trust next /live tick
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  const pendingQ = questions.filter((q) => !q.answered);
  const answered = questions.filter((q) => q.answered);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-sm">
          <span className="text-terminal-amber">{pendingQ.length} en attente</span> · <span className="text-terminal-green">{answered.length} répondues</span>
        </div>
        <div className="font-mono text-xs text-ink-500">
          {error ? <span className="text-terminal-rose">↻ {error}</span> : lastFetch ? <>↻ refresh auto · dernière maj {lastFetch.toLocaleTimeString("fr-FR")}</> : "chargement..."}
        </div>
      </div>

      {!authed && questions.length > 0 && (
        <div className="rounded border border-accent-500/30 bg-accent-500/5 p-3 text-sm text-ink-300">
          <a href="/login" className="text-accent-400 underline">Connecte-toi</a> pour réagir aux questions avec des emoji.
        </div>
      )}

      {questions.length === 0 ? (
        <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-8 text-center text-ink-500 font-mono text-sm">
          $ no questions yet — sois le ou la premier·e !
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {questions.map((q) => {
            const meta = THEME_META[q.theme] ?? { emoji: "❓", color: "#94a3b8" };
            return (
              <article
                key={q.id}
                className={`rounded-lg border p-4 transition flex flex-col ${
                  q.answered
                    ? "border-ink-800 bg-ink-900/20 opacity-70"
                    : "border-ink-800 bg-ink-900/50"
                }`}
                style={!q.answered ? { boxShadow: `inset 4px 0 0 ${meta.color}` } : {}}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-ink-400">
                    {meta.emoji} {q.theme} · #{q.id}
                  </span>
                  {q.answered && (
                    <span className="font-mono text-xs text-terminal-green">✓ répondue</span>
                  )}
                </div>
                <p className="text-sm text-ink-100 whitespace-pre-wrap break-words flex-1">{q.content}</p>

                {/* Reactions row */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {allowedEmojis.map((emoji) => {
                    const count = q.reactions[emoji] ?? 0;
                    const mine = q.my_reactions.includes(emoji);
                    const key = `${q.id}:${emoji}`;
                    const isPending = pending.has(key);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => toggleReaction(q.id, emoji)}
                        disabled={isPending}
                        title={mine ? "Retirer ta réaction" : "Réagir"}
                        className={`group flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                          mine
                            ? "border-accent-500/60 bg-accent-500/15 text-accent-400"
                            : "border-ink-800 bg-ink-950/40 text-ink-400 hover:border-ink-700"
                        } ${isPending ? "opacity-60" : ""}`}
                      >
                        <span className="text-base leading-none">{emoji}</span>
                        {count > 0 && <span className="font-mono">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="font-mono text-xs text-ink-500 text-center">
        # vue publique anonymisée · refresh {REFRESH_MS / 1000}s · pose ta question sur <a href="/questions" className="text-accent-400 underline">/questions</a>
      </p>
    </div>
  );
}
