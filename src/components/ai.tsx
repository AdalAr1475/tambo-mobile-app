import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getProduct } from '@/data/products';
import { money } from '@/lib/format';
import type { CartLine } from '@/lib/pricing';
import { daypartOf, DAYPARTS, forYou, upsell, type ComboSuggestion, type Signal } from '@/lib/recommender';
import { useAddManyToCart } from '@/lib/useAddManyToCart';
import { useAddToCart } from '@/lib/useAddToCart';
import { useNow, useOrders } from '@/store/orders';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { ProductImage } from './product';
import { Sheet } from './Sheet';
import { Badge, Button, Card, IconButton, Row, SectionHeader, Tap, Txt } from './ui';

export const AI_ICON = 'creation' as const;
const HOUR = 3_600_000;

/** Sección "Para ti · Tambo IA" del Inicio: se recalcula con cada pedido nuevo y cada hora. */
export function ForYouSection() {
  const orders = useOrders((s) => s.orders);
  const hour = Math.floor(useNow(60_000) / HOUR);
  const suggestions = useMemo(() => forYou(orders, hour * HOUR), [orders, hour]);
  const [why, setWhy] = useState<ComboSuggestion>();
  const daypart = daypartOf(new Date(hour * HOUR));

  return (
    <View style={{ marginBottom: space.xl }}>
      <SectionHeader
        title="Para ti · Tambo IA"
        icon={AI_ICON}
        subtitle={`Combos pensados para ${DAYPARTS[daypart].moment} según tus pedidos`}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {suggestions.map((s) => (
          <ComboCard key={s.id} suggestion={s} onWhy={() => setWhy(s)} />
        ))}
      </ScrollView>
      <Tap
        onPress={() => router.push('/ia/plan')}
        style={{ marginHorizontal: space.lg }}
        pressedStyle={{ opacity: 0.9 }}
        accessibilityLabel="Arma tu plan con Tambo IA"
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.planCta}
        >
          <View style={styles.planIcon}>
            <Icon name="auto-fix" size={24} color={colors.onGold} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg" color={colors.white}>
              Arma tu plan con Tambo IA
            </Txt>
            <Txt variant="bodySm" color="rgba(255,255,255,0.85)">
              Dinos tu presupuesto y cuántos son: armamos el combo óptimo.
            </Txt>
          </View>
          <Icon name="chevron-right" size={24} color={colors.white} />
        </LinearGradient>
      </Tap>
      <WhySheet suggestion={why} onClose={() => setWhy(undefined)} />
    </View>
  );
}

export function ComboCard({ suggestion: s, onWhy }: { suggestion: ComboSuggestion; onWhy: () => void }) {
  const addMany = useAddManyToCart();
  const products = s.items.map((i) => getProduct(i.productId)).filter((p) => !!p);
  return (
    <Card style={styles.card}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Row style={{ gap: 0 }}>
          {products.map((p, i) => (
            <View key={p.id} style={[styles.stackImg, i > 0 && { marginLeft: -14 }]}>
              <ProductImage product={p} size={52} rounded={radius.md} />
            </View>
          ))}
        </Row>
        <Badge label={`${s.match}% match`} tone="promo" icon={AI_ICON} />
      </Row>
      <View style={{ gap: 2 }}>
        <Txt variant="labelLg" numberOfLines={1}>
          {s.title}
        </Txt>
        <Txt variant="bodySm" color={colors.textMuted} numberOfLines={2} style={{ minHeight: 32 }}>
          {products.map((p) => p.name).join(' + ')}
        </Txt>
      </View>
      <Row style={styles.reason}>
        <Icon name="lightbulb-on-outline" size={16} color={colors.primary} />
        <Txt variant="labelMd" color={colors.primary} style={{ flex: 1 }} numberOfLines={2}>
          {s.reason}
        </Txt>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Txt variant="price" color={colors.primary} style={{ fontSize: 18 }}>
            {money(s.total)}
          </Txt>
          {s.regular > s.total && (
            <Txt variant="priceStrike" color={colors.textSubtle}>
              {money(s.regular)}
            </Txt>
          )}
        </View>
        <Row style={{ gap: space.xs }}>
          <IconButton
            icon="information-outline"
            label={`¿Por qué veo ${s.title}?`}
            size={38}
            bg={colors.surfaceMid}
            onPress={onWhy}
          />
          <Button
            label="Agregar"
            icon="plus"
            size="sm"
            variant="brand"
            full={false}
            onPress={() => addMany(s.items, { message: `Agregamos el combo ${s.title} a tu carrito` })}
          />
        </Row>
      </Row>
      {s.hasAlcohol && (
        <Txt variant="labelSm" color={colors.textSubtle}>
          Contiene alcohol • Solo +18
        </Txt>
      )}
    </Card>
  );
}

