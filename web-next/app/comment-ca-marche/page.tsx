import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { ANIMATION_INDEX } from '@/lib/animations'

export const metadata: Metadata = {
  title: 'Comment ça marche',
  description: 'Animations terminal — chaque concept en 1-2 minutes.',
}

export default function CommentCaMarchePage() {
  return (
    <>
      <PageHeader
        command="how"
        title="Comment ça marche"
        description="Animations terminal — chaque concept en 1-2 minutes."
      />

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {ANIMATION_INDEX.map((a) => (
            <Link
              key={a.slug}
              href={`/comment-ca-marche/${a.slug}`}
              className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <h2 className="text-lg font-semibold text-foreground">{a.titre}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{a.hook}</p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">/{a.slug}</p>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
