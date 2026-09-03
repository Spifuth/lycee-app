#!/usr/bin/env node
/**
 * Fail the build if the static export loads anything from a third party.
 *
 * The site is RGPD-friendly by design and serves minors, so it must make zero
 * requests off its own origin. This has been a real problem twice with
 * generated bundles: the v0 export this app was ported from shipped
 * @vercel/analytics wired into the root layout, and an earlier handoff on
 * another project pulled React from unpkg at runtime.
 *
 * The check deliberately looks at *resource loads* rather than at any URL-ish
 * string. Framework bundles legitimately contain URLs inside error messages
 * (nextjs.org, react.dev), and a naive grep flags those and gets muted — a
 * check nobody trusts is worse than no check.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const OUT_DIR = new URL('../out', import.meta.url).pathname
const SCANNED_EXTENSIONS = new Set(['.html', '.js', '.css'])

/** Origins the site is allowed to reference in a loadable position. */
const ALLOWED_HOSTS = new Set(['lycee.nebulahost.tech'])

/**
 * Patterns that indicate the browser will actually fetch the URL.
 * Each captures the URL in group 1, and declares which file types it applies
 * to: `url(...)` is CSS syntax, and running it over minified JS matches the
 * URL-parsing fixtures inside the framework runtime instead of real loads.
 */
const LOAD_PATTERNS = [
  { what: '<script src>', on: ['.html'], re: /<script[^>]+src=["'](https?:\/\/[^"']+)["']/gi },
  { what: '<link href>', on: ['.html'], re: /<link[^>]+href=["'](https?:\/\/[^"']+)["']/gi },
  { what: '<img src>', on: ['.html'], re: /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi },
  { what: '<iframe src>', on: ['.html'], re: /<iframe[^>]+src=["'](https?:\/\/[^"']+)["']/gi },
  { what: 'css url()', on: ['.css'], re: /url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi },
  { what: 'fetch()', on: ['.js', '.html'], re: /fetch\(\s*["'`](https?:\/\/[^"'`]+)["'`]/gi },
  {
    what: 'new Worker()',
    on: ['.js', '.html'],
    re: /new\s+Worker\(\s*["'`](https?:\/\/[^"'`]+)["'`]/gi,
  },
  { what: 'import()', on: ['.js', '.html'], re: /import\(\s*["'`](https?:\/\/[^"'`]+)["'`]/gi },
]

/** Known trackers, flagged wherever they appear — even as a bare string. */
const TRACKER_MARKERS = [
  'vercel-insights.com',
  'vitals.vercel-analytics.com',
  '@vercel/analytics',
  'googletagmanager.com',
  'google-analytics.com',
  'connect.facebook.net',
  'hotjar.com',
  'segment.io',
]

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (SCANNED_EXTENSIONS.has(extname(entry.name))) yield full
  }
}

const findings = []

for await (const file of walk(OUT_DIR)) {
  const text = await readFile(file, 'utf8')
  const rel = file.slice(OUT_DIR.length + 1)
  const ext = extname(file)

  for (const { what, on, re } of LOAD_PATTERNS) {
    if (!on.includes(ext)) continue
    for (const [, url] of text.matchAll(re)) {
      let host
      try {
        host = new URL(url).host
      } catch {
        continue
      }
      if (!ALLOWED_HOSTS.has(host)) {
        findings.push(`${rel}: ${what} loads ${host}`)
      }
    }
  }

  for (const marker of TRACKER_MARKERS) {
    if (text.includes(marker)) findings.push(`${rel}: contains tracker marker "${marker}"`)
  }
}

if (findings.length > 0) {
  console.error('External origins found in the static export:\n')
  for (const f of [...new Set(findings)]) console.error(`  ✗ ${f}`)
  console.error('\nThe site must load nothing from a third party. Self-host it instead.')
  process.exit(1)
}

console.log('✓ no external origins in the static export')
