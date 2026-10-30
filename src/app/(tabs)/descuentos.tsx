import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { LocationHeader } from '@/components/delivery';
import { FloatingCartBar } from '@/components/FloatingCartBar';
import { Icon } from '@/components/Icon';
import { EmptyState, SearchBar } from '@/components/layout';
import { ProductCard } from '@/components/product';
import { Badge, Chip, Row, SectionHeader, Tap, Txt } from '@/components/ui';
import { discountPercent, getProduct, normalize, products } from '@/data/products';
import { promoCards, type PromoCard } from '@/data/promos';
import type { PromoTag } from '@/data/types';
import { money } from '@/lib/format';
import { useAddToCart } from '@/lib/useAddToCart';
import { useContentWidth } from '@/lib/useContentWidth';
import { useCart, useCartCount } from '@/store/cart';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

type Filter = 'todas' | PromoTag;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'combos', label: 'Combos' },
  { key: '2x1', label: '2x1' },
  { key: 'descuentos', label: 'Descuentos' },
];

export default function PromotionsScreen() {
  const [filter, setFilter] = useState<Filter>('todas');
  const [query, setQuery] = useState('');
  const count = useCartCount();
  const width = useContentWidth();
  const cardW = (width - space.lg * 2 - space.md) / 2;

  const q = normalize(query.trim());
  const cards = useMemo(
    () =>
      promoCards.filter((c) => {
        const p = getProduct(c.productId);
        const tags = new Set<PromoTag>([c.tag as PromoTag, ...(p?.promoTags ?? [])]);
        const matchesFilter = filter === 'todas' || tags.has(filter);
        const matchesQuery =
          !q || normalize(`${c.title} ${c.description} ${p?.name ?? ''} ${p?.brand ?? ''}`).includes(q);
        return matchesFilter && matchesQuery;
      }),
    [filter, q],
  );
  const extra = useMemo(
    () =>
      products
        .filter((p) => p.promoTags?.length || discountPercent(p) > 0)
        .filter((p) => !promoCards.some((c) => c.productId === p.id))
        .filter((p) => filter === 'todas' || p.promoTags?.includes(filter))
        .filter((p) => !q || normalize(`${p.name} ${p.brand}`).includes(q))
        .sort((a, b) => discountPercent(b) - discountPercent(a)),
    [filter, q],
  );

  return (
    <View style={{ flex: 1 }}>
      <LocationHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: count > 0 ? 112 : space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pad}>
          <Row style={{ justifyContent: 'space-between', marginTop: space.lg }}>
            <Row style={{ flex: 1 }}>
              <View style={styles.titleIcon}>
                <Icon name="fire" size={22} color={colors.white} />
              </View>
              <Txt variant="headlineLg" color={colors.primaryDark} style={{ flex: 1 }}>
                Promociones y Descuentos
              </Txt>
            </Row>
            <Badge label="¡Solo hoy!" tone="promo" />
          </Row>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar ofertas, marcas o combos..."
            style={{ marginTop: space.md }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>

        <View style={[styles.pad, { gap: space.lg }]}>
          {filter === 'todas' && !q && <WelcomeCoupon />}
          {cards.map((c) => (
            <PromoCardView key={c.id} card={c} />
          ))}
          {cards.length === 0 && extra.length === 0 && (
            <EmptyState
              icon="tag-off-outline"
              title="Sin promociones"
              message="No encontramos ofertas con ese filtro."
              action="Ver todas"
              onAction={() => {
                setFilter('todas');
                setQuery('');
              }}
            />
          )}
        </View>

        {extra.length > 0 && (
          <View style={{ marginTop: space.xl }}>
            <SectionHeader title="Más productos en oferta" />
            <View style={styles.grid}>
              {extra.map((p) => (
                <ProductCard key={p.id} product={p} width={cardW} />
              ))}
            </View>
          </View>
        )}

        <View style={[styles.pad, { marginTop: space.xl }]}>
          <Row style={styles.footerInfo}>
            <Icon name="check-decagram-outline" size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt variant="labelMd">Entrega rápida en menos de 30 mins</Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                O recoge en tu tienda Tambo más cercana sin colas.
              </Txt>
            </View>
          </Row>
        </View>
      </ScrollView>
      <FloatingCartBar />
    </View>
  );
}

