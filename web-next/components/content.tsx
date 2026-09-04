import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-10", className)}>{children}</div>
}

export function Section({
  id,
  index,
  title,
  children,
}: {
  id?: string
  index: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-sm text-accent">{index}</span>
        <h2 className="text-pretty text-xl font-semibold text-foreground md:text-2xl">{title}</h2>
      </div>
      <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  )
}

export function Callout({
  tone = "info",
  label,
  children,
}: {
  tone?: "info" | "warn" | "danger"
  label: string
  children: ReactNode
}) {
  const tones = {
    info: "border-accent/40 bg-accent/5 text-accent",
    warn: "border-amber-500/40 bg-amber-500/5 text-amber-400",
    danger: "border-destructive/40 bg-destructive/5 text-destructive",
  }
  return (
    <div className={cn("rounded-md border px-4 py-3", tones[tone])}>
      <p className="mb-1 font-mono text-xs uppercase tracking-wider">{label}</p>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </div>
  )
}

export function CodeBlock({ lines, caption }: { lines: string[]; caption?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
        {caption ? <span className="ml-2 font-mono text-xs text-muted-foreground">{caption}</span> : null}
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-foreground/90">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-4">
            <span className="select-none text-muted-foreground/50">{String(i + 1).padStart(2, "0")}</span>
            <span>{line || "\u00a0"}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}

export function KeyList({ items }: { items: { term: string; desc: string }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.term} className="rounded-md border border-border bg-card/50 p-4">
          <dt className="font-mono text-sm text-accent">{it.term}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{it.desc}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A grid of bordered cards.
 *
 * The Astro pages this migration ports lean heavily on "N cards side by side"
 * (métiers, familles cyber, arguments…), so the pattern is a primitive here
 * rather than repeated markup on every page.
 */
export function CardGrid({
  cols = 3,
  children,
  className,
}: {
  cols?: 2 | 3 | 4
  children: ReactNode
  className?: string
}) {
  const byCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }
  return <div className={cn('grid gap-4', byCols[cols], className)}>{children}</div>
}

export function Card({
  icon,
  eyebrow,
  title,
  children,
  tone,
}: {
  icon?: string
  eyebrow?: string
  title?: string
  children: ReactNode
  tone?: 'default' | 'primary' | 'destructive'
}) {
  const tones = {
    default: 'border-border bg-card',
    primary: 'border-primary/30 bg-primary/5',
    destructive: 'border-destructive/30 bg-destructive/5',
  }
  const eyebrowTones = {
    default: 'text-primary',
    primary: 'text-primary',
    destructive: 'text-destructive',
  }
  return (
    <div className={cn('rounded-lg border p-5', tones[tone ?? 'default'])}>
      {icon ? (
        <p className="text-2xl" aria-hidden>
          {icon}
        </p>
      ) : null}
      {eyebrow ? (
        <p className={cn('font-mono text-xs uppercase tracking-wider', eyebrowTones[tone ?? 'default'])}>
          {eyebrow}
        </p>
      ) : null}
      {title ? <p className="mt-2 text-lg font-semibold text-foreground">{title}</p> : null}
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  )
}

/** A terminal-style timeline: a mono timestamp followed by what happened. */
export function Timeline({ rows }: { rows: { at: string; text: ReactNode }[] }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-5 font-mono text-sm">
      {rows.map((r) => (
        <p key={r.at} className="text-foreground/90">
          <span className="text-muted-foreground">{r.at}</span> · {r.text}
        </p>
      ))}
    </div>
  )
}

/** Primary / secondary call-to-action row at the bottom of a content page. */
export function CtaRow({ children }: { children: ReactNode }) {
  return <div className="mt-12 flex flex-wrap gap-3">{children}</div>
}
