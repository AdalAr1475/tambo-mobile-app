import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AgeGateHost } from '@/components/AgeGateHost';
import { ToastHost } from '@/components/ToastHost';
import { useCart } from '@/store/cart';
import { useDemo } from '@/store/demo';
import { useOrders } from '@/store/orders';
import { useRoutineRunner } from '@/lib/routines';
import { useRoutines } from '@/store/routines';
import { useSession } from '@/store/session';
import { useWallet } from '@/store/wallet';
import { colors, MAX_APP_WIDTH } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const persisted = [useCart, useSession, useOrders, useDemo, useWallet, useRoutines];
const allHydrated = () => persisted.every((s) => s.persist.hasHydrated());

const subscribeHydration = (cb: () => void) => {
  const unsubs = persisted.map((s) => s.persist.onFinishHydration(cb));
  return () => unsubs.forEach((u) => u());
};

const useHydrated = () => useSyncExternalStore(subscribeHydration, allHydrated, allHydrated);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const hydrated = useHydrated();
  const ready = (fontsLoaded || !!fontError) && hydrated;
  const loggedIn = useSession((s) => s.loggedIn);
  // Tambo Auto-Pilot: ejecuta las rutinas que tocan mientras la app está abierta.
  useRoutineRunner(ready && loggedIn);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.primary }} />;

  return (
    <View style={styles.outer}>
      <View style={styles.app}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Protected guard={loggedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="carrito"
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
            <Stack.Screen
              name="pedido/confirmado/[id]"
              options={{ animation: 'fade_from_bottom', gestureEnabled: false }}
            />
            <Stack.Screen
              name="visor/[id]"
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: false,
                contentStyle: { backgroundColor: colors.viewerBottom },
              }}
            />
            <Stack.Screen
              name="mapa"
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: colors.surfaceMid },
              }}
            />
            <Stack.Screen
              name="locker/[id]"
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: colors.primaryDark },
              }}
            />
            <Stack.Screen
              name="escanear/[id]"
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                contentStyle: { backgroundColor: colors.primaryDark },
              }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!loggedIn}>
            <Stack.Screen name="login" options={{ animation: 'fade' }} />
          </Stack.Protected>
        </Stack>
        <ToastHost />
        <AgeGateHost />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: Platform.OS === 'web' ? '#2A0A27' : colors.background },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? MAX_APP_WIDTH : undefined,
    alignSelf: 'center',
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
});
