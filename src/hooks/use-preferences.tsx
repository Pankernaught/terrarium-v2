import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ColorSchemePref = 'system' | 'light' | 'dark';

interface Preferences {
  colorScheme: ColorSchemePref;
  setColorScheme: (v: ColorSchemePref) => void;
}

const PREF_COLOR_SCHEME = 'pref:colorScheme';

const PreferencesContext = createContext<Preferences>({
  colorScheme: 'system',
  setColorScheme: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorSchemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(PREF_COLOR_SCHEME).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setColorSchemeState(stored);
      }
    });
  }, []);

  const setColorScheme = useCallback((v: ColorSchemePref) => {
    setColorSchemeState(v);
    AsyncStorage.setItem(PREF_COLOR_SCHEME, v);
  }, []);

  return (
    <PreferencesContext.Provider value={{ colorScheme, setColorScheme }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): Preferences {
  return useContext(PreferencesContext);
}
