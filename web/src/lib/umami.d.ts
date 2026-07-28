// Ambient type for the Umami analytics tracker injected by the <script> tag in
// Layout.astro (see https://umami.is/docs/tracker-functions).
//
// Declared as a bare global identifier (not `Window.umami`) because every call
// site uses `typeof umami !== 'undefined'` — ad blockers frequently prevent
// script.js from loading, and an unguarded reference would throw a
// ReferenceError for exactly those visitors. `typeof` narrows the `undefined`
// branch away, so `umami.track(...)` type-checks with no `any` and no
// ts-ignore.
//
// `track` intentionally only types the single-argument form (event name, no
// payload) since this app never sends a second "data" argument — that keeps
// the no-PII-in-events rule enforced at the type level, not just by convention.
export {};

declare global {
  const umami: { track: (eventName: string) => void } | undefined;
}
