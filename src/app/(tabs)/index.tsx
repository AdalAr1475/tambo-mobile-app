import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useDeliveryPoint, LocationHeader } from '@/components/delivery';
import { FloatingCartBar } from '@/components/FloatingCartBar';
import { Icon } from '@/components/Icon';
import { SearchBar } from '@/components/layout';
import { ProductCard } from '@/components/product';
import { Badge, Card, IconButton, Row, SectionHeader, Tap, Txt } from '@/components/ui';
import { categories } from '@/data/categories';
import { combos, dealsOfTheDay, discountPercent, getProduct } from '@/data/products';
import { heroBanners } from '@/data/promos';
import { getStore } from '@/data/stores';
import { money } from '@/lib/format';
import { FREE_SHIPPING_MIN } from '@/lib/pricing';
import { useAddToCart } from '@/lib/useAddToCart';
import { useContentWidth } from '@/lib/useContentWidth';
import { useCart, useCartCount } from '@/store/cart';
import { useOrders } from '@/store/orders';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

export default function HomeScreen() {
  const width = useContentWidth();
  const count = useCartCount();
  const point = useDeliveryPoint();
  const deals = useMemo(() => dealsOfTheDay(), []);
  const comboList = useMemo(() => combos(), []);
  const maxDeal = Math.max(...deals.map(discountPercent));

  return (
    <View style={{ flex: 1 }}>
      <LocationHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: count > 0 ? 112 : space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pad}>
          <SearchBar
            placeholder="¿Qué se te antoja hoy? (Chela, snacks...)"
            onPress={() => router.push('/buscar')}
          />
          <View style={styles.strip}>
            <Icon
              name={point.fulfillment === 'delivery' ? 'lightning-bolt-outline' : 'storefront-outline'}
              size={18}
              color={colors.goldText}
            />
            <Txt variant="bodySm" color={colors.goldText} style={{ flex: 1 }}>
              {point.fulfillment === 'delivery' ? (
                <>
                  Entrega ultra rápida en{' '}
                  <Txt variant="bodySm" weight="bold" color={colors.goldText}>
                    {point.eta}
                  </Txt>{' '}
                  • delivery gratis desde S/ {FREE_SHIPPING_MIN}
                </>
              ) : (
                <>
                  Recoge sin colas en{' '}
                  <Txt variant="bodySm" weight="bold" color={colors.goldText}>
                    {point.store.name}
                  </Txt>{' '}
                  • listo en {point.eta}
                </>
              )}
            </Txt>
          </View>
        </View>

        <HeroCarousel width={width} />
        <LastOrderCard />

        <SectionHeader
          title="Explora categorías"
          action="Ver todas"
          onAction={() => router.navigate('/categorias')}
        />
        <View style={styles.catGrid}>
          {categories.map((c) => (
            <Tap
              key={c.id}
              onPress={() => router.push(`/categoria/${c.id}`)}
              style={[styles.catItem, { width: (width - space.lg * 2) / 4 }]}
              accessibilityLabel={c.name}
            >
              <View style={styles.catIcon}>
                <Icon name={c.icon} size={28} color={colors.primary} />
              </View>
              <Txt variant="labelSm" align="center" numberOfLines={1} style={{ fontSize: 12 }}>
                {c.name}
              </Txt>
            </Tap>
          ))}
        </View>

        <SectionHeader
          title="Ofertas del día"
          icon="fire"
          right={<Badge label={`Hasta -${maxDeal}%`} tone="danger" />}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
          {deals.map((p) => (
            <ProductCard key={p.id} product={p} width={168} />
          ))}
        </ScrollView>

        <SectionHeader
          title="Combos Tambo"
          subtitle="Los favoritos de tu barrio listos para armar la previa"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
          {comboList.map((p) => (
            <ProductCard key={p.id} product={p} width={180} addVariant="brand" />
          ))}
        </ScrollView>

        <View style={[styles.pad, { marginTop: space.lg }]}>
          <View style={styles.legal}>
            <Txt
              variant="labelSm"
              align="center"
              color={colors.textMuted}
              style={{ textTransform: 'uppercase' }}
            >
              Tomar bebidas alcohólicas en exceso es dañino • Solo para mayores de 18 años
            </Txt>
          </View>
        </View>
      </ScrollView>
      <FloatingCartBar />
    </View>
  );
}

