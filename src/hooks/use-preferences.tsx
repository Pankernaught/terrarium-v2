import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { Colors, type VibeId } from '@/constants/theme';
import type { Units } from '@/logic/units';

export type ColorSchemePref = 'system' | 'light' | 'dark';

// Conservatory is the flagship — it ships the character art, so new users land in
// it (ADR 0007 A10). Glasshouse is the opt-in "classic." Fully reversible.
const DEFAULT_VIBE: VibeId = 'conservatory';

interface Preferences {
  colorScheme: ColorSchemePref;
  setColorScheme: (v: ColorSchemePref) => void;
  vibe: VibeId;
  setVibe: (v: VibeId) => void;
  units: Units;
  setUnits: (v: Units) => void;
}

const PREF_COLOR_SCHEME = 'pref:colorScheme';
const PREF_VIBE = 'pref:vibe';
const PREF_UNITS = 'pref:units';

const isVibe = (v: string): v is VibeId => Object.prototype.hasOwnProperty.call(Colors, v);

const PreferencesContext = createContext<Preferences>({
  colorScheme: 'system',
  setColorScheme: () => {},
  vibe: DEFAULT_VIBE,
  setVibe: () => {},
  units: 'metric',
  setUnits: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorSchemePref>('system');
  const [vibe, setVibeState] = useState<VibeId>(DEFAULT_VIBE);
  const [units, setUnitsState] = useState<Units>('metric');

  useEffect(() => {
    AsyncStorage.getItem(PREF_COLOR_SCHEME).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setColorSchemeState(stored);
      }
    });
    AsyncStorage.getItem(PREF_VIBE).then((stored) => {
      if (stored && isVibe(stored)) setVibeState(stored);
    });
    AsyncStorage.getItem(PREF_UNITS).then((stored) => {
      if (stored === 'metric' || stored === 'imperial') setUnitsState(stored);
    });
  }, []);

  const setColorScheme = useCallback((v: ColorSchemePref) => {
    setColorSchemeState(v);
    AsyncStorage.setItem(PREF_COLOR_SCHEME, v);
  }, []);

  const setVibe = useCallback((v: VibeId) => {
    setVibeState(v);
    AsyncStorage.setItem(PREF_VIBE, v);
  }, []);

  const setUnits = useCallback((v: Units) => {
    setUnitsState(v);
    AsyncStorage.setItem(PREF_UNITS, v);
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ colorScheme, setColorScheme, vibe, setVibe, units, setUnits }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): Preferences {
  return useContext(PreferencesContext);
}
