/**
 * Accessibility checks for the component tests, on axe-core directly.
 *
 * The published `vitest-axe` wrapper is 0.1.0 and its types entry re-exports the matcher as a type
 * only, so it can't be used under this project's strict TypeScript. axe-core is the same engine
 * underneath and the wrapper adds nothing here.
 *
 * Two limits are worth knowing:
 *  - jsdom has no layout or canvas, so the `color-contrast` rule can't run. Contrast is checked
 *    instead against the stylesheet's own tokens in `src/design/__tests__/contrast.test.ts`.
 *  - components are rendered on their own, outside the app's landmarks, so the page-structure rules
 *    below would fire on every one of them and say nothing about the component.
 */

import axe from 'axe-core';

/** Rules about the whole page, which a component rendered on its own can't satisfy. */
const PAGE_RULES = [
  'region',
  'landmark-one-main',
  'page-has-heading-one',
  'html-has-lang',
  'document-title',
  'bypass',
  'color-contrast',
] as const;

const OPTIONS: axe.RunOptions = {
  rules: Object.fromEntries(PAGE_RULES.map((id) => [id, { enabled: false }])),
  resultTypes: ['violations'],
};

/** Every violation axe finds in `container`, worst first. */
export async function axeViolations(container: Element): Promise<axe.Result[]> {
  const results = await axe.run(container, OPTIONS);
  return [...results.violations].sort((a, b) => a.id.localeCompare(b.id));
}

/** The rule ids that fired, de-duplicated and sorted: the shape a baseline is written in. */
export async function axeRuleIds(container: Element): Promise<string[]> {
  const violations = await axeViolations(container);
  return [...new Set(violations.map((v) => v.id))].sort();
}

/** A readable list of what fired and on which element, for a failure message. */
export function describeViolations(violations: readonly axe.Result[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
    .join('\n');
}
