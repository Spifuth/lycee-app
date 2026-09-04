'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, Terminal } from 'lucide-react'
import { liveNavLinks as navLinks } from '@/lib/nav'
import { cn } from '@/lib/utils'

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-mono text-sm font-semibold"
          onClick={() => setOpen(false)}
        >
          <Terminal className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-primary">$</span>
          <span className="text-foreground">découvre.tech</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {navLinks.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors',
                  active
                    ? 'bg-secondary text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Profil / Connexion land with auth in sub-project B. */}
          <button
            type="button"
            className="rounded-md border border-border p-1.5 text-muted-foreground lg:hidden"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="border-t border-border bg-background lg:hidden"
          aria-label="Navigation mobile"
        >
          <ul className="mx-auto max-w-6xl divide-y divide-border px-2 py-2">
            {navLinks.map((link) => {
              const active = pathname === link.href
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2.5 font-mono text-sm',
                      active ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    <span>{link.label}</span>
                    <span className="text-xs text-muted-foreground">{link.cmd}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </header>
  )
}
