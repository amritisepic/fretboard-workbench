import { create } from 'zustand';
import { readStored, storedFields, writeStored } from './localSettings';

/** The two tools in the top bar's switch. */
export type Screen = 'workbench' | 'scales';

/** Settings for this device rather than for a preset. */
export interface Preferences {
  readonly screen: Screen;
  /** Ask before removing a box (its x, or the Delete key). Preset and folder deletions always ask. */
  readonly deleteWarnings: boolean;
  /** The guided tour has been finished or skipped here, so it no longer starts by itself. */
  readonly tourSeen: boolean;
}

export interface PreferencesState extends Preferences {
  setScreen(screen: Screen): void;
  setDeleteWarnings(on: boolean): void;
  setTourSeen(seen: boolean): void;
}

export const PREFERENCES_KEY = 'fretboard-workbench:preferences';

export const DEFAULT_PREFERENCES: Preferences = { screen: 'workbench', deleteWarnings: true, tourSeen: false };

/** Stored preferences, with the default for anything missing or unreadable. */
export function parsePreferences(value: unknown): Preferences {
  const stored = storedFields(value);
  const flag = (name: keyof Preferences, fallback: boolean) => {
    const value = stored[name];
    return typeof value === 'boolean' ? value : fallback;
  };
  return {
    screen: stored.screen === 'scales' ? 'scales' : 'workbench',
    deleteWarnings: flag('deleteWarnings', DEFAULT_PREFERENCES.deleteWarnings),
    tourSeen: flag('tourSeen', DEFAULT_PREFERENCES.tourSeen),
  };
}

export const usePreferences = create<PreferencesState>()((set, get) => {
  const update = (patch: Partial<Preferences>) => {
    set(patch);
    const { screen, deleteWarnings, tourSeen } = get();
    writeStored(PREFERENCES_KEY, { screen, deleteWarnings, tourSeen });
  };
  return {
    ...parsePreferences(readStored(PREFERENCES_KEY)),
    setScreen: (screen) => update({ screen }),
    setDeleteWarnings: (deleteWarnings) => update({ deleteWarnings }),
    setTourSeen: (tourSeen) => update({ tourSeen }),
  };
});
