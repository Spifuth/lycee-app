import { useEffect, useMemo, useState } from "react";

interface QuestionPublic {
  id: string;
  prompt: string;
  choices: string[];
}

interface ThemeDetail {
  id: string;
  label: string;
  emoji: string;
  questions: QuestionPublic[];
}

interface Correction {
  id: string;
  chosen: number | null;
  correct: number;
  explanation: string;
  is_correct: boolean;
}

interface SubmitOut {
  theme: string;
  score: number;
  total: number;
  corrections: Correction[];
  badges_granted: string[];
}

const LETTERS = ["A", "B", "C", "D"];

interface Props {
  themeId: string;
}

export default function QuizPlayer({ themeId }: Props) {
  const [theme, setTheme] = useState<ThemeDetail | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SubmitOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/quiz/${themeId}`, { credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/api/profile/me", { credentials: "include" }).then((r) => r.ok),
    ])
      .then(([t, isAuth]) => {
        setTheme(t);
        setAuthed(isAuth);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [themeId]);

  const allAnswered = useMemo(() => {
    if (!theme) return false;
    return theme.questions.every((q) => answers[q.id] !== undefined);
  }, [theme, answers]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/quiz/${themeId}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${r.status}`);
      }
      const out = (await r.json()) as SubmitOut;
      setResult(out);
      // smooth scroll to top so user sees the score
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    setResult(null);
    setAnswers({});
    setError(null);
  }

  if (error && !theme) return <p className="text-sm text-terminal-rose">{error}</p>;
  if (!theme) return <p className="font-mono text-sm text-ink-500">Chargement…</p>;

  if (authed === false) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5 text-sm text-ink-300">
        <p>Pour passer le quiz, tu dois <a href="/login" className="text-accent-400 underline">te connecter</a>. Ton score est lié à ton compte (et débloque des badges).</p>
      </div>
    );
  }

  if (result) {
    const perfect = result.score === result.total;
    const corrByQ: Record<string, Correction> = Object.fromEntries(result.corrections.map((c) => [c.id, c]));
    return (
      <div className="space-y-6">
        <div
          className={`rounded-lg border p-6 text-center ${
            perfect
              ? "border-terminal-green/50 bg-terminal-green/10"
              : result.score >= 3
              ? "border-accent-500/50 bg-accent-500/10"
              : "border-terminal-amber/40 bg-terminal-amber/5"
          }`}
        >
          <p className="font-mono text-xs text-ink-500">RÉSULTAT — {theme.emoji} {theme.label}</p>
          <p className={`mt-2 font-display text-5xl font-bold ${perfect ? "text-terminal-green" : "text-accent-400"}`}>
            {result.score}<span className="text-ink-500 text-3xl"> / {result.total}</span>
          </p>
          {perfect && <p className="mt-2 text-terminal-green font-mono">🎯 score parfait</p>}
          {result.badges_granted.length > 0 && (
            <p className="mt-3 font-mono text-sm text-accent-400">
              + badge{result.badges_granted.length > 1 ? "s" : ""} débloqué{result.badges_granted.length > 1 ? "s" : ""} : {result.badges_granted.join(", ")}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {theme.questions.map((q, i) => {
            const c = corrByQ[q.id];
            return (
              <div
                key={q.id}
                className={`rounded-lg border p-5 ${
                  c.is_correct
                    ? "border-terminal-green/40 bg-terminal-green/5"
                    : "border-terminal-rose/40 bg-terminal-rose/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`font-mono text-lg ${c.is_correct ? "text-terminal-green" : "text-terminal-rose"}`}>
                    {c.is_correct ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-ink-100">Q{i + 1}. {q.prompt}</p>
                    <ul className="mt-3 space-y-1 text-sm">
                      {q.choices.map((choice, ci) => {
                        const isCorrect = ci === c.correct;
                        const isChosen = ci === c.chosen;
                        return (
                          <li
                            key={ci}
                            className={`rounded px-3 py-1.5 font-mono ${
                              isCorrect
                                ? "bg-terminal-green/15 text-terminal-green"
                                : isChosen
                                ? "bg-terminal-rose/15 text-terminal-rose line-through"
                                : "text-ink-400"
                            }`}
                          >
                            {LETTERS[ci]}. {choice}
                            {isCorrect && <span className="ml-2 font-bold">← bonne réponse</span>}
                            {isChosen && !isCorrect && <span className="ml-2 italic text-xs">(ton choix)</span>}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 rounded bg-ink-950/60 p-3 text-sm text-ink-300">
                      <span className="font-mono text-xs text-ink-500">💡 </span>{c.explanation}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={retry}
            className="rounded bg-accent-500 px-5 py-2.5 font-semibold text-ink-950 shadow-glow hover:bg-accent-400"
          >
            Réessayer ce quiz
          </button>
          <a
            href="/quiz"
            className="rounded border border-ink-700 px-5 py-2.5 font-semibold text-ink-200 hover:border-accent-500 hover:text-accent-400"
          >
            Choisir un autre thème
          </a>
        </div>
      </div>
    );
  }

  // Quiz form
  const totalAnswered = Object.keys(answers).length;
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-4 sticky top-16 z-10 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-mono">
          <span className="text-ink-300">
            {theme.emoji} {theme.label}
          </span>
          <span className="text-ink-400">
            répondu : <span className="text-accent-400">{totalAnswered}</span> / {theme.questions.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded bg-ink-800 overflow-hidden">
          <div
            className="h-full bg-accent-500 transition-all duration-300"
            style={{ width: `${(totalAnswered / theme.questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {theme.questions.map((q, qi) => (
          <div key={q.id} className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
            <p className="font-semibold text-ink-100">
              <span className="text-ink-500 font-mono">Q{qi + 1}.</span> {q.prompt}
            </p>
            <ul className="mt-4 space-y-2">
              {q.choices.map((choice, ci) => {
                const selected = answers[q.id] === ci;
                return (
                  <li key={ci}>
                    <button
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: ci }))}
                      className={`w-full text-left rounded border px-4 py-2.5 transition ${
                        selected
                          ? "border-accent-500 bg-accent-500/10 text-accent-400 shadow-glow"
                          : "border-ink-800 bg-ink-950/40 text-ink-200 hover:border-ink-700"
                      }`}
                    >
                      <span className="font-mono mr-2">{LETTERS[ci]}.</span>
                      {choice}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-terminal-rose">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={submit}
          disabled={busy || !allAnswered}
          className="rounded bg-accent-500 px-6 py-3 font-semibold text-ink-950 shadow-glow hover:bg-accent-400 disabled:opacity-40"
        >
          {busy ? "Envoi…" : allAnswered ? "Soumettre mes réponses" : `Réponds aux ${theme.questions.length - totalAnswered} questions restantes`}
        </button>
        <a
          href="/quiz"
          className="rounded border border-ink-700 px-5 py-3 text-ink-300 hover:border-accent-500 hover:text-accent-400"
        >
          ← retour aux thèmes
        </a>
      </div>
    </div>
  );
}
