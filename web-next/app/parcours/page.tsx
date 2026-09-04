import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { VOIES, VOIE_COLS } from '@/lib/parcours'

export const metadata: Metadata = {
  title: "Parcours d'études",
  description:
    "Huit voies pour faire de l'info ou de la cyber après le bac, comparées sans hiérarchie : durée, sélectivité, coût, alternance, débouchés.",
}

export default function ParcoursPage() {
  return (
    <>
      <PageHeader
        command="paths"
        title="Après le bac — les parcours"
        description={
          <>
            {VOIES.length} voies pour faire de l'info / cyber. Aucune n'est meilleure que l'autre —
            elles répondent à des questions différentes. Choisis celle qui colle à <em>ton</em>{' '}
            rythme et <em>ta</em> manière d'apprendre.
          </>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="space-y-4">
          {VOIES.map((v) => (
            <article
              key={v.nom}
              className="rounded-lg border border-border bg-card p-5"
              style={{ borderLeft: `4px solid ${v.color}` }}
            >
              <header className="mb-3 flex flex-wrap items-baseline gap-3">
                <span className="text-2xl" aria-hidden>
                  {v.emoji}
                </span>
                <h2 className="text-xl font-semibold text-foreground">{v.nom}</h2>
              </header>

              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {VOIE_COLS.map((c) => (
                  <div key={c.key}>
                    <dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {c.label}
                    </dt>
                    <dd className="text-foreground/90">{v[c.key]}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 rounded bg-background/60 p-3 text-sm italic text-muted-foreground">
                <span className="font-mono text-xs text-muted-foreground">→ pour qui : </span>
                {v.pourQui}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
            <p className="font-mono text-xs text-primary">CONSEIL #1 — VOIE PAS LINÉAIRE OK</p>
            <p className="mt-2 text-sm text-foreground/90">
              Tu peux faire un BTS, hésiter, rejoindre une école d'ingé par passerelle, partir en
              alternance, revenir en master. Personne dans ce métier ne suit la trajectoire «
              parfaite » du début à la fin.
            </p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
            <p className="font-mono text-xs text-primary">CONSEIL #2 — DIPLÔME ≠ COMPÉTENCE</p>
            <p className="mt-2 text-sm text-foreground/90">
              Le diplôme ouvre la porte du premier entretien. Le portfolio (projets persos, GitHub,
              écrits) la franchit. Commence à construire <em>quelque chose</em> dès maintenant, peu
              importe la voie choisie.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
