import { Linking, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { Store } from '@/data/types';
import { hoursLabel } from '@/lib/geo';
import { toast } from '@/store/ui';
import { colors, space } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Row, Txt } from './ui';

/** Abre la ficha de la tienda en Google Maps (app si está instalada). No llama a ninguna API. */
export function openStoreInMaps(store: Pick<Store, 'mapsUrl'>) {
  Linking.openURL(store.mapsUrl).catch(() => toast('No pudimos abrir Google Maps', { tone: 'error' }));
}

/** Estrellas de Google: ★★★★☆ 4.0 (470). Sin calificación → "Sin reseñas". */
export function StarRating({ rating, reviews, size = 14 }: { rating?: number; reviews?: number; size?: number }) {
  if (rating == null) {
    return (
      <Row style={styles.row} accessibilityLabel="Sin reseñas en Google Maps">
        <Icon name="star-outline" size={size} color={colors.placeholder} />
        <Txt variant="bodySm" color={colors.textMuted}>
          Sin reseñas
        </Txt>
      </Row>
    );
  }
  const stars: IconName[] = [1, 2, 3, 4, 5].map((i) =>
    rating >= i - 0.25 ? 'star' : rating >= i - 0.75 ? 'star-half-full' : 'star-outline',
  );
  return (
    <Row
      style={styles.row}
      accessible
      accessibilityLabel={`${rating.toFixed(1)} de 5 estrellas${reviews ? `, ${reviews} reseñas` : ''} en Google Maps`}
    >
      <Row>
        {stars.map((name, i) => (
          <Icon key={i} name={name} size={size} color={colors.gold} />
        ))}
      </Row>
      <Txt variant="labelSm" color={colors.text}>
        {rating.toFixed(1)}
      </Txt>
      {reviews != null && (
        <Txt variant="bodySm" color={colors.textMuted}>
          ({reviews})
        </Txt>
      )}
    </Row>
  );
}

/** Estrellas + horario de una tienda (listas, checkout y carrusel del mapa). */
export function StoreMeta({ store, size }: { store: Store; size?: number }) {
  const hours = hoursLabel(store.hours);
  return (
    <Row style={styles.meta}>
      <StarRating rating={store.rating} reviews={store.reviews} size={size} />
      {hours && (
        <Row style={styles.row}>
          <Icon name="clock-outline" size={13} color={colors.textMuted} />
          <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
            {hours}
          </Txt>
        </Row>
      )}
    </Row>
  );
}

/** Aviso de descubrimiento del doble toque. */
export function DoubleTapHint({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Row style={[styles.row, style]}>
      <Icon name="gesture-double-tap" size={14} color={colors.textMuted} />
      <Txt variant="bodySm" color={colors.textMuted}>
        Doble toque para ver en Google Maps
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { flexWrap: 'wrap', columnGap: space.sm, rowGap: 2, marginTop: 2 },
});