function WelcomeCoupon() {
  const used = useSession((s) => s.usedCoupons.includes('TAMBOYA10'));
  const applied = useCart((s) => s.couponCode === 'TAMBOYA10');
  const setCoupon = useCart((s) => s.setCoupon);

  const copy = async () => {
    await Clipboard.setStringAsync('TAMBOYA10');
    setCoupon('TAMBOYA10');
    toast('Cupón TAMBOYA10 copiado y aplicado a tu carrito', {
      icon: 'ticket-percent-outline',
      tone: 'success',
    });
  };

  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.coupon}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 6 }}>
          <Icon name="ticket-confirmation-outline" size={18} color={colors.gold} />
          <Txt variant="labelSm" color={colors.gold} style={{ textTransform: 'uppercase' }}>
            Cupón de bienvenida
          </Txt>
        </Row>
        <Badge label="1ra Compra" tone="discount" />
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
        <View style={{ flex: 1 }}>
          <Txt variant="headlineLg" weight="extrabold" color={colors.white}>
            -S/ 10.00 DCTO
          </Txt>
          <Txt variant="bodySm" color="rgba(255,255,255,0.85)">
            En compras mayores a S/ 30 por la app
          </Txt>
        </View>
        <Tap
          onPress={copy}
          disabled={used}
          style={styles.couponBtn}
          accessibilityLabel={used ? 'Cupón ya usado' : 'Copiar y aplicar cupón TAMBOYA10'}
        >
          <Txt variant="labelMd" weight="extrabold" color={colors.onGold}>
            {used ? 'USADO' : 'TAMBOYA10'}
          </Txt>
          <Icon name={applied ? 'check' : 'content-copy'} size={16} color={colors.onGold} />
        </Tap>
      </Row>
    </LinearGradient>
  );
}

function PromoCardView({ card }: { card: PromoCard }) {
  const product = getProduct(card.productId);
  const addToCart = useAddToCart();
  if (!product) return null;
  const pct = discountPercent(product);

  return (
    <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.promo}>
      <Tap
        onPress={() => router.push(`/producto/${product.id}`)}
        pressedStyle={{ opacity: 0.95 }}
        accessibilityLabel={card.title}
      >
        <LinearGradient
          colors={card.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoTop}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Badge
              label={card.kicker.toUpperCase()}
              tone="promo"
              icon={card.tag === '2x1' ? undefined : 'lightning-bolt'}
            />
            <View style={styles.validity}>
              <Txt variant="labelSm" color={colors.white}>
                {card.validity}
              </Txt>
            </View>
          </Row>
          <Row style={{ alignItems: 'center', gap: space.md, marginTop: space.md }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Txt
                variant="headlineLg"
                weight="extrabold"
                color={card.id === 'estrella' ? colors.gold : colors.white}
                style={card.id === 'estrella' && { fontSize: 30, lineHeight: 34 }}
              >
                {card.title}
              </Txt>
              <Txt variant="bodySm" color="rgba(255,255,255,0.88)">
                {card.description}
              </Txt>
              <View style={styles.chip}>
                <Txt variant="labelSm" color={colors.white}>
                  {card.chip}
                </Txt>
              </View>
            </View>
            <Image source={card.image} style={styles.promoImage} contentFit="cover" />
          </Row>
          {card.alcoholic && (
            <Txt variant="labelSm" color="rgba(255,255,255,0.7)" align="center" style={styles.legal}>
              TOMAR BEBIDAS ALCOHÓLICAS EN EXCESO ES DAÑINO (+18)
            </Txt>
          )}
        </LinearGradient>
      </Tap>
      <Row style={styles.promoBottom}>
        <View style={{ flex: 1 }}>
          <Txt variant="labelLg" numberOfLines={1}>
            {product.name}
          </Txt>
          <Row style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
            <Txt variant="price" color={colors.primary}>
              {money(product.price)}
            </Txt>
            {product.regularPrice && (
              <Txt variant="priceStrike" color={colors.textSubtle}>
                {money(product.regularPrice)}
              </Txt>
            )}
            {pct > 0 && <Badge label={`-${pct}%`} tone="soft" />}
            {product.multiBuy && <Badge label={product.badge?.label ?? '2x1'} tone="soft" />}
          </Row>
        </View>
        <Tap
          onPress={() => addToCart(product.id)}
          style={styles.grab}
          accessibilityLabel={`Aprovechar ${product.name}`}
        >
          <Txt variant="labelMd" weight="bold" color={colors.onGold}>
            Aprovechar
          </Txt>
          <Icon name="cart-plus" size={18} color={colors.onGold} />
        </Tap>
      </Row>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.lg },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.wine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.lg },
  coupon: { borderRadius: radius.xl, padding: space.lg },
  couponBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    height: 44,
  },
  promo: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promoTop: { padding: space.lg },
  validity: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  promoImage: {
    width: 112,
    height: 112,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  legal: {
    marginTop: space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: space.sm,
  },
  promoBottom: { padding: space.lg, gap: space.md },
  grab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    height: 46,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.lg },
  footerInfo: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMid,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
});
