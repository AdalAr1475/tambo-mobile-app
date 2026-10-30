import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useDeliveryPoint } from '@/components/delivery';
import { FloatingCartBar } from '@/components/FloatingCartBar';
import { Icon } from '@/components/Icon';
import { EmptyState, RadioCard, ScreenHeader, SearchBar } from '@/components/layout';
import { ProductCard } from '@/components/product';
import { Sheet } from '@/components/Sheet';
import { ProductGridSkeleton } from '@/components/Skeleton';
import { Button, Chip, IconButton, Row, Tap, Txt } from '@/components/ui';
import { getCategory } from '@/data/categories';
import { discountPercent, productsByCategory, searchProducts } from '@/data/products';
import type { Product } from '@/data/types';
import { useContentWidth } from '@/lib/useContentWidth';
import { useCartCount } from '@/store/cart';
import { colors, radius, space } from '@/theme/tokens';

type SortKey = 'ofertas' | 'populares' | 'menor' | 'mayor' | 'az';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'ofertas', label: 'Ofertas' },
  { key: 'populares', label: 'Más vendidos' },
  { key: 'menor', label: 'Menor precio' },
  { key: 'mayor', label: 'Mayor precio' },
  { key: 'az', label: 'Nombre (A-Z)' },
];

const PRICE_RANGES = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'lt10', label: 'Hasta S/ 10', test: (p: Product) => p.price <= 10 },
  { key: '10to30', label: 'S/ 10 - 30', test: (p: Product) => p.price > 10 && p.price <= 30 },
  { key: 'gt30', label: 'Más de S/ 30', test: (p: Product) => p.price > 30 },
] as const;

type PriceKey = (typeof PRICE_RANGES)[number]['key'];

const sorters: Record<SortKey, (a: Product, b: Product) => number> = {
  ofertas: (a, b) => discountPercent(b) - discountPercent(a) || b.popularity - a.popularity,
  populares: (a, b) => b.popularity - a.popularity,
  menor: (a, b) => a.price - b.price,
  mayor: (a, b) => b.price - a.price,
  az: (a, b) => a.name.localeCompare(b.name, 'es'),
};

