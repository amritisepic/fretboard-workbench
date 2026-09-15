import { describe, expect, it } from 'vitest';
import { keyName, makeScaleRef } from '../../theory';
import { DEFAULT_PREFERENCES, parsePreferences } from '../preferences';
import { DEFAULT_SCALE_WIZARD, parseScaleWizard } from '../scaleWizard';

describe('device preferences', () => {
  it('reads stored preferences and keeps defaults for anything missing or malformed', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences({ screen: 'scales', deleteWarnings: false, tourSeen: true })).toEqual({
      screen: 'scales',
      deleteWarnings: false,
      tourSeen: true,
    });
    expect(parsePreferences({ screen: 'somewhere', deleteWarnings: 'no', tourSeen: 1 })).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences([1, 2])).toEqual(DEFAULT_PREFERENCES);
  });

  it('reads stored scale wizard settings, falling back per field', () => {
    expect(parseScaleWizard(undefined)).toEqual(DEFAULT_SCALE_WIZARD);
    const stored = parseScaleWizard({
      scale: makeScaleRef('harmonicMinor', 4, 'C'),
      showScale: false,
      labelMode: 'degrees',
      orientation: 'horizontal',
      notation: 'classical',
      topVoice: 13,
    });
    expect(keyName(stored.scale)).toBe('C Phrygian Dominant');
    expect(stored).toMatchObject({ showScale: false, labelMode: 'degrees', orientation: 'horizontal', notation: 'classical', topVoice: 13 });
    const broken = parseScaleWizard({ scale: { familyId: 'nope' }, topVoice: 8, orientation: 'diagonal' });
    expect(broken).toEqual(DEFAULT_SCALE_WIZARD);
  });
});
