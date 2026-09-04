import type { ReactNode } from 'react'

type PageHeaderProps = {
  command: string
  title: string
  description?: ReactNode
}

export function PageHeader({ command, title, description }: PageHeaderProps) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-primary">$</span> {command}
        </p>
        <h1 className="mt-3 text-balance font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>
    </header>
  )
}
