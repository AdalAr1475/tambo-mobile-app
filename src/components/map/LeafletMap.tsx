import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { WEB_BRIDGE_SOURCE, type MapMessage } from './leafletHtml';
import type { MapProps } from './types';
import { useMapBridge } from './useMapBridge';

type MapWindow = Window & { __update?: (data: unknown) => void };

/**
 * Mapa de web (solo lo importa Map.web.tsx): página Leaflet en un <iframe srcDoc> (mismo origen)
 * con puente window.postMessage. Si no carga a tiempo, SmartMap usa el respaldo.
 */
export function LeafletMap(props: MapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { html, payload, ready, loaded, onMessage } = useMapBridge(props);

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      const data = e.data as (MapMessage & { source?: string }) | undefined;
      if (e.source !== frame.current?.contentWindow || data?.source !== WEB_BRIDGE_SOURCE) return;
      onMessage(data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [onMessage]);

  useEffect(() => {
    if (!ready) return;
    const win = frame.current?.contentWindow as MapWindow | null | undefined;
    win?.__update?.(JSON.parse(payload));
  }, [ready, payload]);

  return (
    <View style={{ height: props.height, backgroundColor: colors.surfaceMid }}>
      <iframe ref={frame} srcDoc={html} title="Mapa" style={{ border: 0, width: '100%', height: '100%' }} />
      {!loaded && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMid,
  },
});
