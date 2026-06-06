import { useEffect, useState } from "react";
import { api, type StatsOut } from "../lib/api";

const REFRESH_MS = 30_000;

export default function LiveStats() {
  const [stats, setStats] = useState<StatsOut | null>(null);

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      api
        .stats()
        .then((s) => mounted && setStats(s))
        .catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (!stats) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-4 font-mono text-xs text-ink-500">
        $ loading session stats...
      </div>
    );
  }

  const cells: { label: string; value: number | string; accent?: boolean }[] = [
    { label: "comptes", value: stats.users_total },
    { label: "depuis 24h", value: stats.signups_24h },
    { label: "quiz finis", value: stats.quizzes_completed },
    { label: "anims vues", value: stats.animations_viewed },
    { label: "votes", value: stats.votes_cast },
    { label: "questions", value: stats.questions_asked },
    {
      label: "vote",
      value: stats.vote_open ? "ouvert" : "fermé",
      accent: stats.vote_open,
    },
  ];

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-4">
      <p className="mb-2 font-mono text-xs text-ink-500"># live · refresh 30s</p>
      <dl className="grid grid-cols-3 gap-3 sm:grid-cols-7">
        {cells.map((c) => (
          <div key={c.label} className="text-center">
            <dt className="text-xs uppercase tracking-wide text-ink-500">{c.label}</dt>
            <dd
              className={`mt-1 font-mono text-2xl font-bold ${
                c.accent ? "text-terminal-green" : "text-accent-400"
              }`}
            >
              {c.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
