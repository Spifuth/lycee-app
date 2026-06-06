import { useEffect, useState } from "react";
import { api, ApiError, type ProfileOut } from "../lib/api";

export default function ProfileCard() {
  const [me, setMe] = useState<ProfileOut | null>(null);
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    api
      .me()
      .then((m) => {
        setMe(m);
        setBio(m.bio);
      })
      .catch((e: ApiError) => {
        if (e.status === 401) {
          window.location.href = "/login";
        } else {
          setError(e.message);
        }
      });
  }, []);

  async function saveBio() {
    setBusy(true);
    try {
      const updated = await api.patchMe({ bio });
      setMe(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function rerollAvatar() {
    setBusy(true);
    try {
      const seed = Math.random().toString(36).slice(2, 12);
      const updated = await api.patchMe({ avatar_seed: seed });
      setMe(updated);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (file.size > 4_194_304) {
      setError("Image trop lourde — max 4 Mo.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/profile/me/avatar", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${r.status}`);
      }
      const updated = await r.json();
      setMe(updated);
      setNotice("✓ PP envoyée ! Elle est en attente de validation par l'admin.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload échoué.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCustomAvatar() {
    if (!confirm("Retirer ta PP custom ? Tu reviendras à ton DiceBear.")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/profile/me/avatar", {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const updated = await r.json();
      setMe(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!confirm("Supprimer définitivement ton compte ? Cette action est irréversible.")) return;
    await api.deleteMe();
    window.location.href = "/";
  }

  if (!me) {
    return <p className="text-ink-400">{error ?? "Chargement…"}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        <img
          src={me.avatar_url}
          alt={me.pseudo}
          className="h-24 w-24 rounded-lg border border-ink-700 bg-ink-900 p-1"
        />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold">{me.pseudo}</h1>
          <p className="font-mono text-xs text-ink-500">
            inscrit le {new Date(me.created_at).toLocaleDateString("fr-FR")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={rerollAvatar}
              disabled={busy}
              className="rounded border border-ink-700 px-3 py-1 text-sm hover:border-accent-500 disabled:opacity-50"
            >
              ↻ Reroll avatar DiceBear
            </button>
            <label className="rounded border border-ink-700 px-3 py-1 text-sm hover:border-accent-500 cursor-pointer">
              📷 Uploader ma PP
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  e.target.value = "";
                }}
              />
            </label>
            {me.custom_avatar_status && (
              <button
                onClick={removeCustomAvatar}
                disabled={busy}
                className="rounded border border-terminal-rose/40 px-3 py-1 text-sm text-terminal-rose hover:bg-terminal-rose hover:text-ink-950 disabled:opacity-50"
              >
                🗑 Retirer ma PP
              </button>
            )}
          </div>
          {me.custom_avatar_status === "pending" && (
            <p className="mt-2 text-xs text-terminal-amber font-mono">
              ⏳ PP en attente de modération — l'admin la valide bientôt. En attendant, ton avatar DiceBear reste visible.
            </p>
          )}
          {me.custom_avatar_status === "approved" && (
            <p className="mt-2 text-xs text-terminal-green font-mono">
              ✓ PP custom approuvée et active.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
        <label className="block text-sm text-ink-300">Ta bio</label>
        <textarea
          rows={3}
          maxLength={200}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="mt-2 w-full rounded border border-ink-700 bg-ink-950 px-3 py-2"
        />
        <div className="mt-2 flex justify-between text-xs text-ink-500">
          <span>{bio.length}/200</span>
          <button
            onClick={saveBio}
            disabled={busy}
            className="rounded bg-accent-500 px-3 py-1 font-semibold text-ink-950 disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-5">
        <h2 className="font-display text-lg font-semibold">
          Badges{" "}
          <span className="font-mono text-sm font-normal text-ink-500">
            ({me.badges.filter((b) => b.unlocked).length}/{me.badges.length})
          </span>
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {me.badges.map((b) => (
            <li
              key={b.id}
              className={`flex items-start gap-3 rounded border p-3 ${
                b.unlocked
                  ? "border-accent-500/40 bg-accent-500/5"
                  : "border-ink-800 bg-ink-950/40 opacity-50"
              }`}
              title={b.description}
            >
              <span className={`text-2xl ${b.unlocked ? "" : "grayscale"}`}>{b.emoji}</span>
              <div className="flex-1">
                <p className={`font-semibold ${b.unlocked ? "text-ink-100" : "text-ink-500"}`}>
                  {b.label}
                </p>
                <p className="text-xs text-ink-500">{b.description}</p>
                {b.unlocked && b.unlocked_at && (
                  <p className="mt-1 font-mono text-[10px] text-accent-400">
                    obtenu le {new Date(b.unlocked_at).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {me.discord_invite_url && (
        <a
          href={me.discord_invite_url}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            // Track click to unlock the explorateur badge (fire-and-forget)
            fetch("/api/discord-click", { method: "POST", credentials: "include" }).catch(() => undefined);
          }}
          className="block rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/10 p-5 hover:border-[#5865F2] transition shadow-glow"
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#5865F2] flex items-center justify-center text-2xl">
              💬
            </div>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold text-ink-100">
                Rejoins le Discord de la session
              </h2>
              <p className="mt-1 text-sm text-ink-300">
                Pour échanger pendant et après l'intervention. Tu peux y reposer des questions, partager des trucs cool, demander des conseils.
              </p>
              <p className="mt-1 font-mono text-xs text-[#7289da]">{me.discord_invite_url} →</p>
            </div>
          </div>
        </a>
      )}

      <div className="rounded-lg border border-terminal-rose/40 bg-terminal-rose/5 p-5">
        <h2 className="font-display text-lg font-semibold text-terminal-rose">Zone dangereuse</h2>
        <p className="mt-1 text-sm text-ink-400">Supprime ton compte et toutes tes données.</p>
        <button
          onClick={deleteAccount}
          className="mt-3 rounded border border-terminal-rose px-3 py-1 text-sm text-terminal-rose hover:bg-terminal-rose hover:text-ink-950"
        >
          Supprimer mon compte
        </button>
      </div>

      {notice && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-terminal-green/40 bg-ink-900/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="font-mono text-sm text-terminal-green">{notice}</p>
        </div>
      )}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-terminal-rose/50 bg-ink-900/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="font-mono text-sm text-terminal-rose">{error}</p>
        </div>
      )}
    </div>
  );
}
