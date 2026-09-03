'use client'

import { useEffect, useState } from 'react'

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

/**
 * Konami-code easter egg, ported from the Astro layout.
 *
 * Lives in the shell rather than on a page, so it is reachable everywhere. The
 * badge grant needs a session, which does not exist until sub-project B; the
 * request is deliberately fire-and-forget so an anonymous visitor typing the
 * code gets silence rather than an error.
 */
export function KonamiBadge() {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    let buf: string[] = []

    function onKeyDown(e: KeyboardEvent) {
      buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key)
      if (buf.length > KONAMI.length) buf.shift()
      if (buf.length !== KONAMI.length || !buf.every((k, i) => k === KONAMI[i])) return

      buf = []
      fetch('/api/easter-egg/konami', { method: 'POST', credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (d.badges_granted?.length) setShown(true)
        })
        .catch(() => undefined)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(false), 5000)
    return () => clearTimeout(t)
  }, [shown])

  if (!shown) return null

  return (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-[9999] -translate-x-1/2 rounded-lg bg-primary px-6 py-3 font-mono text-sm font-bold text-primary-foreground shadow-lg"
    >
      🕹️ Old school gamer — badge débloqué !
    </div>
  )
}
