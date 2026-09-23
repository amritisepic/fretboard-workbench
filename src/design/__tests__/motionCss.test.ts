import { describe, expect, it } from 'vitest';
import css from '../../styles.css?inline';

/**
 * The stylesheet's answer to "reduce motion", asserted rather than trusted.
 *
 * Read through Vite's `?inline`, which is why `vite.config.ts` sets `test.css: true`; without it
 * Vitest hands back an empty string for any CSS import. The JavaScript half of the same preference
 * is `src/components/motion.ts`, tested beside it.
 */
describe('motion in the stylesheet', () => {
  it('states its duration once, as a token', () => {
    // The tokens' rule names the export's two roots as well as the page's; see the top of styles.css.
    expect(css).toMatch(/:root,\s*\.export-stage,\s*\.export-root\s*\{[^}]*--motion:\s*\d+m?s;/s);
  });

  it('spells every transition duration as that token, so one place turns them all off', () => {
    // A rule that hardcodes its own duration is a rule the reduced-motion block below cannot reach.
    const hardcoded = [...css.matchAll(/transition:[^;]+;/g)]
      .map((match) => match[0])
      .filter((rule) => /\d+(\.\d+)?m?s/.test(rule));
    expect(hardcoded).toEqual([]);
  });

  it('turns motion off for anyone who has asked their system for it', () => {
    const block = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css);
    expect(block, 'no prefers-reduced-motion block in the stylesheet').not.toBeNull();
    expect(block?.[1]).toMatch(/--motion:\s*0s;/);
  });

  it('carries no `!important`, which is how the override above stays honest', () => {
    // Zeroing a token beats shouting over the rules, and this file has never needed to shout.
    // Comments are taken out first: two of them say the word while explaining why it is not used,
    // and a rule that mentions a thing is not a rule that does it.
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('!important');
  });
});
