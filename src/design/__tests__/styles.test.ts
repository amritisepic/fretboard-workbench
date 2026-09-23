import { describe, expect, it } from 'vitest';
import { SHEET_ORDER, css, sheet, sheetNames } from '../styles';

describe('the stylesheets', () => {
  it('reads every sheet in the folder, so none escapes the design tests', () => {
    expect([...sheetNames()].sort()).toEqual([...SHEET_ORDER].sort());
    for (const name of SHEET_ORDER) expect(sheet(name).length, name).toBeGreaterThan(0);
  });

  it('keeps the tokens in the sheet that loads first', () => {
    // Every other sheet is written against them, and the lazy ones arrive later still.
    expect(sheet('base')).toMatch(/--paper:/);
    for (const name of SHEET_ORDER.filter((n) => n !== 'base')) expect(sheet(name), name).not.toMatch(/^\s*--paper:/m);
  });

  it('is the whole of what the page draws with', () => {
    expect(css).toContain('.export-dialog');
    expect(css).toContain('.tour-card');
  });
});
