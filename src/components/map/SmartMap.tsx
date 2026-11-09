import { Component, useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from '../Icon';
import { Row, Txt } from '../ui';
import { PlatformMap } from './Map';
import type { MapProps } from './types';

/**
 * Mapa real con respaldo. Nativo: react-native-maps (Google Maps en Android, Apple Maps en iOS).
 * Web: Leaflet + OpenStreetMap en un iframe; si no carga en unos segundos muestra `fallback`
 * (p. ej. el mapa SVG) con el aviso "Mapa sin conexión". Si el mapa falla al renderizar, también.
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
        <MapErrorBoundary onError={onFail}>
          <PlatformMap {...props} onFail={onFail} />
        </MapErrorBoundary>
      )}
      {overlay}
    </View>
  );
}

/** Si el mapa lanza al renderizar (p. ej. módulo nativo ausente), el padre pasa al respaldo. */
class MapErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
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
