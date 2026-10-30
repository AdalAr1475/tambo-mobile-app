import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, space } from '@/theme/tokens';

function Block({ h, w = '100%', r = radius.md }: { h: number; w?: DimensionValue; r?: number }) {
  return <View style={{ height: h, width: w, borderRadius: r, backgroundColor: colors.surfaceHigh }} />;
}

/** Grilla de tarjetas "fantasma" mientras carga un listado. */
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.grid, style]} accessibilityLabel="Cargando productos">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Block h={130} r={radius.lg} />
          <Block h={14} />
          <Block h={14} w="60%" />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
            <Block h={22} w="45%" />
            <Block h={36} w={36} r={radius.lg} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.lg },
  card: {
    width: '47.5%',
    flexGrow: 1,
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
