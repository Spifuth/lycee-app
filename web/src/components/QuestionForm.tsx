import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";

const THEMES = [
  { id: "cyber",        label: "Cyber",         emoji: "🛡️" },
  { id: "dev",          label: "Dev / code",    emoji: "💻" },
  { id: "etudes",       label: "Études / orientation", emoji: "🎓" },
  { id: "vie-de-geek",  label: "Vie de geek",   emoji: "🎮" },
  { id: "autre",        label: "Autre",         emoji: "❓" },
];

export default function QuestionForm() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [theme, setTheme] = useState("cyber");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile/me", { credentials: "include" }).then((r) => setAuthed(r.ok));
  }, []);

  async function submit() {
    if (!content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, content: content.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.detail || res.statusText);
      }
      setSent(true);
      setContent("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (authed === false) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5 text-sm text-ink-300">
        <p>Pour poser une question, tu dois <a href="/login" className="text-accent-400 underline">te connecter</a> (anonyme côté lycéens, mais l'intervenant peut te répondre).</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            className={`rounded-lg border p-3 text-sm transition ${
              theme === t.id
                ? "border-accent-500 bg-accent-500/10 text-accent-400 shadow-glow"
                : "border-ink-800 bg-ink-900/40 text-ink-300 hover:border-ink-700"
            }`}
          >
            <span className="block text-xl">{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm text-ink-300 mb-1">Ta question</label>
        <textarea
          rows={5}
          maxLength={500}
          value={content}
          onChange={(e) => { setContent(e.target.value); setSent(false); }}
          placeholder="Écris ce que tu veux savoir. Sois précis·e — l'intervenant peut répondre en live."
          className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-sm"
        />
        <div className="mt-1 flex justify-between text-xs text-ink-500">
          <span>{content.length}/500</span>
          <span>👀 visible uniquement par l'intervenant (les autres lycéens voient la question, mais pas ton pseudo)</span>
        </div>
      </div>

      {error && <p className="text-sm text-terminal-rose">{error}</p>}

      {sent ? (
        <div className="rounded border border-terminal-green/40 bg-terminal-green/5 p-3 text-sm text-terminal-green">
          ✓ Envoyée ! L'intervenant la verra sur son téléphone et y répondra en live.
          <button
            type="button"
            onClick={() => setSent(false)}
            className="ml-3 text-xs text-ink-400 underline"
          >
            En poser une autre
          </button>
        </div>
      ) : (
        <button
          onClick={submit}
          disabled={busy || !content.trim()}
          className="rounded bg-accent-500 px-5 py-2.5 font-semibold text-ink-950 shadow-glow hover:bg-accent-400 disabled:opacity-40"
        >
          {busy ? "Envoi..." : "Envoyer ma question"}
        </button>
      )}

      <p className="font-mono text-xs text-ink-500">
        # tu débloques le badge 🤔 Curieux à la première question envoyée.
        Va voir <a href="/questions-live" className="text-accent-400 underline">/questions-live</a> pour voir le mur de questions anonymes.
      </p>
    </div>
  );
}
