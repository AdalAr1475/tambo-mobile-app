import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from '../Icon';
import { Row, Txt } from '../ui';
import { LeafletMap } from './LeafletMap';
import type { MapProps } from './types';

/**
 * Mapa real (Leaflet + OpenStreetMap) con respaldo: si no hay conexión, el mapa no carga en
 * unos segundos o es web, muestra `fallback` (p. ej. el mapa SVG) con el aviso "Mapa sin conexión".
 */
export function SmartMap({
  fallback,
  overlay,
  ...props
}: Omit<MapProps, 'onFail'> & { fallback: ReactNode; overlay?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);

  return (
    <View style={{ height: props.height }}>
      {failed ? (
        <>
          {fallback}
          <Row style={styles.offline}>
            <Icon name="wifi-off" size={12} color={colors.textMuted} />
            <Txt variant="labelSm" color={colors.textMuted}>
              Mapa sin conexión
            </Txt>
          </Row>
        </>
      ) : (
        <LeafletMap {...props} onFail={onFail} />
      )}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  offline: {
    position: 'absolute',
    left: space.sm,
    bottom: space.sm,
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
