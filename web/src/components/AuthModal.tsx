import { useEffect, useState } from "react";
import { api, ApiError, type SignupOut } from "../lib/api";

type Mode = "signup" | "login" | "passphrase-shown";

interface Props {
  initialMode?: Mode;
  forcedOpen?: boolean;
}

export default function AuthModal({ initialMode = "signup", forcedOpen = false }: Props) {
  const [open, setOpen] = useState(forcedOpen);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pseudo, setPseudo] = useState("");
  const [bio, setBio] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<SignupOut | null>(null);

  useEffect(() => {
    if (forcedOpen) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: Mode }>).detail;
      if (detail?.mode) setMode(detail.mode);
      setOpen(true);
    };
    window.addEventListener("open-auth", handler);
    return () => window.removeEventListener("open-auth", handler);
  }, [forcedOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (!token) return;
    setBusy(true);
    api
      .loginQR(token)
      .then(() => {
        url.searchParams.delete("token");
        window.history.replaceState({}, "", url.toString());
        window.location.href = "/profil";
      })
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);

  async function doSignup() {
    setError(null);
    if (!pseudo.match(/^[a-zA-Z0-9_-]{3,20}$/)) {
      setError("Pseudo : 3 à 20 caractères, lettres/chiffres/-/_ uniquement.");
      return;
    }
    setBusy(true);
    try {
      const out = await api.signup(pseudo, bio || undefined);
      setCredentials(out);
      setMode("passphrase-shown");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur inconnue.");
    } finally {
      setBusy(false);
    }
  }

  async function doLogin() {
    setError(null);
    setBusy(true);
    try {
      await api.login(pseudo, passphrase);
      window.location.href = "/profil";
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur inconnue.");
    } finally {
      setBusy(false);
    }
  }

  function downloadPassphrase() {
    if (!credentials) return;
    const blob = new Blob(
      [
        `Pseudo: ${credentials.pseudo}\nPassphrase: ${credentials.passphrase}\nLien de retour: ${credentials.qr_login_url}\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lycee-app-${credentials.pseudo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Don't show modal if no forcedOpen and not open
  if (!forcedOpen && !open) return null;

  const inner = (
    <>
      {mode === "passphrase-shown" && credentials ? (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-accent-400">Voici ta passphrase</h2>
          <p className="text-sm text-ink-300">
            C'est ta <strong>seule</strong> clé pour revenir. <span className="text-terminal-amber">Note-la, screenshot, ou télécharge.</span>
          </p>
          <div className="rounded border border-accent-500/40 bg-ink-950 p-4 font-mono text-lg text-accent-400">
            {credentials.passphrase}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(credentials.passphrase)}
              className="rounded border border-ink-700 px-3 py-1.5 text-sm hover:border-accent-500"
            >
              Copier
            </button>
            <button
              onClick={downloadPassphrase}
              className="rounded border border-ink-700 px-3 py-1.5 text-sm hover:border-accent-500"
            >
              Télécharger .txt
            </button>
          </div>
          <div className="mt-2 flex flex-col items-center gap-2">
            <img
              src={credentials.qr_data_url}
              alt="QR code de retour"
              className="h-40 w-40 rounded border border-ink-700 bg-white p-2"
            />
            <p className="font-mono text-xs text-ink-500">scan = retour facile depuis ton tel</p>
          </div>
          {credentials.discord_invite_url && (
            <a
              href={credentials.discord_invite_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                fetch("/api/discord-click", { method: "POST", credentials: "include" }).catch(() => undefined);
              }}
              className="block rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/10 p-3 hover:border-[#5865F2] transition"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#5865F2] flex items-center justify-center text-lg">💬</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-100">Rejoins notre Discord</p>
                  <p className="font-mono text-xs text-[#7289da] truncate">{credentials.discord_invite_url}</p>
                </div>
              </div>
            </a>
          )}
          <a
            href="/profil"
            className="block w-full rounded bg-accent-500 px-4 py-2 text-center font-semibold text-ink-950 hover:bg-accent-400"
          >
            Voir mon profil
          </a>
        </div>
      ) : mode === "signup" ? (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold">Crée ton compte</h2>
          <p className="text-sm text-ink-400">Pseudo unique. Pas d'email demandé.</p>
          <input
            type="text"
            placeholder="ton_pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2"
          />
          <textarea
            placeholder="Bio courte (optionnel, 200 chars max)"
            value={bio}
            maxLength={200}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2"
          />
          {error && <p className="text-sm text-terminal-rose">{error}</p>}
          <button
            onClick={doSignup}
            disabled={busy}
            className="w-full rounded bg-accent-500 px-4 py-2 font-semibold text-ink-950 hover:bg-accent-400 disabled:opacity-50"
          >
            {busy ? "..." : "Créer mon compte"}
          </button>
          <p className="text-center text-xs text-ink-500">
            Déjà inscrit ? <button onClick={() => setMode("login")} className="text-accent-400 underline">Connexion</button>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold">Connexion</h2>
          <input
            type="text"
            placeholder="ton_pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2"
          />
          <input
            type="text"
            placeholder="ta-passphrase-4-mots"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 font-mono"
          />
          {error && <p className="text-sm text-terminal-rose">{error}</p>}
          <button
            onClick={doLogin}
            disabled={busy}
            className="w-full rounded bg-accent-500 px-4 py-2 font-semibold text-ink-950 hover:bg-accent-400 disabled:opacity-50"
          >
            {busy ? "..." : "Se connecter"}
          </button>
          <p className="text-center text-xs text-ink-500">
            Pas encore inscrit ? <button onClick={() => setMode("signup")} className="text-accent-400 underline">Crée un compte</button>
          </p>
        </div>
      )}
    </>
  );

  if (forcedOpen) {
    return <div className="rounded-lg border border-ink-800 bg-ink-900/60 p-6">{inner}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4">
      <div className="w-full max-w-md rounded-lg border border-ink-800 bg-ink-900 p-6 shadow-glow">
        <button
          onClick={() => setOpen(false)}
          className="float-right text-ink-500 hover:text-ink-200"
          aria-label="fermer"
        >
          ✕
        </button>
        {inner}
      </div>
    </div>
  );
}
