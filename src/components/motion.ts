/**
 * Whether the person using the app has asked their system to reduce motion.
 *
 * CSS answers this on its own through a media query, so only JavaScript-driven movement needs to
 * ask: today that is the smooth scroll to a chord the user has just added. Read at the moment of
 * the movement rather than cached, because the setting can change while the app is open, and
 * guarded for environments with no `matchMedia` (jsdom, and the export sheet's static render).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The scroll behavior to ask for: instant when motion is unwelcome, smooth otherwise. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
