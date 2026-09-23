/**
 * Just enough of a CSS reader for the design tests to ask what the stylesheet declares, rule by rule,
 * without a browser: every declaration with the selector it sits under and any at-rule around it.
 *
 * Pure: no DOM, no imports. It understands this project's stylesheet, which has no nested rules
 * beyond at-rules, and no braces or semicolons inside strings; it is not a general CSS parser.
 */

export interface Declaration {
  /** The selector, with the at-rules it is nested in before it, joined by " / ". */
  readonly selector: string;
  readonly property: string;
  readonly value: string;
}

/** The stylesheet with its comments taken out. */
export const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every declaration in the stylesheet, in order. */
export function declarations(css: string): Declaration[] {
  const text = withoutComments(css);
  const found: Declaration[] = [];
  const open: string[] = [];
  let chunk = '';
  for (const char of text) {
    if (char === '{') {
      open.push(chunk.replace(/\s+/g, ' ').trim());
      chunk = '';
    } else if (char === '}') {
      for (const part of chunk.split(';')) {
        const colon = part.indexOf(':');
        if (colon < 0) continue;
        const property = part.slice(0, colon).trim();
        const value = part.slice(colon + 1).replace(/\s+/g, ' ').trim();
        if (property && value) found.push({ selector: open.join(' / '), property, value });
      }
      open.pop();
      chunk = '';
    } else {
      chunk += char;
    }
  }
  return found;
}

/** The body of the first rule whose selector (with its at-rules, as `declarations` joins them) is `selector`. */
export function ruleBody(css: string, selector: string): string | null {
  const rules = declarations(css).filter((d) => d.selector === selector);
  return rules.length === 0 ? null : rules.map((d) => `${d.property}: ${d.value};`).join('\n');
}
