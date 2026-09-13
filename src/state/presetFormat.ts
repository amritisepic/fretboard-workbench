/**
 * What a preset stores, and the versioned JSON format used for export and import. Everything read
 * from outside (files, IndexedDB) goes through the validators here. Structural problems are
 * rejected with a path to the bad value; numbers that are merely out of range are clamped or dropped.
 */

import { SCALE_FAMILIES } from '../data/scales';
import {
  MAX_CAPO,
  MAX_FRETS,
  MAX_STRINGS,
  MIN_STRINGS,
  clampFretCount,
  limitChordPositions,
  type ScaleRef,
} from '../theory';
import { newId } from './ids';
import type { Box, FillMode, LabelMode, Orientation, Settings, StripSettings } from './workbench';

export const FILE_FORMAT = 'fretboard-workbench';
export const FILE_VERSION = 1;

const MAX_NAME_LENGTH = 120;
const MAX_FOLDER_DEPTH = 32;
const LABEL_MODES: readonly LabelMode[] = ['names', 'degrees'];
const FILL_MODES: readonly FillMode[] = ['inversion', 'scale'];
const ORIENTATIONS: readonly Orientation[] = ['horizontal', 'vertical'];

/**
 * Everything a preset stores (spec §7). Its name is kept alongside. Fields added after version 1
 * (the capo and the orientation) are optional when reading, and fields since removed (the strips'
 * chords/scales choice) are ignored, so older files still load.
 */
export interface PresetData {
  readonly settings: Settings;
  readonly key: ScaleRef;
  readonly strips: StripSettings;
  readonly orientation: Orientation;
  readonly boxes: readonly Box[];
}

export interface ExportedPreset {
  readonly name: string;
  readonly data: PresetData;
}

export interface ExportedFolder {
  readonly name: string;
  readonly folders: readonly ExportedFolder[];
  readonly presets: readonly ExportedPreset[];
}

export type ExportFile =
  | { readonly kind: 'preset'; readonly preset: ExportedPreset }
  | { readonly kind: 'folder'; readonly folder: ExportedFolder };

export class PresetFormatError extends Error {
  constructor(path: string, problem: string) {
    super(`${path} ${problem}`);
    this.name = 'PresetFormatError';
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function fields(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PresetFormatError(path, 'must be an object');
  }
  return Object.fromEntries(Object.entries(value));
}

function list(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new PresetFormatError(path, 'must be a list');
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new PresetFormatError(path, 'must be text');
  return value;
}

function flag(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new PresetFormatError(path, 'must be true or false');
  return value;
}

function whole(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new PresetFormatError(path, `must be a whole number from ${min} to ${max}`);
  }
  return value;
}

function choice<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  const match = options.find((option) => option === value);
  if (match === undefined) {
    throw new PresetFormatError(path, `must be one of ${options.map((o) => `"${o}"`).join(', ')}`);
  }
  return match;
}

function itemName(value: unknown, path: string): string {
  const name = text(value, path).trim();
  if (!name) throw new PresetFormatError(path, 'must not be empty');
  return name.slice(0, MAX_NAME_LENGTH);
}

function parseScaleRef(value: unknown, path: string): ScaleRef {
  const ref = fields(value, path);
  const familyId = text(ref.familyId, `${path}.familyId`);
  const family = SCALE_FAMILIES.find((f) => f.id === familyId);
  if (!family) throw new PresetFormatError(`${path}.familyId`, `names an unknown scale family "${familyId}"`);
  const tonic = fields(ref.tonic, `${path}.tonic`);
  return {
    familyId,
    mode: whole(ref.mode, `${path}.mode`, 0, family.intervals.length - 1),
    tonic: {
      letter: whole(tonic.letter, `${path}.tonic.letter`, 0, 6),
      accidental: whole(tonic.accidental, `${path}.tonic.accidental`, -2, 2),
    },
  };
}

function parseSettings(value: unknown, path: string): Settings {
  const settings = fields(value, path);
  const strings = list(settings.tuning, `${path}.tuning`);
  if (strings.length < MIN_STRINGS || strings.length > MAX_STRINGS) {
    throw new PresetFormatError(`${path}.tuning`, `must have ${MIN_STRINGS}–${MAX_STRINGS} strings`);
  }
  const fretCount = settings.fretCount;
  if (typeof fretCount !== 'number' || !Number.isFinite(fretCount)) {
    throw new PresetFormatError(`${path}.fretCount`, 'must be a number');
  }
  return {
    tuning: strings.map((midi, i) => whole(midi, `${path}.tuning[${i}]`, 0, 127)),
    fretCount: clampFretCount(fretCount),
    capo: settings.capo === undefined ? 0 : whole(settings.capo, `${path}.capo`, 0, MAX_CAPO),
  };
}