export default function CategoryScreen() {
  const { id, sub } = useLocalSearchParams<{ id: string; sub?: string }>();
  const category = getCategory(id);
  const count = useCartCount();
  const point = useDeliveryPoint();
  const cardW = (useContentWidth() - space.lg * 2 - space.md) / 2;

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [subcat, setSubcat] = useState(sub ?? 'Todo');
  const [sort, setSort] = useState<SortKey>('ofertas');
  const [brands, setBrands] = useState<string[]>([]);
  const [price, setPrice] = useState<PriceKey>('all');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftBrands, setDraftBrands] = useState<string[]>([]);
  const [draftPrice, setDraftPrice] = useState<PriceKey>('all');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450);
    return () => clearTimeout(t);
  }, []);

  const all = useMemo(() => (category ? productsByCategory(category.id) : []), [category]);
  const allBrands = useMemo(() => [...new Set(all.map((p) => p.brand))].sort(), [all]);

  const results = useMemo(() => {
    const range = PRICE_RANGES.find((r) => r.key === price)!;
    return searchProducts(query, all)
      .filter((p) => subcat === 'Todo' || p.subcategory === subcat)
      .filter((p) => brands.length === 0 || brands.includes(p.brand))
      .filter(range.test)
      .sort(sorters[sort]);
  }, [all, query, subcat, brands, price, sort]);

  if (!category) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Categoría" />
        <EmptyState
          icon="shape-outline"
          title="Categoría no encontrada"
          message="Vuelve al inicio para seguir comprando."
          action="Ir al inicio"
          onAction={() => router.replace('/')}
        />
      </View>
    );
  }

  const activeFilters = brands.length + (price !== 'all' ? 1 : 0);
  const openFilters = () => {
    setDraftBrands(brands);
    setDraftPrice(price);
    setFilterOpen(true);
  };
  const clearAll = () => {
    setQuery('');
    setSubcat('Todo');
    setBrands([]);
    setPrice('all');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title={category.title}
        right={
          <IconButton
            icon="shopping-outline"
            label={`Carrito, ${count} productos`}
            color={colors.white}
            badge={count}
            onPress={() => router.push('/carrito')}
          />
        }
      >
        <Row style={styles.deliveryStrip}>
          <Icon name="map-marker-outline" size={14} color="rgba(255,255,255,0.85)" />
          <Txt variant="labelSm" color="rgba(255,255,255,0.85)" numberOfLines={1} style={{ flex: 1 }}>
            {point.kicker}: {point.title}
          </Txt>
          <Txt variant="labelSm" color={colors.gold}>
            {point.eta}
          </Txt>
        </Row>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={`Buscar en ${category.title}...`}
          style={{ marginHorizontal: space.sm }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {['Todo', ...category.subcategories].map((s) => (
            <Chip key={s} label={s} active={subcat === s} onPress={() => setSubcat(s)} tone="onPrimary" />
          ))}
        </ScrollView>
      </ScreenHeader>

      <FlatList
        data={loading ? [] : results}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md, paddingHorizontal: space.lg }}
        contentContainerStyle={{ gap: space.md, paddingBottom: count > 0 ? 112 : space.xxl }}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingTop: space.md }}>
            <Row style={styles.toolbar}>
              <Tap
                onPress={() => setSortOpen(true)}
                style={styles.sortBtn}
                accessibilityLabel="Ordenar productos"
              >
                <Icon name="swap-vertical" size={18} color={colors.text} />
                <Txt variant="labelMd">Ordenar:</Txt>
                <Txt variant="labelMd" color={colors.primary} weight="bold">
                  {SORTS.find((s) => s.key === sort)?.label}
                </Txt>
                <Icon name="chevron-down" size={18} color={colors.primary} />
              </Tap>
              <Tap
                onPress={openFilters}
                style={[styles.filterBtn, activeFilters > 0 && styles.filterBtnActive]}
                accessibilityLabel="Filtrar por marca y precio"
              >
                <Icon name="tune-variant" size={18} color={activeFilters ? colors.white : colors.text} />
                <Txt variant="labelMd" color={activeFilters ? colors.white : colors.text}>
                  Filtro{activeFilters ? ` (${activeFilters})` : ' (Marca, Precio)'}
                </Txt>
              </Tap>
            </Row>
            {category.promo && (
              <Tap
                onPress={() => router.navigate('/descuentos')}
                style={styles.promo}
                accessibilityLabel={category.promo}
              >
                <Icon name="fire" size={22} color={colors.magenta} />
                <Txt variant="labelMd" color={colors.primaryDark} style={{ flex: 1 }}>
                  {category.promo}
                </Txt>
                <Icon name="chevron-right" size={20} color={colors.primaryDark} />
              </Tap>
            )}
            {loading ? (
              <ProductGridSkeleton />
            ) : (
              <Txt variant="bodySm" color={colors.textMuted} style={{ paddingHorizontal: space.lg }}>
                {results.length} {results.length === 1 ? 'producto' : 'productos'}
              </Txt>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? undefined : (
            <EmptyState
              icon="magnify-close"
              title="Sin resultados"
              message="No encontramos productos con esos filtros. Prueba con otra búsqueda."
              action="Limpiar filtros"
              onAction={clearAll}
            />
          )
        }
        renderItem={({ item }) => <ProductCard product={item} width={cardW} />}
      />
      <FloatingCartBar bottom={space.lg} />

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Ordenar por">
        <View style={{ gap: space.sm }}>
          {SORTS.map((s) => (
            <RadioCard
              key={s.key}
              title={s.label}
              selected={sort === s.key}
              onPress={() => {
                setSort(s.key);
                setSortOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>

      <Sheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filtros"
        footer={
          <Row>
            <Button
              label="Limpiar"
              variant="outline"
              full={false}
              style={{ flex: 1 }}
              onPress={() => {
                setDraftBrands([]);
                setDraftPrice('all');
              }}
            />
            <Button
              label="Aplicar"
              variant="brand"
              full={false}
              style={{ flex: 2 }}
              onPress={() => {
                setBrands(draftBrands);
                setPrice(draftPrice);
                setFilterOpen(false);
              }}
            />
          </Row>
        }
      >
        <Txt variant="labelLg" style={styles.filterTitle}>
          Marca
        </Txt>
        <View style={styles.wrap}>
          {allBrands.map((b) => (
            <Chip
              key={b}
              label={b}
              active={draftBrands.includes(b)}
              onPress={() => setDraftBrands((d) => (d.includes(b) ? d.filter((x) => x !== b) : [...d, b]))}
            />
          ))}
        </View>
        <Txt variant="labelLg" style={styles.filterTitle}>
          Precio
        </Txt>
        <View style={styles.wrap}>
          {PRICE_RANGES.map((r) => (
            <Chip
              key={r.key}
              label={r.label}
              active={draftPrice === r.key}
              onPress={() => setDraftPrice(r.key)}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  deliveryStrip: { paddingHorizontal: space.sm, marginBottom: space.sm, gap: 4 },
  chips: { gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.md },
  toolbar: { paddingHorizontal: space.lg, justifyContent: 'space-between' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    height: 40,
    backgroundColor: colors.surface,
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#F5B8E6',
  },
  filterTitle: { marginTop: space.sm, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
});
