import 'react-native-gesture-handler';

import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';

/**
 * Root layout for the v2.0 skeleton.
 *
 * The four bottom-tab destinations are the ones locked in the migration plan
 * (§5.1 / decision 1): Terrariums · Browse · Care · Settings. Desktop is cut, so
 * there is no left rail. GestureHandlerRootView is established here now so the
 * Phase 6 drag-to-place interaction has its provider in place from the start.
 *
 * The premium native tab bar (human-drawn icons, §5.1 / Phase 9) replaces these
 * Ionicons placeholders later; this is intentionally the plain, stable classic
 * `Tabs` navigator for the skeleton.
 */
export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  const c = Colors[isDark ? 'dark' : 'light'];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: c.text,
            tabBarInactiveTintColor: c.textSecondary,
            tabBarStyle: { backgroundColor: c.background },
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
        </Tabs>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
