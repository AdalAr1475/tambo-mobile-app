/**
 * Visor 3D de Tambo Spatial (It. 7 · Nivel A): GLView + three.
 *
 * - Arrastrar rota, pellizcar hace zoom (en AR cambia la escala), doble toque reinicia.
 * - Autorrotación lenta cuando el usuario no toca.
 * - Vista explosiva y comparador animados (600 ms) dentro del render loop.
 * - Rótulos: overlays de RN ubicados con `vector.project(camera)` (Animated, sin re-render).
 * - Al desmontar o con `paused` se detiene el loop; al desmontar se libera todo lo de GL.
 */
import { GLView } from 'expo-gl';
import { useEffect, useMemo, useState } from 'react';
import { Animated, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { Txt } from '@/components/ui';
import { getModel3d, viewerLabels } from '@/data/models3d';
import type { Model3dSpec } from '@/data/types';
import { colors, radius, space } from '@/theme/tokens';
import { LABEL_W, ViewerController } from './controller';

export type Viewer3DProps = {
  spec: Model3dSpec;
  /** `studio`: fondo transparente sobre el degradado del visor. `ar`: cámara fija mirando a la mesa. */
  mode?: 'studio' | 'ar';
  exploded?: boolean;
  comparing?: boolean;
  /** AR: escala del modelo (1 = tamaño real de referencia). */
  arScale?: number;
  /** AR: el modelo aparece (con un rebote) cuando la retícula fija la superficie. */
  placed?: boolean;
  /** Detiene el render loop (pantalla sin foco, pestaña oculta). */
  paused?: boolean;
  /** AR: factor incremental del pellizco (para que el slider de escala lo siga). */
  onPinchScale?: (factor: number) => void;
  /** Toques del usuario (para ocultar la ayuda de gestos). */
  onInteract?: () => void;
  style?: StyleProp<ViewStyle>;
};

const LABEL_H = 36;
const CAPTION_W = 150;

export function Viewer3D({
  spec,
  mode = 'studio',
  exploded = false,
  comparing = false,
  arScale = 1,
  placed = true,
  paused = false,
  onPinchScale,
  onInteract,
  style,
}: Viewer3DProps) {
  const { model, compare } = useMemo(() => getModel3d(spec), [spec]);
  const labels = useMemo(() => (mode === 'studio' ? viewerLabels(model, compare) : []), [mode, model, compare]);
  // Un controlador por montaje (el visor cambia de modelo remontando con otra `key`).
  const [ctl] = useState(() => new ViewerController(mode, model, compare, labels.length));

  useEffect(() => {
    ctl.setProps({ exploded, comparing, arScale, placed, paused, onPinchScale, onInteract });
  });
  useEffect(() => () => ctl.dispose(), [ctl]);

  return (
    <View
      style={[styles.fill, style]}
      onLayout={(e) => ctl.setLayout(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}
      {...ctl.responder.panHandlers}
    >
      <GLView style={StyleSheet.absoluteFill} onContextCreate={ctl.onContextCreate} />
      {mode === 'ar' && <Reticle xy={ctl.base} placed={placed} />}
      {labels.map((l, i) => {
        const a = ctl.anims[i];
        if (l.kind === 'caption') {
          return (
            <Animated.View
              key={l.id}
              pointerEvents="none"
              style={[
                styles.caption,
                {
                  opacity: a.opacity,
                  transform: [
                    { translateX: Animated.add(a.xy.x, -CAPTION_W / 2) },
                    { translateY: Animated.add(a.xy.y, -30) },
                  ],
                },
              ]}
            >
              <View style={styles.captionPill}>
                <Txt variant="labelMd" weight="extrabold" color={colors.onGold}>
                  {l.label}
                </Txt>
              </View>
            </Animated.View>
          );
        }
        const left = l.side === 'left';
        return (
          <Animated.View
            key={l.id}
            pointerEvents="none"
            style={[
              styles.label,
              left && styles.labelLeft,
              {
                opacity: a.opacity,
                transform: [
                  { translateX: Animated.add(a.xy.x, left ? -LABEL_W + 5 : -5) },
                  { translateY: Animated.add(a.xy.y, -LABEL_H / 2) },
                ],
              },
            ]}
          >
            <View style={styles.dot} />
            <View style={styles.leader} />
            <View style={styles.pill}>
              <Txt variant="labelSm" color={colors.onDark} numberOfLines={1}>
                {l.label}
              </Txt>
              {!!l.detail && (
                <Txt variant="bodySm" color={colors.onDarkMuted} numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
                  {l.detail}
                </Txt>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Retícula de la AR: pulsa mientras "busca superficie" y se fija (dorada) al anclar el modelo. */
function Reticle({ xy, placed }: { xy: Animated.ValueXY; placed: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (placed) {
      pulse.stopAnimation();
      Animated.timing(pulse, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [placed, pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.reticleWrap, { transform: [{ translateX: Animated.add(xy.x, -70) }, { translateY: Animated.add(xy.y, -26) }] }]}
    >
      <Animated.View
        style={[
          styles.reticle,
          placed ? styles.reticlePlaced : styles.reticleSearching,
          {
            opacity: placed ? 0.55 : 1,
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.12] }) }],
          },
        ]}
      >
        <View style={[styles.reticleDot, placed && { backgroundColor: colors.gold }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
  label: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: LABEL_W,
    height: LABEL_H,
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelLeft: { flexDirection: 'row-reverse' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.onDark,
  },
  leader: { width: 10, height: 2, backgroundColor: colors.gold },
  pill: {
    flexShrink: 1,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.md,
    backgroundColor: colors.glassDark,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  caption: { position: 'absolute', left: 0, top: 0, width: CAPTION_W, alignItems: 'center' },
  captionPill: {
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  reticleWrap: { position: 'absolute', left: 0, top: 0, width: 140, height: 52, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: 140,
    height: 52,
    borderRadius: 70,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleSearching: { borderColor: colors.onDark, borderStyle: 'dashed' },
  reticlePlaced: { borderColor: colors.gold },
  reticleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onDark },
});
