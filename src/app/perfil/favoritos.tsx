import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { EmptyState, ScreenHeader } from '@/components/layout';
import { ProductCard } from '@/components/product';
import { Button } from '@/components/ui';
import { getProduct } from '@/data/products';
import { useAddManyToCart } from '@/lib/useAddManyToCart';
import { useContentWidth } from '@/lib/useContentWidth';
import { useSession } from '@/store/session';
import { space } from '@/theme/tokens';

export default function FavoritesScreen() {
  const favorites = useSession((s) => s.favorites);
  const addMany = useAddManyToCart();
  const cardW = (useContentWidth() - space.lg * 2 - space.md) / 2;
  const items = favorites.map(getProduct).filter((p) => !!p);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Mis favoritos" />
      {items.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Aún no tienes favoritos"
          message="Toca el corazón en cualquier producto para guardarlo aquí."
          action="Explorar productos"
          onAction={() => router.navigate('/categorias')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Button
            label="Agregar todos al carrito"
            icon="cart-plus"
            variant="brand"
            onPress={() =>
              addMany(
                items.map((p) => ({ productId: p.id, qty: 1 })),
                { message: `${items.length} favoritos agregados al carrito` },
              )
            }
          />
          <View style={styles.grid}>
            {items.map((p) => (
              <ProductCard key={p.id} product={p} width={cardW} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
