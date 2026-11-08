/**
 * Tambo Spatial (It. 7 · T10): visor 3D / 360° y AR ligera de un producto con `model3d`.
 * Pantalla completa que entra desde abajo. Al perder el foco (p. ej. abrir el carrito) pausa el
 * render y suelta la cámara; al cerrarse libera el contexto GL.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { EmptyState } from '@/components/layout';
import { ArStage } from '@/components/spatial/ArStage';
import { Viewer3D } from '@/components/spatial/Viewer3D';
import { Button, IconButton, Row, Tap, Txt } from '@/components/ui';
import { getModel3d } from '@/data/models3d';
import { getProduct } from '@/data/products';
import { money } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { useAddToCart } from '@/lib/useAddToCart';
import { colors, radius, space } from '@/theme/tokens';

type Tab = '3d' | 'ar';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: '3d', label: 'Vista 3D / 360°', icon: 'rotate-3d-variant' },
  { id: 'ar', label: 'Proyectar en tu mesa (AR)', icon: 'camera-outline' },
];

export default function VisorScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const product = getProduct(id);
  const spec = product?.model3d;
  const built = spec ? getModel3d(spec) : undefined;
  const insets = useSafeAreaInsets();
  const addToCart = useAddToCart();
  const [tab, setTab] = useState<Tab>(initialTab === 'ar' ? 'ar' : '3d');
  const [exploded, setExploded] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [hint, setHint] = useState(true);
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!product || !spec || !built) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
        <EmptyState
          icon="cube-off-outline"
          title="Vista 3D no disponible"
          message="Este producto todavía no tiene modelo 3D."
          action="Volver"
          onAction={close}
        />
      </View>
    );
  }

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    haptic.tap();
    setTab(t);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.viewerTop, colors.viewerBottom]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Row style={{ gap: space.md }}>
          <IconButton icon="close" label="Cerrar visor" color={colors.onDark} bg={colors.glass} onPress={close} />
          <View style={{ flex: 1 }}>
            <Txt variant="labelSm" color={colors.gold} style={{ textTransform: 'uppercase' }}>
              Tambo Spatial · {built.model.title}
            </Txt>
            <Txt variant="headlineMd" color={colors.onDark} numberOfLines={1}>
              {product.name}
            </Txt>
            <Txt variant="bodySm" color={colors.onDarkMuted}>
              {built.model.sizeText}
            </Txt>
          </View>
        </Row>
        <View style={styles.segment} accessibilityRole="tablist">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Tap
                key={t.id}
                onPress={() => switchTab(t.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
                style={[styles.segmentItem, t.id === 'ar' && { flexGrow: 1.4 }, active && styles.segmentActive]}
              >
                <Icon name={t.icon} size={16} color={active ? colors.onGold : colors.onDark} />
                <Txt
                  variant="labelMd"
                  weight="bold"
                  color={active ? colors.onGold : colors.onDark}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ fontSize: 12, flexShrink: 1 }}
                >
                  {t.label}
                </Txt>
              </Tap>
            );
          })}
        </View>
      </View>

      <View style={styles.body}>
        {tab === '3d' ? (
          <>
            <Viewer3D
              spec={spec}
              exploded={exploded}
              comparing={comparing}
              paused={!focused}
              onInteract={() => hint && setHint(false)}
            />
            {hint && (
              <View pointerEvents="none" style={styles.hint}>
                <Icon name="gesture-swipe-horizontal" size={16} color={colors.onDarkMuted} />
                <Txt variant="bodySm" color={colors.onDarkMuted}>
                  Arrastra para girar · pellizca para zoom · doble toque reinicia
                </Txt>
              </View>
            )}
            <Row style={styles.tools}>
              <ToolButton
                icon="arrow-expand-vertical"
                label="Vista explosiva"
                active={exploded}
                onPress={() => {
                  setComparing(false);
                  setExploded((v) => !v);
                }}
              />
              {built.compare && (
                <ToolButton
                  icon="ruler"
                  label="Comparar tamaño"
                  active={comparing}
                  onPress={() => {
                    setExploded(false);
                    setComparing((v) => !v);
                  }}
                />
              )}
            </Row>
          </>
        ) : (
          <ArStage spec={spec} model={built.model} paused={!focused} />
        )}
      </View>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        {product.alcoholic && (
          <Txt variant="bodySm" color={colors.onDarkMuted} align="center" style={{ fontSize: 11 }}>
            Venta solo para mayores de 18 años
          </Txt>
        )}
        <Button
          label="Agregar al carrito"
          icon="cart-plus"
          trailing={money(product.price)}
          onPress={() => addToCart(product.id)}
        />
      </View>
    </View>
  );
}

function ToolButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.tool, active && styles.toolActive]}
    >
      <Icon name={icon} size={18} color={active ? colors.onGold : colors.onDark} />
      <Txt variant="labelMd" weight="bold" color={active ? colors.onGold : colors.onDark}>
        {label}
      </Txt>
    </Tap>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.viewerBottom },
  header: { paddingHorizontal: space.lg, gap: space.md },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
  },
  segmentItem: {
    flexGrow: 1,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: space.sm,
    borderRadius: radius.full,
  },
  segmentActive: { backgroundColor: colors.gold },
  body: { flex: 1, marginHorizontal: space.lg, marginTop: space.md },
  hint: {
    position: 'absolute',
    top: space.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
  },
  tools: { position: 'absolute', bottom: space.sm, alignSelf: 'center', gap: space.sm },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  toolActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  cta: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs },
});
