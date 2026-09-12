import type { Box, Settings } from '../state/workbench';
import { keyName, planKeys, romanNumeral, type KeyRegion, type ScaleRef } from '../theory';
import { getBoxView, type BoxView } from './boardModel';

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
  readonly colorIndex: number;
}

export interface CanvasModel {
  readonly entries: readonly CanvasEntry[];
  readonly regions: readonly KeyRegion[];
}

/** Every box with its view, the key in effect at it, and its place in the key bar. */
export function buildCanvasModel(boxes: readonly Box[], settings: Settings, globalKey: ScaleRef): CanvasModel {
  const plan = planKeys(
    globalKey,
    boxes.map((box) => box.scale),
  );
  const entries = boxes.map((box, i): CanvasEntry => {
    const view = getBoxView(box, settings);
    const key = plan.keys[i];
    const region = plan.regions[plan.regionOfBox[i]];
    return {
      box,
      view,
      key,
      keyName: keyName(key),
      numeral: view.chord ? romanNumeral(view.chord, key) : '',
      regionStart: region.first === i,
      regionEnd: region.last === i,
      colorIndex: region.colorIndex,
    };
  });
  return { entries, regions: plan.regions };
}
