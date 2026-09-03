'use client'

import dynamic from 'next/dynamic'

/**
 * Loads one explainer animation by slug.
 *
 * Each animation is a few hundred lines of timers and inline-styled markup, so
 * they are code-split: a visitor on /comment-ca-marche/tls-handshake downloads
 * the TLS animation and none of the other four.
 */
const ANIMATION_COMPONENTS: Record<string, ReturnType<typeof dynamic>> = {
  'requete-http': dynamic(() => import('@/components/animations/RequeteHttpAnim')),
  'reverse-proxy': dynamic(() => import('@/components/animations/ReverseProxyAnim')),
  'docker-container': dynamic(() => import('@/components/animations/DockerContainerAnim')),
  'tls-handshake': dynamic(() => import('@/components/animations/TlsHandshakeAnim')),
  'xss-attaque': dynamic(() => import('@/components/animations/XssAttaqueAnim')),
}

export function AnimationSlot({ slug }: { slug: string }) {
  const Anim = ANIMATION_COMPONENTS[slug]
  if (!Anim) return null
  return <Anim />
}
