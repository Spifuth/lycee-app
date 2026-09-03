import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { LiveStats } from '@/components/live-stats'
import { livePortes } from '@/lib/portes'

export const metadata: Metadata = {
  title: 'Accueil',
  description: "Le sommaire du site : choisis une porte, reviens quand tu veux.",
}

export default function AccueilPage() {
  return (
    <>
      <PageHeader
        command="cd ~"
        title="Où veux-tu aller ?"
        description="Clique sur une porte. Tu peux revenir à n'importe quel moment."
      />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8">
          <LiveStats />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {livePortes.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold transition-colors group-hover:text-primary">
                  {p.label}
                </h2>
                <span className="font-mono text-muted-foreground transition-colors group-hover:text-primary">
                  →
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
