import 'react-native-gesture-handler';

import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DbProvider } from '@/db/provider';
import { PreferencesProvider } from '@/hooks/use-preferences';
import { useTokens } from '@/hooks/use-tokens';

/**
 * Root layout — four bottom-tab destinations: Terrariums · Browse · Care ·
 * Settings. iOS + Android only (no left rail). GestureHandlerRootView wraps the
 * whole tree so the drag-to-place interaction in the planner has its provider in
 * place from the start. PreferencesProvider sits above RootLayoutInner so that
 * useTokens (which reads preferences) is available throughout.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PreferencesProvider>
        <RootLayoutInner />
      </PreferencesProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutInner() {
  const { c, isDark } = useTokens();

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <DbProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: c.primary,
            tabBarInactiveTintColor: c.textMuted,
            tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Terrariums',
              tabBarIcon: ({ color, size }) => <Ionicons name="leaf-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="browse"
            options={{
              title: 'Browse',
              tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="care"
            options={{
              title: 'Care',
              tabBarIcon: ({ color, size }) => <Ionicons name="water-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
            }}
          />
          {/* Non-tab routes: navigable, but hidden from the bar. */}
          <Tabs.Screen name="build/[id]" options={{ href: null }} />
          <Tabs.Screen name="plant/[slug]" options={{ href: null }} />
          {/* Planner is a focused full-screen flow — hide the tab bar entirely
              while it's open (its own Back/Next bar handles navigation). */}
          <Tabs.Screen name="planner" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        </Tabs>
      </DbProvider>
    </ThemeProvider>
  );
}
