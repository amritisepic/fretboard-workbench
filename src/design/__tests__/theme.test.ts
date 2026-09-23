import { describe, expect, it } from 'vitest';
import css from '../../styles.css?inline';
import { rootColorTokens } from '../contrast';
import { declarations, ruleBody, withoutComments } from '../stylesheet';

/**
 * How the stylesheet carries two themes. Every color is a `light-dark()` token on `:root`, so the dark
 * theme is `color-scheme: dark` switched on in two places — for the system setting and for the choice
 * made in Settings — and never where an export is laid out or drawn, since that is printed on white
 * paper. The browser suite checks the same in a real browser (e2e/theme.spec.ts).
 */

/** The page's root, and the two roots an export is laid out and drawn in, which stay light. */
const TOKENS = ':root, .export-stage, .export-root';
const SYSTEM_DARK = "@media (prefers-color-scheme: dark) / :root:not([data-theme='light'])";
const CHOSEN_DARK = ":root[data-theme='dark']";

describe('the dark theme', () => {
  it('starts from light, for anyone whose system does not ask for dark', () => {
    expect(declarations(css).filter((d) => d.selector === TOKENS && d.property === 'color-scheme')).toEqual([
      { selector: TOKENS, property: 'color-scheme', value: 'light' },
    ]);
  });

  it('is switched on identically by the system setting and by the choice in Settings', () => {
    // CSS has no way to write "this media query or that selector" as one block, so the block is
    // written twice; this is what keeps the two copies from drifting apart.
    const system = ruleBody(css, SYSTEM_DARK);
    const chosen = ruleBody(css, CHOSEN_DARK);
    expect(system, 'no dark block for the system setting').not.toBeNull();
    expect(chosen).toBe(system);
    expect(system).toContain('color-scheme: dark;');
  });

  it('draws each theme\'s select chevron in that theme\'s ink', () => {
    const stroke = (body: string | null) => /--select-arrow: url\(.*stroke='%23([0-9a-f]{6})'/i.exec(body ?? '')?.[1];
    const root = declarations(css)
      .filter((d) => d.selector === TOKENS && d.property === '--select-arrow')
      .map((d) => `--select-arrow: ${d.value}`)
      .join('');
    expect(`#${stroke(root)}`).toBe(rootColorTokens(css, 'light').ink);
    expect(`#${stroke(ruleBody(css, CHOSEN_DARK))}`).toBe(rootColorTokens(css, 'dark').ink);
  });

  it('leaves the export sheet light, whatever the screen is showing', () => {
    // The stage it is laid out in and the root it is drawn in declare every token again, light; the
    // dark blocks only ever reach the page's own root.
    const dark = declarations(css).filter((d) => d.selector === SYSTEM_DARK || d.selector === CHOSEN_DARK);
    expect(dark.every((d) => !d.selector.includes('export'))).toBe(true);
    // The body hands down its ink already resolved for the page's theme, so the sheet sets its own.
    expect(declarations(css).filter((d) => d.selector === '.export-sheet')).toContainEqual({
      selector: '.export-sheet',
      property: 'color',
      value: 'var(--ink)',
    });
  });

  it('writes every color as a token, so no rule can be left behind in one theme', () => {
    // The tokens and the two dark blocks are where colors are written; everywhere else refers to them.
    const tokenBlocks = new Set([TOKENS, SYSTEM_DARK, CHOSEN_DARK]);
    const literal = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|\b(white|black)\b/i;
    const hardcoded = declarations(css)
      .filter((d) => !tokenBlocks.has(d.selector) && literal.test(d.value))
      .map((d) => `${d.selector} { ${d.property}: ${d.value} }`);
    expect(hardcoded).toEqual([]);
  });

  it('reads the stylesheet the way the checks above need it to', () => {
    expect(withoutComments('a /* b { c: d; } */ { e: f; }')).toBe('a  { e: f; }');
    expect(rootColorTokens(':root { --a: light-dark(#111111, #eeeeee); --b: #222222; --c: 4px; }', 'dark')).toEqual({
      a: '#eeeeee',
      b: '#222222',
    });
  });
});
