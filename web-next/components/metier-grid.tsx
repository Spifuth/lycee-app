'use client'

import { useEffect, useState } from 'react'
import { METIERS } from '@/lib/metiers'

export function MetierGrid() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Block body scroll while the modal is open, and close on Escape.
  useEffect(() => {
    if (!selectedId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [selectedId])

  const selected = METIERS.find((m) => m.id === selectedId) ?? null

  return (
    <div>
      <p className="mb-6 font-mono text-xs text-muted-foreground">
        # clique sur une carte pour la voir en grand
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METIERS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id)}
            className="metier-card cursor-pointer rounded-lg p-5 text-left"
            style={{
              background: 'var(--card)',
              border: `1px solid ${m.color}55`,
              boxShadow: `inset 0 0 0 1px ${m.color}11`,
              minHeight: 180,
            }}
          >
            <div className="text-3xl" aria-hidden>
              {m.emoji}
            </div>
            <h2 className="mt-3 text-xl font-semibold text-foreground">{m.titre}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{m.hook}</p>
            <p className="mt-4 font-mono text-xs" style={{ color: m.color }}>
              voir en détail →
            </p>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="metier-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          style={{ background: 'rgba(9, 14, 22, 0.85)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelectedId(null)}
        >
          <article
            onClick={(e) => e.stopPropagation()}
            className="metier-modal relative w-full max-w-2xl overflow-hidden rounded-xl"
            style={{
              background: 'var(--card)',
              border: `1px solid ${selected.color}66`,
              boxShadow: `0 30px 80px -10px ${selected.color}33, 0 0 0 1px ${selected.color}22`,
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Fermer"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              style={{ background: 'color-mix(in oklab, var(--card) 70%, transparent)' }}
            >
              ✕
            </button>

            <header
              className="p-7 sm:p-9"
              style={{
                background: `linear-gradient(135deg, ${selected.color}22, transparent 70%)`,
                borderBottom: `1px solid ${selected.color}33`,
              }}
            >
              <div className="mb-3 text-6xl" aria-hidden>
                {selected.emoji}
              </div>
              <h2 className="text-3xl font-bold text-foreground sm:text-4xl">{selected.titre}</h2>
              <p className="mt-2 text-base sm:text-lg" style={{ color: selected.color }}>
                {selected.hook}
              </p>
            </header>

            <div className="space-y-5 p-7 sm:p-9">
              <div>
                <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  Au quotidien
                </p>
                <p className="text-base leading-relaxed text-foreground/90">{selected.quotidien}</p>
              </div>

              <div>
                <p className="mb-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  Outils typiques
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.outils.map((o) => (
                    <span
                      key={o}
                      className="rounded-full border px-3 py-1.5 font-mono text-xs text-foreground/90"
                      style={{
                        borderColor: `${selected.color}44`,
                        background: `${selected.color}11`,
                      }}
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    Salaire (FR, brut/an)
                  </p>
                  <p className="text-sm text-foreground/90">{selected.salaire}</p>
                </div>
                <div>
                  <p className="mb-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    Parcours typique
                  </p>
                  <p className="text-sm text-foreground/90">{selected.parcours}</p>
                </div>
              </div>

              <div
                className="rounded-lg p-4"
                style={{
                  background: `${selected.color}11`,
                  border: `1px solid ${selected.color}33`,
                }}
              >
                <p
                  className="mb-1 font-mono text-xs uppercase tracking-wide"
                  style={{ color: selected.color }}
                >
                  Pour qui c'est cool
                </p>
                <p className="text-base italic leading-relaxed text-foreground">
                  {selected.pourQui}
                </p>
              </div>

              <p className="pt-2 text-center font-mono text-xs text-muted-foreground">
                clique en dehors ou Echap pour fermer
              </p>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}
