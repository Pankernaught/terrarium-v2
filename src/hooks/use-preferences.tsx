import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { Colors, type VibeId } from '@/constants/theme';

export type ColorSchemePref = 'system' | 'light' | 'dark';

const DEFAULT_VIBE: VibeId = 'glasshouse';

interface Preferences {
  colorScheme: ColorSchemePref;
  setColorScheme: (v: ColorSchemePref) => void;
  vibe: VibeId;
  setVibe: (v: VibeId) => void;
}

const PREF_COLOR_SCHEME = 'pref:colorScheme';
const PREF_VIBE = 'pref:vibe';

const isVibe = (v: string): v is VibeId => Object.prototype.hasOwnProperty.call(Colors, v);

const PreferencesContext = createContext<Preferences>({
  colorScheme: 'system',
  setColorScheme: () => {},
  vibe: DEFAULT_VIBE,
  setVibe: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorSchemePref>('system');
  const [vibe, setVibeState] = useState<VibeId>(DEFAULT_VIBE);

  useEffect(() => {
    AsyncStorage.getItem(PREF_COLOR_SCHEME).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setColorSchemeState(stored);
      }
    });
    AsyncStorage.getItem(PREF_VIBE).then((stored) => {
      if (stored && isVibe(stored)) setVibeState(stored);
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

  return (
    <PreferencesContext.Provider value={{ colorScheme, setColorScheme, vibe, setVibe }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): Preferences {
  return useContext(PreferencesContext);
}