function HeroCarousel({ width }: { width: number }) {
  const [index, setIndex] = useState(0);
  const addToCart = useAddToCart();
  const cardW = width - space.lg * 2 - 24;
  const step = cardW + space.md;

  return (
    <View style={{ marginTop: space.lg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / step))}
        scrollEventThrottle={32}
      >
        {heroBanners.map((b) => {
          const p = getProduct(b.productId)!;
          return (
            <Tap
              key={b.id}
              onPress={() => router.push(`/producto/${p.id}`)}
              pressedStyle={{ opacity: 0.95 }}
              hasNestedControls
              accessibilityLabel={`${b.title}, ${money(p.price)}`}
            >
              <LinearGradient
                colors={b.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.hero, { width: cardW }]}
              >
                {p.image && <Image source={p.image} style={styles.heroImage} contentFit="cover" />}
                <LinearGradient
                  colors={[b.colors[0], `${b.colors[0]}E6`, `${b.colors[0]}00`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <View style={{ gap: 6 }}>
                    <Badge label={b.kicker.toUpperCase()} tone="promo" />
                    <Txt
                      variant="headlineLg"
                      weight="extrabold"
                      color={colors.white}
                      style={{ maxWidth: '62%' }}
                    >
                      {b.title}
                    </Txt>
                    <Txt variant="bodySm" color="rgba(255,255,255,0.85)">
                      {b.subtitle}
                    </Txt>
                  </View>
                  <View style={styles.heroPrice}>
                    {p.regularPrice && (
                      <Txt variant="priceStrike" color="rgba(255,255,255,0.7)">
                        {money(p.regularPrice)}
                      </Txt>
                    )}
                    <Txt variant="price" color={colors.gold} style={{ fontSize: 24, lineHeight: 28 }}>
                      {money(p.price)}
                    </Txt>
                  </View>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row style={{ gap: 4, flexShrink: 1 }}>
                      <Icon name="clock-outline" size={14} color="rgba(255,255,255,0.85)" />
                      <Txt
                        variant="bodySm"
                        color="rgba(255,255,255,0.85)"
                        numberOfLines={1}
                        style={{ flexShrink: 1 }}
                      >
                        {b.validity}
                      </Txt>
                    </Row>
                    <Tap
                      onPress={() => addToCart(p.id)}
                      style={styles.heroAdd}
                      accessibilityLabel={`Agregar ${b.title}`}
                    >
                      <Txt variant="labelMd" weight="bold" color={colors.onGold}>
                        Agregar
                      </Txt>
                      <Icon name="plus" size={18} color={colors.onGold} />
                    </Tap>
                  </Row>
                </View>
              </LinearGradient>
            </Tap>
          );
        })}
      </ScrollView>
      <Row style={{ justifyContent: 'center', marginTop: space.sm, gap: 6 }}>
        {heroBanners.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </Row>
    </View>
  );
}

function LastOrderCard() {
  const last = useOrders((s) => s.orders.find((o) => !o.cancelledAt));
  const replace = useCart((s) => s.replace);
  if (!last) return null;
  const summary = last.items.map((i) => `${i.qty} ${i.name.split(' ').slice(0, 3).join(' ')}`).join(' + ');
  const store = getStore(last.storeId);

  const repeat = () => {
    replace(
      last.items.filter((i) => getProduct(i.productId)).map((i) => ({ productId: i.productId, qty: i.qty })),
    );
    toast('Agregamos tu último pedido al carrito', { icon: 'history' });
    router.push('/carrito');
  };

  return (
    <Card style={[styles.lastOrder]}>
      <Tap
        onPress={() => router.push(`/pedido/${last.id}`)}
        style={styles.lastOrderInner}
        accessibilityLabel="Ver tu último pedido"
        pressedStyle={{ opacity: 0.8 }}
      >
        <View style={styles.lastIcon}>
          <Icon name="history" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="labelSm" color={colors.textMuted} style={{ textTransform: 'uppercase' }}>
            Tu último pedido
          </Txt>
          <Txt variant="labelLg" weight="bold" numberOfLines={1}>
            {store.name}
          </Txt>
          <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
            {summary} • {money(last.totals.total)}
          </Txt>
        </View>
      </Tap>
      <IconButton
        icon="restore"
        label="Volver a pedir"
        color={colors.white}
        bg={colors.primary}
        onPress={repeat}
        style={{ borderRadius: radius.lg, marginRight: space.md }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.lg },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
    backgroundColor: colors.goldSoft,
    borderColor: '#F6DA9B',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  hero: {
    height: 184,
    borderRadius: radius.xl,
    padding: space.lg,
    overflow: 'hidden',
  },
  heroImage: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '55%' },
  heroPrice: {
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(40,0,36,0.72)',
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  heroAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    height: 38,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotActive: { width: 20, backgroundColor: colors.primary },
  lastOrder: {
    marginHorizontal: space.lg,
    marginTop: space.lg,
    marginBottom: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastOrderInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  lastIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: space.lg,
    rowGap: space.lg,
    marginBottom: space.xl,
  },
  catItem: { alignItems: 'center', gap: 6 },
  catIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hList: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.xl },
  legal: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    padding: space.md,
    backgroundColor: colors.surface,
  },
});
