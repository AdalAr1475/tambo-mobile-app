import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { Icon, type IconName } from '../Icon';
import { Txt } from '../ui';
import { alpha } from './color';
import type { MapMarker } from './types';

/**
 * Vistas de los pines del mapa nativo (react-native-maps). Cada pin tiene medidas fijas y declara
 * su punto de anclaje (`anchorY`, px desde arriba) para ubicarlo igual en Android y iOS. Sin
 * sombras con elevation: Android dibuja el marcador como bitmap y las recortaría.
 */
export type PinLayout = { width: number; height: number; anchorY: number };

const PIN = { normal: 30, selected: 40 } as const;
const PILL_H = 22;
const LABEL_H = 18;
const GAP = 3;
const SELECTED_WIDTH = 200;
const LABEL_WIDTH = 130;
const USER_HALO = 34;
const RIDER = 40;

/** Alto de la gota: círculo de diámetro `s` más la punta (cuadrado rotado 45°). */
const dropHeight = (s: number) => Math.ceil(s * 1.21);

const FILL: Record<string, string> = {
  store: colors.primary,
  home: colors.primaryDark,
  office: colors.wine,
  place: colors.outline,
};
const GLYPH: Partial<Record<MapMarker['kind'], IconName>> = {
  home: 'home',
  office: 'briefcase',
  place: 'circle',
};

const isPin = (m: MapMarker) => m.kind !== 'user' && m.kind !== 'rider';
const showsPill = (m: MapMarker) => m.kind === 'store' && !!m.selected && !!m.label;
const showsLabel = (m: MapMarker) => m.kind !== 'store' && m.kind !== 'rider' && !!(m.label || m.kind === 'user');

export function pinLayout(m: MapMarker): PinLayout {
  if (m.kind === 'rider') return { width: RIDER, height: RIDER, anchorY: RIDER / 2 };
  if (m.kind === 'user') {
    // Espacio arriba igual al de la etiqueta: el punto azul queda en el centro.
    const height = USER_HALO + 2 * LABEL_H;
    return { width: LABEL_WIDTH, height, anchorY: height / 2 };
  }
  const s = m.selected ? PIN.selected : PIN.normal;
  const top = showsPill(m) ? PILL_H + GAP : 0;
  const drop = dropHeight(s);
  const bottom = showsLabel(m) ? GAP + LABEL_H : 0;
  const width = showsPill(m) ? SELECTED_WIDTH : showsLabel(m) ? LABEL_WIDTH : s + 12;
  return { width, height: top + drop + bottom, anchorY: top + drop };
}

export function PinView({ marker }: { marker: MapMarker }) {
  const layout = pinLayout(marker);
  const box = { width: layout.width, height: layout.height };

  if (marker.kind === 'rider') {
    return (
      <View style={[box, styles.rider]}>
        <Txt style={styles.riderGlyph}>🛵</Txt>
      </View>
    );
  }

  if (marker.kind === 'user') {
    return (
      <View style={[box, styles.column]}>
        <View style={{ height: LABEL_H }} />
        <View style={styles.halo}>
          <View style={styles.dot} />
        </View>
        <Label text={marker.label ?? 'Estás aquí'} color={colors.userLocation} />
      </View>
    );
  }

  const s = marker.selected ? PIN.selected : PIN.normal;
  const ring = marker.selected ? colors.gold : colors.white;
  const glyph = GLYPH[marker.kind];
  return (
    <View style={[box, styles.column]}>
      {showsPill(marker) && (
        <View style={styles.pill}>
          <Txt variant="labelSm" color={colors.primaryDark} numberOfLines={1}>
            {marker.label}
            {marker.rating ? (
              <Txt variant="labelSm" color={colors.goldText}>
                {`  ★ ${marker.rating.toFixed(1)}`}
              </Txt>
            ) : null}
          </Txt>
        </View>
      )}
      {showsPill(marker) && <View style={{ height: GAP }} />}
      <View style={{ width: s, height: dropHeight(s) }}>
        <View
          style={[
            styles.drop,
            {
              width: s,
              height: s,
              borderRadius: s / 2,
              backgroundColor: FILL[marker.kind] ?? colors.primary,
              borderColor: ring,
              borderWidth: marker.selected ? 3 : 2.5,
            },
          ]}
        />
        <View style={[styles.glyph, { width: s, height: s }]}>
          {marker.kind === 'store' ? (
            <Txt
              weight="extrabold"
              color={colors.white}
              align="center"
              style={{ fontSize: s * 0.5, lineHeight: s * 0.62 }}
            >
              T
            </Txt>
          ) : (
            glyph && <Icon name={glyph} size={glyph === 'circle' ? s * 0.32 : s * 0.5} color={colors.white} />
          )}
        </View>
        {marker.badge && (
          <View style={styles.badge}>
            <Txt variant="labelSm" color={colors.onGold} style={styles.badgeText}>
              {marker.badge}
            </Txt>
          </View>
        )}
      </View>
      {isPin(marker) && showsLabel(marker) && <View style={{ height: GAP }} />}
      {isPin(marker) && showsLabel(marker) && <Label text={marker.label!} color={colors.primaryDark} />}
    </View>
  );
}

function Label({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.label}>
      <Txt variant="labelSm" color={color} numberOfLines={1} style={styles.labelText}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center' },
  // Cuadrado con tres esquinas redondas rotado 45°: círculo arriba y punta abajo.
  drop: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderBottomRightRadius: 0,
    transform: [{ rotate: '45deg' }],
  },
  glyph: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    paddingHorizontal: 3,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
  },
  badgeText: { fontSize: 9, lineHeight: 13 },
  pill: {
    height: PILL_H,
    maxWidth: SELECTED_WIDTH,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    height: LABEL_H,
    maxWidth: LABEL_WIDTH,
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelText: { fontSize: 10, lineHeight: 13 },
  halo: {
    width: USER_HALO,
    height: USER_HALO,
    borderRadius: USER_HALO / 2,
    backgroundColor: alpha(colors.userLocation, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.userLocation,
    borderWidth: 3,
    borderColor: colors.white,
  },
  rider: {
    borderRadius: RIDER / 2,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderGlyph: { fontSize: 20, lineHeight: 26 },
});
