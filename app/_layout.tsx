import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';

import { AuthGate } from '@/components/auth/AuthGate';
import { useColorScheme } from '@/components/useColorScheme';
import { trackScreenView } from '@/lib/analytics';
import { QueryProvider } from '@/providers/QueryProvider';
import { SessionProvider } from '@/providers/SessionProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const lastTrackedScreen = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (lastTrackedScreen.current === pathname) return;
    lastTrackedScreen.current = pathname;
    trackScreenView(pathname);
  }, [pathname]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryProvider>
        <SessionProvider>
          <AuthGate>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen
                name="reset-password"
                options={{ title: 'Reset Password', presentation: 'modal' }}
              />
              <Stack.Screen
                name="auth/confirm"
                options={{ title: 'Email Confirmed', presentation: 'modal' }}
              />
              <Stack.Screen
                name="t/[date]/[difficulty]"
                options={{ title: 'Prompt Thread', headerBackTitle: 'Back' }}
              />
              <Stack.Screen
                name="library"
                options={{ title: 'Library', headerBackTitle: 'Back' }}
              />
              <Stack.Screen
                name="settings"
                options={{ title: 'Settings', headerBackTitle: 'Back' }}
              />
            </Stack>
          </AuthGate>
        </SessionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
