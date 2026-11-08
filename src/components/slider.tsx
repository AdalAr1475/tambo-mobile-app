import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { haptic } from '@/lib/feedback';
import { colors, elevation, radius } from '@/theme/tokens';

const THUMB = 28;

/**
 * Slider simple sin dependencias (responder system de RN). Funciona en Expo Go y web y es
 * accesible como control "adjustable" (lectores de pantalla pueden subir/bajar el valor).
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  accessibilityLabel,
  accessibilityText,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  accessibilityLabel: string;
  accessibilityText?: string;
}) {
  const [width, setWidth] = useState(0);
  const pct = (value - min) / (max - min);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const update = (x: number) => {
    if (!width) return;
    const raw = min + Math.min(1, Math.max(0, x / width)) * (max - min);
    const next = clamp(Math.round(raw / step) * step);
    if (next !== value) {
      haptic.tap();
      onChange(next);
    }
  };

  return (
    <View
      style={styles.hit}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => update(e.nativeEvent.locationX)}
      onResponderMove={(e) => update(e.nativeEvent.locationX)}
      onResponderTerminationRequest={() => false}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: accessibilityText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) =>
        onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))
      }
    >
      <View pointerEvents="none" style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: Math.max(0, pct * width - THUMB / 2) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: 44, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.primary,
    ...elevation.float,
  },
});
