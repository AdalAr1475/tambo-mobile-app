import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';
import type { OrderStatus } from '@/lib/orderProgress';
import { time24 } from '@/lib/format';
import { colors, radius } from '@/theme/tokens';
import { Icon } from './Icon';
import { Txt } from './ui';

/* ——— Mapa estilizado con la ruta tienda → cliente ——— */

type Pt = [number, number];
const ROUTE: Pt[] = [
  [0.22, 0.3],
  [0.52, 0.3],
  [0.52, 0.58],
  [0.82, 0.58],
  [0.82, 0.78],
];

function pointAt(route: Pt[], t: number): Pt {
  const segs = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
  const total = segs.reduce((a, b) => a + b, 0);
  let d = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) {
      const f = segs[i] === 0 ? 0 : d / segs[i];
      return [
        route[i][0] + (route[i + 1][0] - route[i][0]) * f,
        route[i][1] + (route[i + 1][1] - route[i][1]) * f,
      ];
    }
    d -= segs[i];
  }
  return route[route.length - 1];
}

export function TrackingMap({
  progress,
  showRider,
  storeLabel,
  height = 260,
  riderLabel,
  pickup,
}: {
  progress: number;
  showRider: boolean;
  storeLabel: string;
  height?: number;
  riderLabel?: string;
  /** Retiro en tienda: solo se muestra la tienda, sin ruta ni destino. */
  pickup?: boolean;
}) {
  const [w, setW] = useState(0);
  const h = height;
  const px = ([x, y]: Pt): Pt => [x * w, y * h];
  const pts = (route: Pt[]) => route.map((p) => px(p).join(',')).join(' ');

  const pos = pointAt(ROUTE, progress);
  const x = useSharedValue(pos[0]);
  const y = useSharedValue(pos[1]);
  useEffect(() => {
    x.value = withTiming(pos[0], { duration: 950, easing: Easing.linear });
    y.value = withTiming(pos[1], { duration: 950, easing: Easing.linear });
  }, [pos[0], pos[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const riderStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: x.value * w - 24 }, { translateY: y.value * h - 24 }],
    }),
    [w, h],
  );

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value * 1.2 }],
  }));

  // Ruta recorrida = desde el inicio hasta la posición actual.
  const travelled: Pt[] = [];
  if (showRider) {
    for (let i = 0; i <= 40; i++) travelled.push(pointAt(ROUTE, (progress * i) / 40));
  }

  const store = px(ROUTE[0]);
  const home = px(ROUTE[ROUTE.length - 1]);

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <>
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            <Rect x={0} y={0} width={w} height={h} fill="#ECEAE8" />
            <Circle cx={w * 0.12} cy={h * 0.75} r={h * 0.22} fill="#D4EBD4" />
            <Circle cx={w * 0.95} cy={h * 0.25} r={h * 0.18} fill="#D4EBD4" />
            <Rect x={w * 0.6} y={h * 0.72} width={w * 0.15} height={h * 0.2} rx={10} fill="#D4EBD4" />
            {[0.14, 0.3, 0.58, 0.88].map((fy) => (
              <Rect key={`h${fy}`} x={0} y={h * fy - 7} width={w} height={14} fill="#FFFFFF" />
            ))}
            {[0.08, 0.22, 0.52, 0.82].map((fx) => (
              <Rect key={`v${fx}`} x={w * fx - 7} y={0} width={14} height={h} fill="#FFFFFF" />
            ))}
            <Path d={`M0 ${h * 0.95} L${w * 0.5} ${h * 0.05}`} stroke="#FFFFFF" strokeWidth={18} />
            {!pickup && (
              <Polyline
                points={pts(ROUTE)}
                fill="none"
                stroke="#C99BC2"
                strokeWidth={5}
                strokeDasharray="8 8"
                strokeLinecap="round"
              />
            )}
            {travelled.length > 1 && (
              <Polyline
                points={travelled.map((p) => px(p).join(',')).join(' ')}
                fill="none"
                stroke={colors.primary}
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>

          <View style={[styles.marker, { left: store[0] - 20, top: store[1] - 20 }]}>
            <View style={styles.storePin}>
              <Icon name="storefront" size={20} color={colors.white} />
            </View>
          </View>
          <View style={[styles.label, { left: Math.max(4, store[0] - 60), top: store[1] - 46 }]}>
            <Txt variant="labelSm" color={colors.white}>
              {storeLabel}
            </Txt>
          </View>

          {!pickup && (
            <>
              <View style={[styles.marker, { left: home[0] - 18, top: home[1] - 36 }]}>
                <Icon name="map-marker" size={40} color={colors.goldDark} />
              </View>
              <View style={[styles.labelLight, { left: Math.min(w - 96, home[0] - 44), top: home[1] + 8 }]}>
                <Txt variant="labelSm" color={colors.primary}>
                  Tu dirección
                </Txt>
              </View>
            </>
          )}

          {showRider && (
            <Animated.View style={[styles.rider, riderStyle]}>
              <Animated.View style={[styles.pulse, pulseStyle]} />
              <View style={styles.riderDot}>
                <Icon name="moped" size={24} color={colors.onGold} />
              </View>
              {riderLabel && (
                <View style={styles.riderLabel}>
                  <Txt variant="labelSm" color={colors.white} numberOfLines={1}>
                    {riderLabel}
                  </Txt>
                </View>
              )}
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

/* ——— Progreso por pasos ——— */

export function StepProgress({ status }: { status: OrderStatus }) {
  const { steps, step, phase } = status;
  const n = steps.length;
  const reached = (i: number) => phase === 'completed' || i < step;
  return (
    <View style={styles.steps}>
      {/* Conectores detrás de los círculos, de centro a centro. */}
      {steps.slice(1).map((s, i) => (
        <View
          key={`line-${s.title}`}
          style={[
            styles.connector,
            {
              left: `${((i + 0.5) / n) * 100}%`,
              width: `${100 / n}%`,
              backgroundColor: reached(i + 1)
                ? colors.success
                : phase === 'active' && i + 1 === step
                  ? colors.primary
                  : colors.border,
            },
          ]}
        />
      ))}
      {steps.map((s, i) => {
        const done = reached(i);
        const current = phase === 'active' && i === step;
        const bg = done ? colors.successSoft : current ? colors.primary : colors.surfaceMid;
        const fg = done ? colors.success : current ? colors.white : colors.textSubtle;
        return (
          <View key={s.title} style={styles.step}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: bg,
                  borderColor: done ? colors.success : current ? colors.primarySoft : colors.border,
                },
              ]}
            >
              <Icon name={done ? 'check' : s.icon} size={20} color={fg} />
            </View>
            <Txt
              variant="labelSm"
              align="center"
              color={current ? colors.primary : done ? colors.text : colors.textSubtle}
              style={{ marginTop: 6, fontSize: 11 }}
            >
              {s.title}
            </Txt>
            <Txt variant="bodySm" align="center" color={colors.textSubtle} style={{ fontSize: 11 }}>
              {(done || current) && s.at ? time24(s.at) : 'Estimado'}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: { position: 'absolute' },
  storePin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryDark,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelLight: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rider: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,190,59,0.45)',
  },
  riderDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderLabel: {
    position: 'absolute',
    top: 48,
    width: 110,
    alignItems: 'center',
    backgroundColor: 'rgba(28,27,27,0.85)',
    borderRadius: radius.md,
    paddingVertical: 2,
  },
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  connector: { position: 'absolute', top: 19, height: 3 },
  stepDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
