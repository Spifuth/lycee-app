import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { RESSOURCES } from '@/lib/ressources'

export const metadata: Metadata = {
  title: 'Pour aller plus loin',
  description:
    "Plateformes d'entraînement, chaînes YouTube, podcasts, Linux, communautés et livres — gratuits ou pas chers, francophones autant que possible.",
}

export default function PourAllerPlusLoinPage() {
  return (
    <>
      <PageHeader
        command="more"
        title="Pour aller plus loin"
        description="Tout ce qui suit est gratuit ou pas cher, francophone autant que possible. Tu n'as pas besoin de tout suivre — pioche ce qui te parle, ignore le reste."
      />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-2">
          {RESSOURCES.map((s) => (
            <section key={s.titre} className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <span className="text-xl" aria-hidden>
                  {s.emoji}
                </span>{' '}
                {s.titre}
              </h2>
              {s.intro ? <p className="mt-1 text-xs text-muted-foreground">{s.intro}</p> : null}
              <ul className="mt-3 space-y-2 text-sm">
                {s.items.map((r) => (
                  <li key={r.label}>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {r.label}
                      </a>
                    ) : (
                      <span className="font-medium text-foreground">{r.label}</span>
                    )}
                    {r.desc ? <span className="text-muted-foreground"> — {r.desc}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-primary/30 bg-primary/5 p-6 text-sm text-foreground/90">
          <p className="text-lg font-semibold text-primary">Un dernier truc.</p>
          <p className="mt-2">
            La meilleure manière d'apprendre dans la tech, c'est de{' '}
            <strong>construire quelque chose</strong> : un petit script qui résout un problème perso,
            un bot Discord pour ton serveur, un site web idiot, un homelab dans ta chambre.
          </p>
          <p className="mt-2">
            Tu apprends 10× plus vite en bricolant qu'en regardant des tutos. Et tu te constitues un
            portfolio sans t'en rendre compte. Commence ce week-end. Vraiment.
          </p>
        </div>
      </div>
    </>
  )
}
