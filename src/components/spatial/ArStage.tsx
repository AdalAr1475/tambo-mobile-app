/**
 * AR ligera (It. 7): feed de la cámara de fondo + modelo 3D transparente encima, con sombra,
 * retícula que "busca superficie" 1.2 s y luego fija, y control de escala.
 *
 * No hay detección de superficies (ARKit/ARCore no existen en Expo Go): el modelo se ancla al
 * centro de la vista. Sin permiso de cámara, sin cámara o en web se usa una foto de mesa.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Slider } from '@/components/slider';
import { Tap, Txt } from '@/components/ui';
import type { Model3d } from '@/data/models3d';
import type { Model3dSpec } from '@/data/types';
import { haptic } from '@/lib/feedback';
import { colors, radius, space } from '@/theme/tokens';
import { Viewer3D } from './Viewer3D';

const TABLE_PHOTO = require('../../../assets/images/ar-table.jpg');
const SEARCH_MS = 1200;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2;

export function ArStage({ spec, model, paused }: { spec: Model3dSpec; model: Model3d; paused: boolean }) {
  const isWeb = Platform.OS === 'web';
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  /** Para qué búsqueda se fijó la superficie (se repite al cambiar de fondo o al reubicar). */
  const [placedFor, setPlacedFor] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  // Pide el permiso una sola vez al entrar a la pestaña (si aún se puede preguntar).
  useEffect(() => {
    if (!isWeb && permission && !permission.granted && permission.canAskAgain && permission.status === 'undetermined') {
      requestPermission().catch(() => {});
    }
  }, [isWeb, permission, requestPermission]);

  const useCamera = !isWeb && !!permission?.granted && !cameraFailed;
  const search = `${useCamera ? 'camera' : 'photo'}-${searchKey}`;
  const placed = placedFor === search;

  // "Buscar superficie" durante 1.2 s y fijar.
  useEffect(() => {
    const t = setTimeout(() => {
      setPlacedFor(search);
      haptic.success();
    }, SEARCH_MS);
    return () => clearTimeout(t);
  }, [search]);

  const sizeCm = Math.round(model.heightCm * scale * 10) / 10;
  const sizeText =
    Math.abs(scale - 1) < 0.05 ? `Tamaño real ≈ ${model.heightCm} cm` : `Escala ${scale.toFixed(1)}× · ≈ ${sizeCm} cm`;

  let notice: { text: string; action?: { label: string; onPress: () => void } } | undefined;
  if (isWeb) notice = { text: 'En la web usamos una foto de mesa de ejemplo.' };
  else if (cameraFailed) notice = { text: 'No pudimos abrir la cámara: usamos una foto de mesa.' };
  else if (permission && !permission.granted) {
    notice = permission.canAskAgain
      ? {
          text: 'Sin permiso de cámara: usamos una foto de mesa.',
          action: { label: 'Usar cámara', onPress: () => requestPermission().catch(() => {}) },
        }
      : {
          text: 'La cámara está bloqueada: usamos una foto de mesa.',
          action: { label: 'Ajustes', onPress: () => Linking.openSettings().catch(() => {}) },
        };
  }

  return (
    <View style={styles.stage}>
      {useCamera && !paused ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={!paused}
          onMountError={() => setCameraFailed(true)}
        />
      ) : (
        <Image source={TABLE_PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}

      <Viewer3D
        spec={spec}
        mode="ar"
        placed={placed}
        arScale={scale}
        paused={paused}
        onPinchScale={(f) => setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(s * f * 100) / 100)))}
      />

      <View pointerEvents="box-none" style={styles.top}>
        <View style={[styles.status, placed && styles.statusPlaced]}>
          <Icon
            name={placed ? 'check-circle' : 'crosshairs-gps'}
            size={16}
            color={placed ? colors.onGold : colors.onDark}
          />
          <Txt variant="labelMd" color={placed ? colors.onGold : colors.onDark}>
            {placed ? 'Superficie fijada' : 'Buscando superficie…'}
          </Txt>
        </View>
        {placed && (
          <Tap onPress={() => setSearchKey((k) => k + 1)} style={styles.relocate} accessibilityLabel="Reubicar el producto">
            <Icon name="target" size={16} color={colors.onDark} />
            <Txt variant="labelMd" color={colors.onDark}>
              Reubicar
            </Txt>
          </Tap>
        )}
      </View>

      <View style={styles.panel}>
        {notice && (
          <View style={styles.notice}>
            <Icon name="image-outline" size={16} color={colors.onDarkMuted} />
            <Txt variant="bodySm" color={colors.onDarkMuted} style={{ flex: 1 }}>
              {notice.text}
            </Txt>
            {notice.action && (
              <Tap onPress={notice.action.onPress} hitSlop={8} accessibilityLabel={notice.action.label}>
                <Txt variant="labelMd" color={colors.gold}>
                  {notice.action.label}
                </Txt>
              </Tap>
            )}
          </View>
        )}
        <View style={styles.scaleRow}>
          <Icon name="ruler" size={18} color={colors.gold} />
          <Txt variant="labelLg" color={colors.onDark} style={{ flex: 1 }}>
            {sizeText}
          </Txt>
          {Math.abs(scale - 1) >= 0.05 && (
            <Tap onPress={() => setScale(1)} hitSlop={8} accessibilityLabel="Volver al tamaño real">
              <Txt variant="labelMd" color={colors.gold}>
                1:1
              </Txt>
            </Tap>
          )}
        </View>
        <Slider
          value={scale}
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.1}
          onChange={(v) => setScale(Math.round(v * 10) / 10)}
          accessibilityLabel="Escala del producto"
          accessibilityText={sizeText}
        />
        <Txt variant="bodySm" color={colors.onDarkMuted} style={{ fontSize: 11 }}>
          AR ligera: el producto se ancla al centro de la vista (sin detección de superficies).
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, overflow: 'hidden', borderRadius: radius.xl, backgroundColor: colors.viewerBottom },
  top: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.glassDark,
  },
  statusPlaced: { backgroundColor: colors.gold },
  relocate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.glassDark,
  },
  panel: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
    padding: space.md,
    gap: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.glassDark,
  },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
