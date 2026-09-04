import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AnimationSlot } from '@/components/animation-slot'
import { ANIMATIONS, getAnimation } from '@/lib/animations'

// Required by `output: 'export'` — the five slugs are known at build time.
export function generateStaticParams() {
  return ANIMATIONS.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const anim = getAnimation(slug)
  if (!anim) return {}
  return { title: anim.titre, description: anim.hook }
}

export default async function AnimationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const anim = getAnimation(slug)
  if (!anim) notFound()

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/comment-ca-marche"
        className="font-mono text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        ← retour
      </Link>
      <h1 className="mb-2 mt-2 font-mono text-3xl font-bold tracking-tight text-foreground">
        {anim.titre}
      </h1>

      <div className="mt-6">
        <AnimationSlot slug={slug} />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="font-mono text-xs text-muted-foreground"># pour aller plus loin</p>
        <ul className="mt-2 space-y-1">
          {anim.extras.map((line, i) => (
            <li key={i}>· {line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
