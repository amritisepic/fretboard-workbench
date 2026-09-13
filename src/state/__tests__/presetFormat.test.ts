import { describe, expect, it } from 'vitest';
import { makeScaleRef } from '../../theory';
import {
  parseExportFile,
  parsePresetData,
  serializeExportFile,
  snapshotOf,
  upgradeSnapshot,
  withFreshBoxIds,
  type PresetData,
} from '../presetFormat';
import { createBox } from '../workbench';

const sample = (): PresetData => ({
  settings: { tuning: [35, 40, 45, 50, 55, 59, 64], fretCount: 22, capo: 1 },
  key: makeScaleRef('diatonic', 5, 'A'),
  strips: { visible: false, labelMode: 'degrees' },
  orientation: 'vertical',
  boxes: [
    {
      ...createBox(makeScaleRef('melodicMinor', 5, 'F♯')),
      positions: [
        { string: 1, fret: 3 },
        { string: 6, fret: 22 },
      ],
      color: '#2F5FB3',
      labelMode: 'degrees',
      fill: { on: true, mode: 'scale' },
      chordOverride: '6:m7b5:',
    },
    createBox(),
  ],
});

/** A plain JSON copy of the sample, edited by `change` before parsing. */
function parseEdited(change: (json: Record<string, unknown> & { boxes: Record<string, unknown>[]; settings: Record<string, unknown>; key: Record<string, unknown> }) => void) {
  const json = JSON.parse(JSON.stringify(sample()));
  change(json);
  return () => parsePresetData(json);
}

describe('preset data', () => {
  it('round-trips everything a preset stores through JSON', () => {
    const data = sample();
    expect(parsePresetData(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it('points at the bad value when a preset is malformed', () => {
    expect(parseEdited((json) => (json.boxes[0].color = 'red'))).toThrow('preset.boxes[0].color must be a color like #C8372D');
    expect(parseEdited((json) => (json.key.familyId = 'lydianChromatic'))).toThrow('names an unknown scale family');
    expect(parseEdited((json) => (json.settings.tuning = [40, 45, 50]))).toThrow('must have 4–9 strings');
    expect(parseEdited((json) => (json.boxes[1].labelMode = 'solfege'))).toThrow('preset.boxes[1].labelMode must be one of');
    expect(parseEdited((json) => delete json.strips)).toThrow('preset.strips must be an object');
    expect(parseEdited((json) => (json.settings.capo = 12))).toThrow('preset.settings.capo must be a whole number from 0 to 11');
    expect(parseEdited((json) => (json.orientation = 'diagonal'))).toThrow('preset.orientation must be one of');
  });

  it('clamps the fret count and drops notes that no longer fit the board', () => {
    const data = parseEdited((json) => (json.settings.fretCount = 12))();
    expect(data.settings.fretCount).toBe(12);
    expect(data.boxes[0].positions).toEqual([{ string: 1, fret: 3 }]);
    expect(parseEdited((json) => (json.settings.fretCount = 99))().settings.fretCount).toBe(30);
    const behindCapo = parseEdited((json) => (json.boxes[0].positions = [{ string: 1, fret: 0 }, { string: 2, fret: 3 }]))();
    expect(behindCapo.boxes[0].positions).toEqual([{ string: 2, fret: 3 }]);
  });

  it('reads presets saved before the capo, the neck orientation and the chord limits', () => {
    const data = parseEdited((json) => {
      delete json.settings.capo;
      delete json.orientation;
      (json.strips as Record<string, unknown>).compare = 'scales';
      json.boxes[1].positions = [
        { string: 0, fret: 3 },
        { string: 0, fret: 5 },
        ...[1, 2, 3, 4, 5, 6].map((string) => ({ string, fret: 2 })),
      ];
    })();
    expect(data.settings.capo).toBe(0);
    expect(data.orientation).toBe('horizontal');
    expect(data.strips).toEqual({ visible: false, labelMode: 'degrees' });
    expect(data.boxes[1].positions).toEqual([1, 2, 3, 4, 5, 6].map((string) => ({ string, fret: 2 })));
  });

  it('rewrites a snapshot saved by an older version in the current format', () => {
    const data = sample();
    const old = JSON.parse(snapshotOf('A', data));
    delete old.data.settings.capo;
    delete old.data.orientation;
    old.data.strips.compare = 'chords';
    const current: PresetData = { ...data, settings: { ...data.settings, capo: 0 }, orientation: 'horizontal' };
    expect(upgradeSnapshot(JSON.stringify(old))).toBe(snapshotOf('A', current));
    expect(upgradeSnapshot('not json')).toBe('not json');
  });

  it('gives imported boxes new ids and compares documents by name and content', () => {
    const data = sample();
    const fresh = withFreshBoxIds(data);
    expect(fresh.boxes.map((b) => b.id)).not.toEqual(data.boxes.map((b) => b.id));
    expect({ ...fresh.boxes[0], id: '' }).toEqual({ ...data.boxes[0], id: '' });
    expect(snapshotOf('A', data)).toBe(snapshotOf('A', parsePresetData(JSON.parse(JSON.stringify(data)))));
    expect(snapshotOf('A', data)).not.toBe(snapshotOf('B', data));
  });
});

describe('export files', () => {
  it('round-trips a preset and a nested folder', () => {
    const preset = { name: 'Minor ii–V', data: sample() };
    expect(parseExportFile(serializeExportFile({ kind: 'preset', preset }))).toEqual({ kind: 'preset', preset });
    const folder = { name: 'Jazz', folders: [{ name: 'Ballads', folders: [], presets: [preset] }], presets: [preset] };
    expect(parseExportFile(serializeExportFile({ kind: 'folder', folder }))).toEqual({ kind: 'folder', folder });
  });

  it('writes a versioned, readable file', () => {
    const text = serializeExportFile({ kind: 'preset', preset: { name: 'X', data: sample() } });
    expect(JSON.parse(text)).toMatchObject({ format: 'fretboard-workbench', version: 1, kind: 'preset' });
    expect(text).toContain('\n  "format"');
  });

  it('rejects files it cannot read, saying why', () => {
    expect(() => parseExportFile('not json')).toThrow('The file is not valid JSON');
    expect(() => parseExportFile('{"format":"other"}')).toThrow('is not a Fretboard Workbench export');
    expect(() => parseExportFile('{"format":"fretboard-workbench","version":9,"kind":"preset"}')).toThrow('newer than this app');
    expect(() => parseExportFile('{"format":"fretboard-workbench","version":1,"kind":"preset","preset":{"name":"  ","data":{}}}')).toThrow(
      'preset.name must not be empty',
    );
  });
});
