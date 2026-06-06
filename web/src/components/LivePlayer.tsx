import { useEffect, useRef, useState } from "react";

interface QuestionPublic {
  id: string;
  prompt: string;
  choices: string[];
  answer?: number;
  explanation?: string;
}

interface LeaderEntry {
  pseudo: string;
  avatar_seed: string;
  score: number;
  rank: number;
}

interface LiveState {
  state: "no_session" | "lobby" | "question" | "between" | "finished" | "aborted";
  session_id?: number;
  theme_id?: string;
  theme_label?: string;
  theme_emoji?: string;
  current_q_idx?: number;
  total_q?: number;
  duration_s?: number;
  seconds_left?: number;
  participants_count?: number;
  leaderboard?: LeaderEntry[];
  me?: { pseudo: string; score: number; rank: number | null } | null;
  joined?: boolean;
  question?: QuestionPublic;
  my_answer?: number | null;
  my_was_correct?: boolean;
  my_q_score?: number;
}

const CHOICE_STYLES = [
  { bg: "#ef4444", letter: "A", symbol: "▲" }, // red triangle
  { bg: "#3b82f6", letter: "B", symbol: "◆" }, // blue diamond
  { bg: "#f59e0b", letter: "C", symbol: "●" }, // amber circle
  { bg: "#22c55e", letter: "D", symbol: "■" }, // green square
];

