import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../lib/api";
import VoteClosedAnim from "./animations/VoteClosedAnim";

interface Topic {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

interface VoteState {
  open: boolean;
  totals: Record<string, number>;
  my_votes: string[];
  total_voters: number;
}

const MAX_VOTES = 3;
const REFRESH_MS = 15_000;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json", ...(init.headers || {}) }, ...init });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {}
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export default function VotePanel() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [state, setState] = useState<VoteState | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Initial fetch + check auth
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Topic[]>("/api/vote/topics"),
      api<VoteState>("/api/vote/state"),
      fetch("/api/profile/me", { credentials: "include" }).then((r) => r.ok),
    ])
      .then(([ts, st, isAuth]) => {
        if (cancelled) return;
        setTopics(ts);
        setState(st);
        setSelection(new Set(st.my_votes));
        setAuthed(isAuth);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => { cancelled = true; };
  }, []);

  // Live refresh of state every 15s
  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => {
      api<VoteState>("/api/vote/state").then((s) => setState(s)).catch(() => undefined);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [state]);

  function toggle(topicId: string) {
    if (!state?.open || !authed) return;
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        if (next.size >= MAX_VOTES) return prev;
        next.add(topicId);
      }
      return next;
    });
  }

  async function submit() {
    if (selection.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<VoteState>("/api/vote", { method: "POST", body: JSON.stringify({ topic_ids: [...selection] }) });
      setState(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearVotes() {
    if (!confirm("Annuler tous tes votes ?")) return;
    setBusy(true);
    try {
      const updated = await api<VoteState>("/api/vote", { method: "DELETE" });
      setState(updated);
      setSelection(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const totalVotes = useMemo(() => {
    if (!state) return 0;
    return Object.values(state.totals).reduce((a, b) => a + b, 0);
  }, [state]);

  const maxCount = useMemo(() => {
    if (!state) return 1;
    return Math.max(1, ...Object.values(state.totals));
  }, [state]);

  if (!state) {
    return <p className="font-mono text-sm text-ink-500">{error ?? "Chargement..."}</p>;
  }

  const alreadyVoted = state.my_votes.length > 0;
  const selectionChanged = !setsEqual(selection, new Set(state.my_votes));
  const showClosedAnim = !state.open;

  return (
    <div className="space-y-6">
      {/* Si fermé : animation pédago + résultats finaux dessous (s'il y en a) */}
      {showClosedAnim && <VoteClosedAnim />}

      {/* Status banner (seulement si ouvert) */}
      {state.open && (
        <div className="rounded-lg border p-4 border-terminal-green/40 bg-terminal-green/5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-mono text-sm text-terminal-green">● VOTE OUVERT</p>
            <p className="font-mono text-xs text-ink-400">
              {state.total_voters} votant·e·s · {totalVotes} votes au total
            </p>
          </div>
          {!authed && (
            <p className="mt-2 text-sm text-ink-300">
              <a href="/login" className="text-accent-400 underline">Connecte-toi</a> pour voter (sinon tu peux quand même voir les résultats live).
            </p>
          )}
          {authed && (
            <p className="mt-2 text-sm text-ink-300">
              Choisis <strong>jusqu'à {MAX_VOTES} sujets</strong> · sélectionnés : <span className="font-mono text-accent-400">{selection.size}/{MAX_VOTES}</span>
              {alreadyVoted && <> · {selectionChanged ? <span className="text-terminal-amber">modifications non sauvegardées</span> : <span className="text-terminal-green">tes votes sont enregistrés</span>}</>}
            </p>
          )}
        </div>
      )}

      {/* Header résultats finaux quand fermé ET au moins 1 votant */}
      {!state.open && state.total_voters > 0 && (
        <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-4">
          <p className="font-mono text-xs text-ink-500 uppercase tracking-wider mb-1">📊 Résultats finaux</p>
          <p className="text-sm text-ink-300">{state.total_voters} votant·e·s · {totalVotes} votes au total</p>
        </div>
      )}

      {/* Cards — cachées si fermé sans aucun vote (sinon 15 cartes vides = bruit) */}
      {(state.open || state.total_voters > 0) && (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => {
          const count = state.totals[t.id] ?? 0;
          const selected = selection.has(t.id);
          const pct = state.open ? 0 : Math.round((count / Math.max(1, state.total_voters)) * 100);
          const barPct = Math.round((count / maxCount) * 100);
          const canClick = state.open && authed;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              disabled={!canClick}
              className={`text-left rounded-lg border p-4 transition relative overflow-hidden ${
                selected
                  ? "border-accent-500 bg-accent-500/10"
                  : "border-ink-800 bg-ink-900/40 hover:border-ink-700"
              } ${!canClick ? "cursor-default opacity-90" : "cursor-pointer"}`}
              style={selected ? { boxShadow: `0 0 0 1px ${t.color}66, 0 0 16px ${t.color}33` } : {}}
            >
              {/* live bar background */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{
                  width: `${barPct}%`,
                  background: `linear-gradient(90deg, ${t.color}18, ${t.color}08)`,
                  pointerEvents: "none",
                }}
              />
              <div className="relative flex items-start gap-3">
                <span className="text-2xl">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${selected ? "text-accent-400" : "text-ink-100"}`}>{t.label}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-mono text-ink-400">{count} vote{count > 1 ? "s" : ""}</span>
                    {!state.open && state.total_voters > 0 && (
                      <span className="font-mono text-ink-500">{pct}%</span>
                    )}
                    {selected && state.open && <span className="font-mono text-accent-400">✓ sélectionné</span>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      )}

      {/* Actions */}
      {state.open && authed && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={submit}
            disabled={busy || selection.size === 0 || !selectionChanged}
            className="rounded bg-accent-500 px-5 py-2.5 font-semibold text-ink-950 shadow-glow hover:bg-accent-400 disabled:opacity-40"
          >
            {alreadyVoted ? "Mettre à jour mes votes" : "Envoyer mes votes"}
          </button>
          {alreadyVoted && (
            <button
              onClick={clearVotes}
              disabled={busy}
              className="rounded border border-ink-700 px-4 py-2 text-sm text-ink-300 hover:border-terminal-rose hover:text-terminal-rose"
            >
              Annuler tous mes votes
            </button>
          )}
          {error && <p className="text-sm text-terminal-rose">{error}</p>}
        </div>
      )}

      <p className="font-mono text-xs text-ink-500"># refresh auto toutes les 15s</p>
    </div>
  );
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
