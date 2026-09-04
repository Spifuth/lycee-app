import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: "Découvre l'informatique",
  description:
    "Site d'intervention STI2D SIN : cyber, IA, dev et métiers du numérique. Pas de mail, pas de tel — un pseudo et une passphrase de 4 mots.",
}

const sommaire = [
  { cmd: 'vote', desc: 'choisis les sujets de la session' },
  { cmd: 'cyber', desc: "c'est quoi vraiment" },
  { cmd: 'ia', desc: "démo live d'une IA chez moi" },
  { cmd: 'métiers', desc: '10 cartes flippables' },
  { cmd: 'animations', desc: 'comment ça marche' },
  { cmd: 'parcours', desc: 'après le bac' },
  { cmd: 'quiz', desc: '30 questions' },
  { cmd: 'questions', desc: 'anonyme' },
]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid gap-10 py-10 md:grid-cols-[1.2fr_1fr] md:py-16">
        <div className="space-y-6">
          <p className="font-mono text-sm text-primary">$ welcome --pseudo &lt;tu&gt;</p>
          <h1 className="text-balance text-4xl font-extrabold leading-tight md:text-5xl">
            Salut. <span className="text-primary">Bienvenue dans l'informatique.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Ce site est fait pour toi, lycéen·ne en STI2D SIN. Tu vas y trouver de quoi comprendre{' '}
            <span className="text-primary">l'info, la cyber, l'IA</span> — et surtout des pistes
            pour creuser ce qui t'intéresse.
          </p>
          <div className="flex flex-wrap gap-3">
            {/* "Crée ton compte" returns with the auth flow in sub-project B. */}
            <Link
              href="/accueil"
              className="rounded-md bg-primary px-5 py-2.5 font-mono text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Commence à visiter
            </Link>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Pas de mail, pas de tel. Juste un pseudo et une passphrase de 4 mots.
          </p>
        </div>

        <aside className="rounded-lg border border-border bg-card p-6 font-mono text-sm text-muted-foreground">
          <p className="text-muted-foreground"># ce que tu vas y trouver</p>
          <ul className="mt-2 space-y-1">
            {sommaire.map((s) => (
              <li key={s.cmd}>
                · <span className="text-primary">{s.cmd}</span> — {s.desc}
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  )
}
