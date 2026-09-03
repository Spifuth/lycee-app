import type { Metadata } from 'next'
import { PageHeader } from '@/components/page-header'
import { MetierGrid } from '@/components/metier-grid'

export const metadata: Metadata = {
  title: 'Métiers',
  description:
    'Dix métiers de la tech : quotidien, outils, salaire, parcours et pour qui ça colle.',
}

export default function MetiersPage() {
  return (
    <>
      <PageHeader
        command="jobs"
        title="10 métiers de la tech"
        description="Recto : ce que c'est en une phrase. Verso (clic) : quotidien, outils, salaire, parcours, pour qui ça colle. Tous les chiffres salaires sont indicatifs (France, brut annuel, début 2026)."
      />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <MetierGrid />

        <div className="mt-12 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          <p className="font-mono text-xs text-muted-foreground"># note</p>
          <p className="mt-2">
            Cette liste est <strong className="text-foreground">très loin d'être exhaustive</strong>.
            Il manque : product manager tech, designer UX, journaliste tech, formateur·rice, chef de
            projet, consultant·e infosec, juriste cyber, communicant·e tech, etc. Le point commun :
            tu n'as pas besoin de tout savoir coder pour bosser dans la tech.
          </p>
        </div>
      </div>
    </>
  )
}