function SignalBar({ signal }: { signal: Signal }) {
  const pct = Math.round(signal.value * 100);
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="labelMd">{signal.label}</Txt>
        <Txt variant="labelMd" color={colors.primary}>
          {pct}%
        </Txt>
      </Row>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

/** Explicabilidad: qué señales usó el motor para esta sugerencia. */
export function WhySheet({ suggestion, onClose }: { suggestion?: ComboSuggestion; onClose: () => void }) {
  return (
    <Sheet visible={!!suggestion} onClose={onClose} title="¿Por qué veo esto?" subtitle={suggestion?.title}>
      {suggestion && (
        <View style={{ gap: space.md }}>
          <Row style={styles.reason}>
            <Icon name="lightbulb-on-outline" size={18} color={colors.primary} />
            <Txt variant="labelLg" color={colors.primary} style={{ flex: 1 }}>
              {suggestion.reason}
            </Txt>
          </Row>
          {suggestion.signals.map((s) => (
            <SignalBar key={s.label} signal={s} />
          ))}
          <Txt variant="bodySm" color={colors.textMuted}>
            Tambo IA combina tu historial de pedidos (50 %), el momento del día (30 %) y las promociones vigentes (20 %)
            para calcular un {suggestion.match}% de afinidad. El cálculo se hace en tu teléfono: tus datos no salen de
            la app.
          </Txt>
        </View>
      )}
    </Sheet>
  );
}

/** "Complemento inteligente" del carrito: sugiere el acompañante ideal según lo que llevas. */
export function UpsellRow({ lines }: { lines: CartLine[] }) {
  const orders = useOrders((s) => s.orders);
  const addToCart = useAddToCart();
  const suggestion = useMemo(() => upsell(lines, orders), [lines, orders]);
  const product = suggestion && getProduct(suggestion.productId);
  if (!suggestion || !product) return null;
  return (
    <Animated.View entering={FadeIn} key={product.id}>
      <Card style={styles.upsell}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 6 }}>
            <Icon name="robot-happy-outline" size={18} color={colors.primary} />
            <Txt variant="labelMd" color={colors.primary}>
              Complemento inteligente
            </Txt>
          </Row>
          <Badge label="Tambo IA" tone="soft" icon={AI_ICON} />
        </Row>
        <Row style={{ gap: space.md }}>
          <ProductImage product={product} size={52} rounded={radius.md} />
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg" numberOfLines={1}>
              {product.name}
            </Txt>
            <Txt variant="bodySm" color={colors.textMuted} numberOfLines={2}>
              {suggestion.reason}
            </Txt>
            <Txt variant="labelLg" weight="bold" color={colors.primary}>
              {money(product.price)}
            </Txt>
          </View>
          <Button
            label="Agregar"
            icon="plus"
            size="sm"
            full={false}
            onPress={() => addToCart(product.id, 1, { silent: true })}
          />
        </Row>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md },
  card: { width: 272, padding: space.md, gap: space.sm },
  stackImg: { borderRadius: radius.md, borderWidth: 2, borderColor: colors.white },
  reason: {
    gap: 6,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'flex-start',
  },
  planCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  upsell: { padding: space.md, gap: space.sm, borderColor: colors.primarySoft },
});