export default function LivePlayer() {
  const [state, setState] = useState<LiveState | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{ score: number; is_correct: boolean } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const lastQId = useRef<string | null>(null);

  // Detect auth once
  useEffect(() => {
    fetch("/api/profile/me", { credentials: "include" }).then((r) => setAuthed(r.ok));
  }, []);

  // Open SSE state stream
  useEffect(() => {
    const es = new EventSource("/api/live/state", { withCredentials: true });
    sseRef.current = es;
    es.onmessage = (ev) => {
      try {
        const next = JSON.parse(ev.data) as LiveState;
        setState(next);
        if (next.state === "question" && next.question?.id !== lastQId.current) {
          // New question → reset local submit feedback
          lastQId.current = next.question?.id ?? null;
          setSubmitFeedback(null);
        }
        if (next.state !== "question") {
          lastQId.current = null;
        }
        if (typeof next.seconds_left === "number") {
          setSecondsLeft(next.seconds_left);
        }
      } catch (e) {
        console.warn("Bad SSE payload", e);
      }
    };
    es.onerror = () => {
      // Reconnect handled by browser; just note
    };
    return () => { es.close(); };
  }, []);

  // Local timer tick (visual only, server is source of truth)
  useEffect(() => {
    if (state?.state !== "question" || secondsLeft == null) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s == null ? null : Math.max(0, s - 0.1)));
    }, 100);
    return () => clearInterval(id);
  }, [state?.state, state?.question?.id]);

  async function doJoin() {
    if (!authed) {
      window.location.href = "/login";
      return;
    }
    try {
      const r = await fetch("/api/live/join", { method: "POST", credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${r.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submitAnswer(choice: number) {
    if (!authed || submitting) return;
    if (state?.my_answer !== null && state?.my_answer !== undefined) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/live/answer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setSubmitFeedback({ score: data.score, is_correct: data.is_correct });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!state) {
    return <p className="font-mono text-sm text-ink-500">Connexion au live…</p>;
  }

  if (state.state === "no_session") {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-8 text-center">
        <p className="text-4xl mb-3">⏳</p>
        <p className="font-display text-xl mb-2">Aucun quiz live pour le moment</p>
        <p className="text-sm text-ink-400">Reste sur cette page — quand l'intervenant lance un quiz, ça apparaîtra ici tout seul.</p>
      </div>
    );
  }

  if (state.state === "aborted") {
    return (
      <div className="rounded-lg border border-terminal-rose/40 bg-terminal-rose/5 p-8 text-center">
        <p className="text-4xl mb-3">⏹</p>
        <p className="font-display text-xl mb-2">Quiz interrompu</p>
        <p className="text-sm text-ink-400">L'intervenant a abandonné cette session. Une autre arrivera peut-être.</p>
      </div>
    );
  }

  // ====== LOBBY ======
  if (state.state === "lobby") {
    return (
      <div className="space-y-6">
        <header className="rounded-lg border border-accent-500/40 bg-accent-500/5 p-6 text-center">
          <p className="text-4xl mb-2">{state.theme_emoji}</p>
          <p className="font-display text-2xl font-bold">{state.theme_label}</p>
          <p className="font-mono text-xs text-ink-400 mt-2">{state.total_q} questions · {state.duration_s}s par Q</p>
        </header>

        {!authed ? (
          <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5 text-center">
            <p className="text-sm text-ink-300 mb-3">
              Pour rejoindre, il faut être connecté·e (juste un pseudo + une passphrase).
            </p>
            <a href="/login" className="inline-block rounded bg-accent-500 px-5 py-2 font-semibold text-ink-950 shadow-glow hover:bg-accent-400">
              Connexion
            </a>
          </div>
        ) : !state.joined ? (
          <div className="text-center">
            <button onClick={doJoin} className="rounded bg-accent-500 px-8 py-4 text-lg font-bold text-ink-950 shadow-glow hover:bg-accent-400">
              Rejoindre le quiz
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-terminal-green/40 bg-terminal-green/5 p-5 text-center">
            <p className="font-mono text-terminal-green">✓ Tu es dans la salle d'attente</p>
            <p className="text-sm text-ink-400 mt-1">{state.participants_count} joueur·euse·s connecté·e·s · en attente du lancement par l'intervenant…</p>
          </div>
        )}

        {state.leaderboard && state.leaderboard.length > 0 && (
          <PlayerList players={state.leaderboard} title="Joueurs présents" hideScore />
        )}
      </div>
    );
  }

  // ====== QUESTION ======
  if (state.state === "question" && state.question) {
    const q = state.question;
    const alreadyAnswered = state.my_answer != null;
    const timerPct = state.duration_s ? Math.max(0, Math.min(100, ((secondsLeft ?? 0) / state.duration_s) * 100)) : 0;
    const timeUp = secondsLeft != null && secondsLeft <= 0;

    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <p className="font-mono text-sm text-ink-400">
            {state.theme_emoji} {state.theme_label} · Question {(state.current_q_idx ?? 0) + 1}/{state.total_q}
          </p>
          {state.me && (
            <p className="font-mono text-xs">
              <span className="text-ink-400">Toi : </span>
              <span className="text-accent-400">{state.me.score} pts</span>
              {state.me.rank && <span className="text-ink-500"> · rang #{state.me.rank}</span>}
            </p>
          )}
        </header>

        <div className="h-3 rounded bg-ink-800 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${timerPct}%`,
              background: timerPct > 50 ? "#22c55e" : timerPct > 20 ? "#fbbf24" : "#ef4444",
              transition: "width 0.1s linear",
            }}
          />
        </div>
        <p className="text-right font-mono text-sm text-ink-400">{secondsLeft != null ? secondsLeft.toFixed(1) : "—"}s</p>

        <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-6">
          <p className="font-display text-xl sm:text-2xl font-semibold text-ink-100">{q.prompt}</p>
        </div>

        {!authed ? (
          <div className="rounded border border-terminal-amber/40 bg-terminal-amber/5 p-4 text-sm text-terminal-amber">
            <a href="/login" className="underline">Connecte-toi</a> pour répondre — tu peux observer en spectateur sinon.
          </div>
        ) : timeUp && !alreadyAnswered ? (
          <div className="rounded-lg border border-terminal-rose/50 bg-terminal-rose/10 p-8 text-center">
            <p className="text-5xl mb-3">⌛</p>
            <p className="font-display text-2xl font-bold text-terminal-rose">Trop tard pour répondre</p>
            <p className="mt-2 text-sm text-ink-300">Pas de panique — la révélation arrive, et la prochaine question sera la bonne.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {q.choices.map((c, i) => {
              const style = CHOICE_STYLES[i];
              const isMine = state.my_answer === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => submitAnswer(i)}
                  disabled={alreadyAnswered || submitting || timeUp}
                  className={`p-5 rounded-lg text-left text-ink-950 font-bold transition transform ${
                    alreadyAnswered && !isMine ? "opacity-30" : ""
                  } ${isMine ? "ring-4 ring-white scale-95" : ""} ${!alreadyAnswered && !timeUp ? "hover:scale-105 active:scale-95" : ""}`}
                  style={{ background: style.bg }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{style.symbol}</span>
                    <span className="flex-1">{c}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {alreadyAnswered && (
          <div className="rounded border border-ink-800 bg-ink-900/40 p-3 text-center">
            <p className="font-mono text-sm text-accent-400">
              ✓ Réponse envoyée. En attente de la révélation…
            </p>
            {submitFeedback && (
              <p className="font-mono text-xs text-ink-500 mt-1">
                (côté serveur : +{submitFeedback.score} pts si tu as bon — révélation imminente)
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-terminal-rose">{error}</p>}
      </div>
    );
  }

  // ====== BETWEEN (reveal) ======
  if (state.state === "between" && state.question) {
    const q = state.question;
    const myCorrect = !!state.my_was_correct;

    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <p className="font-mono text-sm text-ink-400">
            Q{(state.current_q_idx ?? 0) + 1}/{state.total_q} · {state.theme_emoji} {state.theme_label}
          </p>
          {state.me && (
            <p className="font-mono text-xs">
              <span className="text-accent-400">{state.me.score} pts</span>
              {state.me.rank && <span className="text-ink-500"> · rang #{state.me.rank}</span>}
            </p>
          )}
        </header>

        <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-6">
          <p className="font-display text-xl font-semibold text-ink-100">{q.prompt}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {q.choices.map((c, i) => {
            const style = CHOICE_STYLES[i];
            const isCorrect = q.answer === i;
            const isMine = state.my_answer === i;
            const dim = !isCorrect && !isMine;
            return (
              <div
                key={i}
                className={`p-4 rounded-lg text-ink-950 font-semibold relative ${dim ? "opacity-30" : ""} ${isMine ? "ring-2 ring-white" : ""}`}
                style={{ background: style.bg }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{style.symbol}</span>
                  <span className="flex-1">{c}</span>
                  {isCorrect && <span className="ml-auto text-xl">✓</span>}
                  {isMine && !isCorrect && <span className="ml-auto text-xl">✗</span>}
                </div>
              </div>
            );
          })}
        </div>

        {state.my_answer != null && (
          <div className={`rounded p-4 text-center ${myCorrect ? "bg-terminal-green/10 border border-terminal-green/40" : "bg-terminal-rose/10 border border-terminal-rose/40"}`}>
            {myCorrect ? (
              <>
                <p className="text-2xl mb-1">🎯 +{state.my_q_score ?? 0} points</p>
                <p className="text-sm text-ink-300">{q.explanation}</p>
              </>
            ) : (
              <>
                <p className="text-2xl mb-1 text-terminal-rose">✗ Pas cette fois</p>
                <p className="text-sm text-ink-300">{q.explanation}</p>
              </>
            )}
          </div>
        )}

        {state.my_answer == null && authed && (
          <div className="rounded border border-terminal-amber/40 bg-terminal-amber/5 p-3 text-sm text-terminal-amber text-center">
            Tu n'as pas répondu à temps. La prochaine sera la bonne !
          </div>
        )}

        <p className="font-mono text-xs text-ink-500 text-center">En attente de la question suivante…</p>

        {state.leaderboard && <PlayerList players={state.leaderboard} title="Classement actuel" />}
      </div>
    );
  }

  // ====== FINISHED ======
  if (state.state === "finished") {
    const top3 = state.leaderboard?.slice(0, 3) ?? [];
    return (
      <div className="space-y-6">
        <header className="text-center">
          <p className="text-5xl mb-3">🏆</p>
          <p className="font-display text-3xl font-bold">Quiz terminé !</p>
          <p className="font-mono text-sm text-ink-400 mt-2">{state.theme_emoji} {state.theme_label}</p>
        </header>

        {top3.length > 0 && (
          <div className="grid grid-cols-3 gap-3 items-end max-w-2xl mx-auto">
            {[1, 0, 2].map((idx) => {
              const p = top3[idx];
              if (!p) return <div key={idx} />;
              const heights = { 0: "h-44", 1: "h-32", 2: "h-24" } as const;
              const medals = { 0: "🥇", 1: "🥈", 2: "🥉" } as const;
              const colors = { 0: "border-amber-400/60 bg-amber-400/10", 1: "border-zinc-400/60 bg-zinc-400/10", 2: "border-orange-700/60 bg-orange-700/10" } as const;
              return (
                <div key={idx} className={`rounded-t-lg border ${colors[idx as 0|1|2]} ${heights[idx as 0|1|2]} flex flex-col items-center justify-end p-3`}>
                  <p className="text-3xl">{medals[idx as 0|1|2]}</p>
                  <p className="font-semibold text-ink-100 mt-1 truncate w-full text-center">{p.pseudo}</p>
                  <p className="font-mono text-accent-400">{p.score}</p>
                </div>
              );
            })}
          </div>
        )}

        {state.me && (
          <div className="rounded-lg border border-accent-500/40 bg-accent-500/5 p-4 text-center">
            <p className="font-mono text-sm text-ink-400">Ton résultat</p>
            <p className="font-display text-2xl text-accent-400 mt-1">
              {state.me.score} pts · rang #{state.me.rank}
            </p>
          </div>
        )}

        {state.leaderboard && state.leaderboard.length > 3 && (
          <PlayerList players={state.leaderboard.slice(3)} title={`Classement complet (${state.leaderboard.length})`} />
        )}
      </div>
    );
  }

  return <p className="font-mono text-sm text-ink-500">État inconnu : {state.state}</p>;
}

function PlayerList({ players, title, hideScore = false }: { players: LeaderEntry[]; title: string; hideScore?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-4">
      <p className="font-mono text-xs text-ink-500 mb-2 uppercase tracking-wide">{title}</p>
      <ul className="space-y-1">
        {players.map((p) => (
          <li key={p.pseudo} className="flex items-center justify-between text-sm py-1 border-b border-ink-800 last:border-b-0">
            <span className="font-mono text-ink-400 w-8">#{p.rank}</span>
            <span className="flex-1 text-ink-100">{p.pseudo}</span>
            {!hideScore && <span className="font-mono text-accent-400">{p.score}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
