import { describe, expect, it } from 'vitest';
import { keyName, parseChordSymbol, pcOfSpelled } from '../../theory';
import { boxChord } from '../boxChords';
import { EXAMPLE_FOLDERS, buildExample, exampleChordSymbols, parseExampleKey } from '../examples';
import { parsePresetData } from '../presetFormat';

const folder = (name: string) => {
  const found = EXAMPLE_FOLDERS.find((f) => f.name === name);
  if (!found) throw new Error(name);
  return found;
};

describe('example progressions', () => {
  it('covers pop, rock and jazz, with 20 to 30 jazz standards', () => {
    expect(EXAMPLE_FOLDERS.map((f) => f.name)).toEqual(['Pop progressions', 'Rock progressions', 'Jazz progressions', 'Jazz standards']);
    const standards = folder('Jazz standards').examples.length;
    expect(standards).toBeGreaterThanOrEqual(20);
    expect(standards).toBeLessThanOrEqual(30);
    for (const f of EXAMPLE_FOLDERS) {
      expect(new Set(f.examples.map((e) => e.name)).size).toBe(f.examples.length);
    }
  });

  it('reads example keys', () => {
    expect(keyName(parseExampleKey('A♭ major'))).toBe('A♭ major');
    expect(keyName(parseExampleKey('D Dorian'))).toBe('D Dorian');
    expect(() => parseExampleKey('C bebop')).toThrow('Unknown key');
  });

  it('builds every example into a valid preset whose boxes name the chords as written', () => {
    for (const f of EXAMPLE_FOLDERS) {
      for (const example of f.examples) {
        const data = buildExample(example, f);
        const symbols = exampleChordSymbols(example);
        expect(data.boxes, example.name).toHaveLength(symbols.length);
        data.boxes.forEach((box, i) => {
          const symbol = parseChordSymbol(symbols[i]);
          const { chord } = boxChord(box, data.settings);
          const label = `${example.name}: box ${i + 1} (${symbols[i]})`;
          expect(chord?.type.id, label).toBe(symbol.type.id);
          expect(chord?.root, label).toBe(pcOfSpelled(symbol.root));
          if (f.style === 'jazz') expect(box.positions.every((p) => p.fret > 0), label).toBe(true);
        });
        expect(parsePresetData(JSON.parse(JSON.stringify(data)))).toEqual(data);
      }
    }
  });
});
