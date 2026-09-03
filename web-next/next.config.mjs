/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the app ships as plain files served by nginx, exactly like
  // the Astro build it replaces. Keeps the container and the Traefik rule
  // unchanged. Viable because nothing here uses server actions, route handlers
  // or cookies()/headers().
  output: 'export',

  // Directory-style URLs (/cyber/index.html) so nginx serves them with the
  // existing `absolute_redirect off` config and no rewrite rules.
  trailingSlash: true,

  typescript: {
    // The v0 bundle shipped with this set to true. CI gates every PR here, so
    // suppressing type errors would just hide them from the gate.
    ignoreBuildErrors: false,
  },

  images: {
    // Required by `output: 'export'` — there is no server to optimise on.
    unoptimized: true,
  },
}

export default nextConfig
