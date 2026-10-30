import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FloatingCartBar } from '@/components/FloatingCartBar';
import { Icon } from '@/components/Icon';
import { ScreenHeader, SearchBar } from '@/components/layout';
import { ProductImage } from '@/components/product';
import { Tap, Txt } from '@/components/ui';
import { categories } from '@/data/categories';
import { productsByCategory } from '@/data/products';
import { useCartCount } from '@/store/cart';
import { colors, radius, space } from '@/theme/tokens';

export default function CategoriesScreen() {
  const count = useCartCount();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Categorías" back={false}>
        <SearchBar
          placeholder="Buscar productos, marcas..."
          onPress={() => router.push('/buscar')}
          style={{ marginTop: space.sm, marginHorizontal: space.sm }}
        />
      </ScreenHeader>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: count > 0 ? 112 : space.xxl }]}>
        {categories.map((c) => {
          const items = productsByCategory(c.id);
          const preview = items.slice(0, 3);
          return (
            <Tap
              key={c.id}
              onPress={() => router.push(`/categoria/${c.id}`)}
              style={styles.card}
              accessibilityLabel={`${c.title}, ${items.length} productos`}
              pressedStyle={{ opacity: 0.85 }}
            >
              <View style={styles.icon}>
                <Icon name={c.icon} size={30} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="headlineMd" style={{ fontSize: 16 }}>
                  {c.title}
                </Txt>
                <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                  {c.subcategories.join(' • ')}
                </Txt>
                <Txt variant="labelSm" color={colors.primary}>
                  {items.length} productos
                </Txt>
              </View>
              <View style={styles.previews}>
                {preview.map((p, i) => (
                  <View key={p.id} style={[styles.preview, { marginLeft: i === 0 ? 0 : -14, zIndex: 3 - i }]}>
                    <ProductImage product={p} size={36} rounded={10} />
                  </View>
                ))}
              </View>
              <Icon name="chevron-right" size={22} color={colors.textMuted} />
            </Tap>
          );
        })}
      </ScrollView>
      <FloatingCartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previews: { flexDirection: 'row' },
  preview: { borderWidth: 2, borderColor: colors.white, borderRadius: 12 },
});
