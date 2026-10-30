import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUi } from '@/store/ui';
import { colors, elevation, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { Tap, Txt } from './ui';

/** Muestra el toast global. `bottomOffset` permite elevarlo sobre barras fijas. */
export function ToastHost({ bottomOffset = 156 }: { bottomOffset?: number }) {
  const toast = useUi((s) => s.toast);
  const hide = useUi((s) => s.hideToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => hide(toast.id), toast.action ? 4500 : 2600);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  const iconColor = toast.tone === 'error' ? '#FF8A80' : toast.tone === 'success' ? '#7BE0B5' : colors.gold;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.wrap]}>
      <Animated.View
        key={toast.id}
        entering={FadeInDown.duration(220)}
        exiting={FadeOutDown.duration(180)}
        style={[styles.toast, { marginBottom: insets.bottom + bottomOffset }]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Icon
          name={toast.icon ?? (toast.tone === 'error' ? 'alert-circle-outline' : 'check-circle-outline')}
          size={20}
          color={iconColor}
        />
        <Txt variant="labelMd" color={colors.white} style={{ flex: 1 }}>
          {toast.message}
        </Txt>
        {toast.action && (
          <Tap
            onPress={() => {
              toast.action?.onPress();
              hide(toast.id);
            }}
            hitSlop={10}
            accessibilityLabel={toast.action.label}
          >
            <Txt variant="labelMd" weight="bold" color={colors.gold}>
              {toast.action.label}
            </Txt>
          </Tap>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'flex-end', alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: '#2A1028',
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginHorizontal: space.lg,
    maxWidth: 480,
    alignSelf: 'stretch',
    ...elevation.float,
  },
});
