import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { HabitsProvider, useHabits } from '@/hooks/use-habits';
import { useHydrated } from '@/hooks/use-hydrated';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { onboarded, pendingCelebration, clearCelebration } = useHabits();
  const { session, ready } = useAuth();
  // Signing in is the first onboarding step, so the main screens need both. A signed-out user
  // who already onboarded only sees the sign-in step.
  const setUp = onboarded && session !== null;

  // Celebrations can come from anywhere (a log, an edit, a delete), so they're shown from here.
  useEffect(() => {
    if (!pendingCelebration) return;
    clearCelebration();
    router.push(
      pendingCelebration.kind === 'challenge'
        ? { pathname: '/celebrate', params: { kind: 'challenge', length: pendingCelebration.length } }
        : { pathname: '/celebrate', params: { kind: 'perfect' } }
    );
  }, [pendingCelebration, clearCelebration]);

  // Habits live in device storage, which the web server render can't see. Render nothing until
  // hydrated so the first client render matches the server HTML. The saved session loads
  // asynchronously, so wait for that too rather than flashing the sign-in step.
  const hydrated = useHydrated();
  if (!hydrated || !ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={setUp} redirectTo="/onboarding">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="habit-editor" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="celebrate"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!setUp}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <HabitsProvider>
          <AnimatedSplashOverlay />
          <RootStack />
        </HabitsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
