import type { Metadata, Viewport } from 'next'
import { Geist, JetBrains_Mono } from 'next/font/google'
import { SiteNav } from '@/components/site-nav'
import { SiteFooter } from '@/components/site-footer'
import { KonamiBadge } from '@/components/konami-badge'
import './globals.css'

// next/font downloads these at build time and self-hosts them in the export, so
// the served site makes no request to Google. Keep it that way.
const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: "Découvre l'informatique — STI2D SIN",
  description:
    "Site d'intervention STI2D SIN : cyber, IA, dev et métiers du numérique. Déclencher la curiosité, pas noter.",
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a0e0a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`dark ${geistSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          <SiteNav />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        <KonamiBadge />
      </body>
    </html>
  )
}
