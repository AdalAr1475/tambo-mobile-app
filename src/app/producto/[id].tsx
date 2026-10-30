import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { DeliveryPointSheet, useDeliveryPoint } from '@/components/delivery';
import { Icon, type IconName } from '@/components/Icon';
import { Accordion, EmptyState } from '@/components/layout';
import { AddControl, ProductImage, QuantityStepper } from '@/components/product';
import { Badge, Button, IconButton, Row, Tap, Txt } from '@/components/ui';
import { getCategory } from '@/data/categories';
import { discountPercent, getProduct } from '@/data/products';
import { money } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { lineTotal } from '@/lib/pricing';
import { useAddToCart } from '@/lib/useAddToCart';
import { useContentWidth } from '@/lib/useContentWidth';
import { useCartCount } from '@/store/cart';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, elevation, radius, space } from '@/theme/tokens';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = getProduct(id);
  const insets = useSafeAreaInsets();
  const width = useContentWidth();
  const [qty, setQty] = useState(1);
  const [page, setPage] = useState(0);
  const [pointOpen, setPointOpen] = useState(false);
  const cartCount = useCartCount();
  const addToCart = useAddToCart();
  const point = useDeliveryPoint();
  const isFav = useSession((s) => s.favorites.includes(id));
  const toggleFavorite = useSession((s) => s.toggleFavorite);

  if (!product) {
    return (
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <EmptyState
          icon="package-variant-remove"
          title="Producto no disponible"
          message="Es posible que se haya agotado. Revisa otros productos similares."
          action="Volver"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const images = product.gallery ?? (product.image ? [product.image] : []);
  const pct = discountPercent(product);
  const saving = product.regularPrice ? product.regularPrice - product.price : 0;
  const category = getCategory(product.categoryId);
  const pairs = (product.pairsWith ?? []).map(getProduct).filter((p) => !!p);
  const total = lineTotal(product, qty);

  const share = async () => {
    const message = `¡Mira esto en Tambo+! ${product.name} a ${money(product.price)} 🛒`;
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      toast('Enlace copiado para compartir');
    }
  };

  const fav = () => {
    haptic.tap();
    toggleFavorite(product.id);
    toast(isFav ? 'Quitado de favoritos' : 'Guardado en favoritos', {
      icon: isFav ? 'heart-off-outline' : 'heart',
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Galería */}
        <View style={{ paddingTop: insets.top + 64 }}>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
              scrollEventThrottle={32}
            >
              {images.map((src, i) => (
                <View key={i} style={{ width, paddingHorizontal: space.lg }}>
                  <Image
                    source={src}
                    style={styles.galleryImage}
                    contentFit="cover"
                    accessibilityLabel={`${product.name}, imagen ${i + 1}`}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: space.lg }}>
              <ProductImage product={product} style={styles.galleryImage} rounded={radius.xl} />
            </View>
          )}
          {images.length > 1 && (
            <Row style={styles.pager}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
              ))}
              <Txt variant="labelSm" color={colors.textMuted} style={{ marginLeft: 6 }}>
                {page + 1}/{images.length}
              </Txt>
            </Row>
          )}
          {pct > 0 && (
            <Badge
              label={`-${pct}% DSCTO`}
              tone="combo"
              icon="tag-outline"
              style={[styles.discount, { top: insets.top + 76 }]}
            />
          )}
        </View>

        {/* Información */}
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ gap: 6, flexShrink: 1 }}>
              <Txt variant="labelSm" color={colors.textMuted} style={{ textTransform: 'uppercase' }}>
                {product.brand}
              </Txt>
              <View style={styles.bullet} />
              <Tap
                onPress={() =>
                  router.push(
                    `/categoria/${product.categoryId}?sub=${encodeURIComponent(product.subcategory)}`,
                  )
                }
                accessibilityLabel={`Ver ${product.subcategory}`}
              >
                <Txt variant="labelSm" color={colors.primary}>
                  {product.subcategory}
                </Txt>
              </Tap>
            </Row>
            {product.badge && <Badge label={product.badge.label} tone="warning" />}
          </Row>
          <Txt variant="headlineLg" style={{ marginTop: space.sm }}>
            {product.name}
          </Txt>
          <Txt variant="bodyMd" color={colors.textMuted}>
            {product.subtitle}
          </Txt>

          <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
            <Row style={{ alignItems: 'baseline' }}>
              <Txt variant="price" color={colors.primary} style={{ fontSize: 26, lineHeight: 30 }}>
                {money(product.price)}
              </Txt>
              {!!product.regularPrice && (
                <Txt variant="priceStrike" color={colors.textSubtle}>
                  {money(product.regularPrice)}
                </Txt>
              )}
            </Row>
            {saving > 0 && <Badge label={`Ahorras ${money(saving)}`} tone="soft" />}
          </Row>
          {product.multiBuy && (
            <Row style={styles.multi}>
              <Icon name="sale" size={18} color={colors.goldText} />
              <Txt variant="labelMd" color={colors.goldText} style={{ flex: 1 }}>
                Llévate {product.multiBuy.qty} por {money(product.multiBuy.price)} — se aplica automáticamente
                en tu carrito.
              </Txt>
            </Row>
          )}

          <Tap
            onPress={() => setPointOpen(true)}
            style={styles.availability}
            accessibilityLabel="Cambiar punto de entrega"
          >
            <Icon name="storefront-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt variant="labelLg">Disponible para retiro y entrega</Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                En{' '}
                <Txt variant="bodySm" weight="bold">
                  {point.store.name}
                </Txt>{' '}
                y Delivery express en 30 min.
              </Txt>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </Tap>

          <Row style={styles.qtyRow}>
            <Txt variant="labelLg" color={colors.textMuted} style={{ flex: 1 }}>
              Cantidad
            </Txt>
            <QuantityStepper value={qty} onChange={setQty} min={1} />
          </Row>
        </View>

        {pairs.length > 0 && (
          <View style={styles.section}>
            <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg }}>
              <Txt variant="headlineMd">Combina perfecto con:</Txt>
              <Txt variant="labelSm" color={colors.primary}>
                {category?.name}
              </Txt>
            </Row>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pairs}
            >
              {pairs.map((p) => (
                <Tap
                  key={p.id}
                  onPress={() => router.push(`/producto/${p.id}`)}
                  style={styles.pairCard}
                  hasNestedControls
                  accessibilityLabel={p.name}
                >
                  <ProductImage product={p} style={{ aspectRatio: 1.6 }} />
                  <Txt variant="labelMd" numberOfLines={1}>
                    {p.name}
                  </Txt>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="labelLg" weight="extrabold" color={colors.primary}>
                      {money(p.price)}
                    </Txt>
                    <AddControl productId={p.id} variant="soft" />
                  </Row>
                </Tap>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.section, { paddingHorizontal: space.lg, backgroundColor: colors.surface }]}>
          <Accordion title="Descripción del producto" icon="text-box-outline" initiallyOpen>
            <Txt variant="bodyMd" color={colors.textMuted}>
              {product.description}
            </Txt>
          </Accordion>
          {product.details && (
            <Accordion
              title={product.alcoholic ? 'Información & Grado Alcohólico' : 'Información del producto'}
              icon="flask-outline"
            >
              <Txt variant="bodyMd" color={colors.textMuted}>
                {product.details}
              </Txt>
            </Accordion>
          )}
          {product.warnings && (
            <Accordion title="Advertencias y Restricciones" icon="alert-outline" tone="danger">
              <Txt variant="bodyMd" color={colors.textMuted}>
                {product.warnings}
              </Txt>
            </Accordion>
          )}
          <Row style={styles.trust}>
            {(
              [
                ['lightning-bolt-outline', 'Entrega rápida'],
                ['shield-check-outline', 'Compra 100% segura'],
                ['credit-card-outline', 'Múltiples pagos'],
              ] as [IconName, string][]
            ).map(([icon, label]) => (
              <View key={label} style={styles.trustItem}>
                <Icon name={icon} size={22} color={colors.primary} />
                <Txt variant="labelSm" align="center" color={colors.textMuted}>
                  {label}
                </Txt>
              </View>
            ))}
          </Row>
        </View>
      </ScrollView>

      {/* Acciones superiores */}
      <Row style={[styles.topBar, { top: insets.top + space.sm }]}>
        <IconButton
          icon="arrow-left"
          label="Volver"
          bg={colors.white}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={elevation.float}
        />
        <Row>
          <IconButton
            icon="share-variant-outline"
            label="Compartir"
            bg={colors.white}
            onPress={share}
            style={elevation.float}
          />
          <IconButton
            icon={isFav ? 'heart' : 'heart-outline'}
            label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            color={isFav ? colors.magenta : colors.text}
            bg={colors.white}
            onPress={fav}
            style={elevation.float}
          />
        </Row>
      </Row>

      {/* CTA fija */}
      <Row style={[styles.cta, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <IconButton
          icon="shopping-outline"
          label={`Ver carrito, ${cartCount} productos`}
          badge={cartCount}
          bg={colors.surface}
          size={52}
          onPress={() => router.push('/carrito')}
          style={styles.cartBtn}
        />
        <Button
          label="Agregar al carrito"
          trailing={money(total)}
          full={false}
          style={{ flex: 1 }}
          onPress={() => {
            addToCart(product.id, qty);
            setQty(1);
          }}
        />
      </Row>
      <DeliveryPointSheet visible={pointOpen} onClose={() => setPointOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  galleryImage: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  pager: { justifyContent: 'center', marginVertical: space.md, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { width: 24, backgroundColor: colors.primary },
  discount: { position: 'absolute', left: space.lg + space.md, borderRadius: radius.md },
  topBar: { position: 'absolute', left: space.lg, right: space.lg, justifyContent: 'space-between' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet + 8,
    borderTopRightRadius: radius.sheet + 8,
    padding: space.lg,
    paddingTop: space.xl,
    marginTop: space.sm,
  },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
  multi: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.goldSoft,
  },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLow,
  },
  qtyRow: {
    marginTop: space.md,
    padding: space.md,
    paddingLeft: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMid,
  },
  section: { backgroundColor: colors.surface, paddingVertical: space.lg, marginTop: space.sm },
  pairs: { paddingHorizontal: space.lg, gap: space.md, paddingTop: space.md },
  pairCard: {
    width: 170,
    padding: space.sm,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  trust: { justifyContent: 'space-around', paddingTop: space.xl, alignItems: 'flex-start' },
  trustItem: { alignItems: 'center', gap: 6, flex: 1 },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.md,
    ...elevation.nav,
  },
  cartBtn: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
});
