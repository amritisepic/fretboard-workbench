import { describe, expect, it } from 'vitest';
import { createBox, type Box, type Settings } from '../../state/workbench';
import { makeScaleRef, scaleRefPcSet } from '../../theory';
import { buildBoxView } from '../boardModel';
import { buildRankingView } from '../rankingModel';

const settings: Settings = { tuning: [40, 45, 50, 55, 59, 64], fretCount: 24, capo: 0, fretMarkers: true };

// A2, E3, A3, C4 with A lowest: Am.
const am: Box = {
  ...createBox(),
  fill: { on: true, mode: 'scale' },
  positions: [
    { string: 1, fret: 0 },
    { string: 2, fret: 2 },
    { string: 3, fret: 2 },
    { string: 4, fret: 1 },
  ],
};

const rank = (box: Box, previous?: number) => buildRankingView(box, buildBoxView(box, settings), previous);
const allRows = (box: Box) => rank(box)?.sections.flatMap((s) => s.rows) ?? [];

describe('ranking view', () => {
  it('ranks scales rooted on the chord root, grouped by tier', () => {
    const view = rank(am);
    expect(view?.chordName).toBe('Am');
    // Every row starts on the chord root, so a triad can only miss its 3rd (8) and 5th (1). Missing
    // both (9) exceeds the tier-1 limit of 8, so scales that share only the root land in tier 2.
    expect(view?.sections.map((s) => s.id)).toEqual(['tier0', 'tier1', 'tier2']);
    expect(allRows(am).every((row) => row.scale.name.startsWith('A '))).toBe(true);
    expect(view?.sections[0].rows.every((row) => row.missingNote === '')).toBe(true);
    const wholeTone = allRows(am).find((row) => row.scale.name === 'A Whole Tone');
    expect(wholeTone?.missingNote).toBe('no ♭3, 5');
    expect(wholeTone?.scale.tier).toBe(2);
    expect(allRows(am).find((row) => row.scale.name === 'A Phrygian Dominant')?.scale.tier).toBe(1);

    // A 7th raises the stakes: missing the 3rd and 7th (14) lands in tier 2.
    const am7: Box = { ...am, positions: [...am.positions, { string: 5, fret: 3 }] }; // + G4
    expect(rank(am7)?.chordName).toBe('Am7');
    expect(rank(am7)?.sections.map((s) => s.id)).toEqual(['tier0', 'tier1', 'tier2']);
  });

  it('draws one strip cell per degree and highlights chord tones', () => {
    const aeolian = allRows(am).find((row) => row.scale.name === 'A minor');
    expect(aeolian?.cells.map((c) => c.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(aeolian?.cells.filter((c) => c.chordTone).map((c) => c.label)).toEqual(['A', 'C', 'E']);

    const degrees = allRows({ ...am, labelMode: 'degrees' }).find((row) => row.scale.name === 'A minor');
    expect(degrees?.cells.map((c) => c.label)).toEqual(['1', '2', '♭3', '4', '5', '♭6', '♭7']);

    const octatonic = allRows(am).find((row) => row.scale.name === 'A Half-Whole Diminished');
    expect(octatonic?.cells).toHaveLength(8);
  });

  it('marks the row matching the reference scale by collection and tonic', () => {
    expect(allRows(am).some((row) => row.selected)).toBe(false); // C major: right notes, wrong tonic
    const selected = allRows({ ...am, scale: makeScaleRef('diatonic', 5, 'A') }).filter((row) => row.selected);
    expect(selected.map((row) => row.scale.name)).toEqual(['A minor']);
  });

  it('names the missing tones of tier-1 scales', () => {
    const tier1 = rank(am)?.sections.find((s) => s.id === 'tier1');
    expect(tier1?.rows.length).toBeGreaterThan(0);
    expect(tier1?.rows.every((row) => /^no /.test(row.missingNote))).toBe(true);
    expect(allRows(am).find((row) => row.scale.name === 'A Phrygian Dominant')?.missingNote).toBe('no ♭3');
  });

  it('ranks against the chord name picked in the sidebar', () => {
    const asC6 = rank({ ...am, positions: am.positions, chordOverride: '0:6:5' });
    expect(asC6?.chordName).toBe('C6/A (no 5)');
    expect(asC6?.sections[0].rows[0].scale.name.startsWith('C ')).toBe(true);
  });

  it('offers a distant section and says when a previous box is weighed in', () => {
    expect(rank(am)?.distant.length).toBeGreaterThan(0);
    expect(rank(am)?.comparedWithPrevious).toBe(false);
    expect(rank(am, scaleRefPcSet(makeScaleRef('diatonic', 0, 'F')))?.comparedWithPrevious).toBe(true);
  });

  it('pins the key-in-effect mode that contains the chord', () => {
    const inCMajor = buildRankingView(am, buildBoxView(am, settings), undefined, makeScaleRef('diatonic', 0, 'C'));
    expect(inCMajor?.sections[0].id).toBe('pinned');
    expect(inCMajor?.sections[0].rows.map((row) => row.scale.name)).toEqual(['A minor']);
  });

  it('has nothing to rank without a chord', () => {
    expect(rank({ ...am, positions: [{ string: 1, fret: 0 }] })).toBeNull();
    expect(rank({ ...am, positions: [] })).toBeNull();
  });
});