function parseBox(value: unknown, path: string, settings: Settings): Box {
  const box = fields(value, path);
  const positions = limitChordPositions(
    list(box.positions, `${path}.positions`)
      .map((item, i) => {
        const position = fields(item, `${path}.positions[${i}]`);
        return {
          string: whole(position.string, `${path}.positions[${i}].string`, 0, MAX_STRINGS - 1),
          fret: whole(position.fret, `${path}.positions[${i}].fret`, 0, MAX_FRETS),
        };
      })
      .filter((p) => p.string < settings.tuning.length && p.fret >= settings.capo && p.fret <= settings.fretCount),
  );
  const color = text(box.color, `${path}.color`);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new PresetFormatError(`${path}.color`, 'must be a color like #C8372D');
  const fill = fields(box.fill, `${path}.fill`);
  const override = box.chordOverride;
  if (override !== null && typeof override !== 'string') {
    throw new PresetFormatError(`${path}.chordOverride`, 'must be text or null');
  }
  return {
    id: typeof box.id === 'string' && box.id ? box.id : newId(),
    positions,
    scale: parseScaleRef(box.scale, `${path}.scale`),
    labelMode: choice(box.labelMode, `${path}.labelMode`, LABEL_MODES),
    color: color.toUpperCase(),
    fill: { on: flag(fill.on, `${path}.fill.on`), mode: choice(fill.mode, `${path}.fill.mode`, FILL_MODES) },
    chordOverride: override,
  };
}

export function parsePresetData(value: unknown, path = 'preset'): PresetData {
  const data = fields(value, path);
  const settings = parseSettings(data.settings, `${path}.settings`);
  const strips = fields(data.strips, `${path}.strips`);
  return {
    settings,
    key: parseScaleRef(data.key, `${path}.key`),
    strips: {
      visible: flag(strips.visible, `${path}.strips.visible`),
      labelMode: choice(strips.labelMode, `${path}.strips.labelMode`, LABEL_MODES),
    },
    orientation:
      data.orientation === undefined ? 'horizontal' : choice(data.orientation, `${path}.orientation`, ORIENTATIONS),
    boxes: list(data.boxes, `${path}.boxes`).map((box, i) => parseBox(box, `${path}.boxes[${i}]`, settings)),
  };
}

function parseExportedPreset(value: unknown, path: string): ExportedPreset {
  const preset = fields(value, path);
  return { name: itemName(preset.name, `${path}.name`), data: parsePresetData(preset.data, `${path}.data`) };
}

function parseExportedFolder(value: unknown, path: string, depth: number): ExportedFolder {
  if (depth > MAX_FOLDER_DEPTH) throw new PresetFormatError(path, `nests more than ${MAX_FOLDER_DEPTH} folders deep`);
  const folder = fields(value, path);
  return {
    name: itemName(folder.name, `${path}.name`),
    folders: list(folder.folders, `${path}.folders`).map((child, i) =>
      parseExportedFolder(child, `${path}.folders[${i}]`, depth + 1),
    ),
    presets: list(folder.presets, `${path}.presets`).map((preset, i) =>
      parseExportedPreset(preset, `${path}.presets[${i}]`),
    ),
  };
}

/** Parses an exported .json file. Throws PresetFormatError describing the first problem found. */
export function parseExportFile(source: string): ExportFile {
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch {
    throw new PresetFormatError('The file', 'is not valid JSON');
  }
  const file = fields(json, 'The file');
  if (file.format !== FILE_FORMAT) throw new PresetFormatError('The file', 'is not a Fretboard Workbench export');
  const version = whole(file.version, 'file.version', 1, Number.MAX_SAFE_INTEGER);
  if (version > FILE_VERSION) {
    throw new PresetFormatError('The file', `uses format version ${version}, which is newer than this app (${FILE_VERSION})`);
  }
  const kind = choice(file.kind, 'file.kind', ['preset', 'folder']);
  return kind === 'preset'
    ? { kind: 'preset', preset: parseExportedPreset(file.preset, 'preset') }
    : { kind: 'folder', folder: parseExportedFolder(file.folder, 'folder', 0) };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export function presetDataOf(source: PresetData): PresetData {
  return {
    settings: source.settings,
    key: source.key,
    strips: source.strips,
    orientation: source.orientation,
    boxes: source.boxes,
  };
}

/** A canonical string for comparing a document with what was last saved. */
export function snapshotOf(name: string, data: PresetData): string {
  return JSON.stringify({ name, data });
}

/**
 * A snapshot written by an older version, rewritten as this version writes it, so a saved preset
 * doesn't read as edited just because the format gained or lost a field. Unreadable snapshots are
 * returned unchanged.
 */
export function upgradeSnapshot(snapshot: string): string {
  try {
    const saved = fields(JSON.parse(snapshot), 'snapshot');
    return snapshotOf(text(saved.name, 'snapshot.name'), parsePresetData(saved.data, 'snapshot.data'));
  } catch {
    return snapshot;
  }
}

export function withFreshBoxIds(data: PresetData): PresetData {
  return { ...data, boxes: data.boxes.map((box) => ({ ...box, id: newId() })) };
}

export function serializeExportFile(file: ExportFile): string {
  return `${JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, ...file }, null, 2)}\n`;
}
