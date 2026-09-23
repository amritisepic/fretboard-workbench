import { keyPlanOf } from '../state/boxChords';
import type { Box, Settings } from '../state/workbench';
import {
  functionScale,
  keyName,
  romanNumeral,
  scaleRefName,
  type BoxAnalysis,
  type KeyRegion,
  type PatternSpan,
  type Relation,
  type ScaleRef,
} from '../theory';
import { getBoxView, type BoxView } from './boardModel';
import { regionSlots } from './color';

/** A key a box may be in, from one of its readings, with the scale that reading suggests. */
export interface KeyChoice {
  readonly keyName: string;
  /** Pinning this reading puts the box in this key. */
  readonly pinId: string;
  /** The reference scale the reading suggests (see functionScale), or null without a chord. */
  readonly scale: ScaleRef | null;
  readonly scaleName: string;
  /** The reading in use. */
  readonly chosen: boolean;
}

export interface CanvasEntry {
  readonly box: Box;
  readonly view: BoxView;
  /** The key in effect at this box. */
  readonly key: ScaleRef;
  readonly keyName: string;
  /** The chord's roman numeral in `key`, or "" without a chord. */
  readonly numeral: string;
  readonly regionStart: boolean;
  readonly regionEnd: boolean;
  /**
   * Which of KEY_REGION_COLORS the box's key bar wears. Not the key's own index from planKeys, which
   * runs past the palette once a progression has more than eight keys: see regionSlots.
   */
  readonly colorIndex: number;
  /** How harmonic analysis reads the box. */
  readonly analysis: BoxAnalysis;
  /** Relations with the box before; none for the first box. */
  readonly relationsIn: readonly Relation[];
  /**
   * The keys the box's readings put it in, the reading in use first, when there is more than one:
   * the key bar offers them as a choice. Empty otherwise.
   */
  readonly keyChoices: readonly KeyChoice[];
}

export interface CanvasModel {
  readonly entries: readonly CanvasEntry[];
  readonly regions: readonly KeyRegion[];
  readonly patterns: readonly PatternSpan[];
}

/** The key bar has room for the reading in use and the best one in another key; the sidebar lists the rest. */
const KEY_BAR_CHOICES = 2;

function keyChoicesFor(analysis: BoxAnalysis, view: BoxView, key: ScaleRef): KeyChoice[] {
  if (analysis.alternatives.length === 0) return [];
  const choices: KeyChoice[] = [];
  for (const reading of [analysis.reading, ...analysis.alternatives]) {
    const chosen = reading === analysis.reading;
    // The key in use is named as the key bar shows it, which the box's scale may have adjusted.
    const name = keyName(chosen ? key : reading.local.ref);
    if (choices.some((c) => c.keyName === name) || choices.length === KEY_BAR_CHOICES) continue;
    const scale = view.chord ? functionScale(view.chordPcs, view.chord, { ...analysis, reading }) : null;
    choices.push({
      keyName: name,
      pinId: reading.pinId,
      scale,
      scaleName: scale ? scaleRefName(scale) : '',
      chosen,
    });
  }
  return choices.length > 1 ? choices : [];
}

/** Every box with its view, the key in effect at it (see planKeys), its reading and its place in the key bar. */
export function buildCanvasModel(boxes: readonly Box[], settings: Settings, globalKey: ScaleRef): CanvasModel {
  const plan = keyPlanOf(globalKey, boxes, settings);
  const slots = regionSlots(plan.regions.map((region) => region.colorIndex));
  const entries = boxes.map((box, i): CanvasEntry => {
    const key = plan.keys[i];
    const view = getBoxView(box, settings, key);
    const region = plan.regions[plan.regionOfBox[i]];
    const analysis = plan.analysis.boxes[i];
    return {
      box,
      view,
      key,
      keyName: keyName(key),
      numeral: view.chord ? romanNumeral(view.chord, key) : '',
      regionStart: region.first === i,
      regionEnd: region.last === i,
      colorIndex: slots[plan.regionOfBox[i]],
      analysis,
      relationsIn: i > 0 ? plan.analysis.relations[i - 1] : [],
      keyChoices: keyChoicesFor(analysis, view, key),
    };
  });
  return { entries, regions: plan.regions, patterns: plan.analysis.patterns };
}
