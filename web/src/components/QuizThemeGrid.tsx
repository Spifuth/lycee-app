import { useEffect, useState } from "react";

interface ThemePublic {
  id: string;
  label: string;
  emoji: string;
  total: number;
  best_score: number | null;
  attempts: number;
}

export default function QuizThemeGrid() {
  const [themes, setThemes] = useState<ThemePublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/quiz/themes", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setThemes(data))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return <p className="text-sm text-terminal-rose">{error}</p>;
  if (!themes) return <p className="font-mono text-sm text-ink-500">Chargement…</p>;

  const completed = themes.filter((t) => t.best_score !== null).length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-4 font-mono text-sm">
        <span className="text-accent-400">{completed}</span>
        <span className="text-ink-400"> / {themes.length} thèmes complétés</span>
        {completed === themes.length && (
          <span className="ml-3 text-terminal-green">🧠 badge Encyclopédiste débloqué</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => {
          const perfect = t.best_score === t.total;
          return (
            <a
              key={t.id}
              href={`/quiz/${t.id}/`}
              className={`relative rounded-lg border p-5 transition hover:border-accent-500 ${
                perfect
                  ? "border-terminal-green/50 bg-terminal-green/5"
                  : t.best_score !== null
                  ? "border-accent-500/40 bg-accent-500/5"
                  : "border-ink-800 bg-ink-900/40"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{t.emoji}</span>
                <div className="flex-1">
                  <h2 className="font-display text-lg font-semibold text-ink-100">{t.label}</h2>
                  <p className="mt-1 font-mono text-xs text-ink-500">{t.total} questions</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                {t.best_score === null ? (
                  <span className="font-mono text-ink-400">Pas encore tenté</span>
                ) : (
                  <span className="font-mono">
                    <span className={perfect ? "text-terminal-green" : "text-accent-400"}>
                      meilleur : {t.best_score}/{t.total}
                    </span>{" "}
                    <span className="text-ink-500">· {t.attempts} essai{t.attempts > 1 ? "s" : ""}</span>
                  </span>
                )}
                <span className="font-mono text-ink-500">→</span>
              </div>
              {perfect && (
                <span className="absolute top-2 right-2 text-xs font-mono text-terminal-green">🎯 parfait</span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
