import Link from 'next/link'
import { liveFooterLinks as footerLinks } from '@/lib/nav'

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <p className="font-mono text-sm">
              <span className="text-primary">$</span> découvre.tech
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Intervention STI2D SIN. On déclenche la curiosité — cyber, IA, dev, métiers du
              numérique. Pas de note, pas de mail : pseudo + passphrase de 4 mots.
            </p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              self-hosted @ lycee.nebulahost.tech
            </p>
          </div>

          <nav aria-label="Plan du site">
            <ul className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>RGPD-friendly by construction · code source public</span>
          <span>{'// exit 0'}</span>
        </div>
      </div>
    </footer>
  )
}
