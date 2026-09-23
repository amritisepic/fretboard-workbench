import { create } from 'zustand';
import { readStored, storedFields, writeStored } from './localSettings';

/** The two tools in the top bar's switch. */
export type Screen = 'workbench' | 'scales';

/**
 * Which theme to draw. `system` follows the device's light or dark setting, and is what anyone who
 * has never chosen gets; `light` and `dark` override it on this device.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** Settings for this device rather than for a preset. */
export interface Preferences {
  readonly screen: Screen;
  /** Ask before removing a box (its x, or the Delete key). Preset and folder deletions always ask. */
  readonly deleteWarnings: boolean;
  /** The guided tour has been finished or skipped here, so it no longer starts by itself. */
  readonly tourSeen: boolean;
  readonly theme: ThemeChoice;
}

export interface PreferencesState extends Preferences {
  setScreen(screen: Screen): void;
  setDeleteWarnings(on: boolean): void;
  setTourSeen(seen: boolean): void;
  setTheme(theme: ThemeChoice): void;
}

/**
 * Where the preferences are stored. `index.html` reads the theme from here before the app has
 * loaded, so a change to the key or to the field's name has to be made there as well; a test holds
 * the two together.
 */
export const PREFERENCES_KEY = 'fretboard-workbench:preferences';

export const DEFAULT_PREFERENCES: Preferences = { screen: 'workbench', deleteWarnings: true, tourSeen: false, theme: 'system' };

/**
 * Stored preferences, with the default for anything missing or unreadable. Preferences stored before
 * there was a theme setting have no `theme`, and read as following the system, which is what the
 * app did before it had a dark theme to offer.
 */
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
    theme: stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : DEFAULT_PREFERENCES.theme,
  };
}

export const usePreferences = create<PreferencesState>()((set, get) => {
  const update = (patch: Partial<Preferences>) => {
    set(patch);
    const { screen, deleteWarnings, tourSeen, theme } = get();
    writeStored(PREFERENCES_KEY, { screen, deleteWarnings, tourSeen, theme });
  };
  return {
    ...parsePreferences(readStored(PREFERENCES_KEY)),
    setScreen: (screen) => update({ screen }),
    setDeleteWarnings: (deleteWarnings) => update({ deleteWarnings }),
    setTourSeen: (tourSeen) => update({ tourSeen }),
    setTheme: (theme) => update({ theme }),
  };
});
