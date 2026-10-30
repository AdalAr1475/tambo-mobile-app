import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState, SearchBar } from '@/components/layout';
import { AddControl, PriceStack, ProductImage } from '@/components/product';
import { Chip, IconButton, Row, Tap, Txt } from '@/components/ui';
import { categories } from '@/data/categories';
import { searchProducts } from '@/data/products';
import { useSession } from '@/store/session';
import { colors, radius, space } from '@/theme/tokens';

const POPULAR = ['Four Loko', 'Cerveza', 'Empanada', 'Hielo', 'Helado', 'Inca Kola'];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const recent = useSession((s) => s.recentSearches);
  const pushSearch = useSession((s) => s.pushSearch);
  const clearSearches = useSession((s) => s.clearSearches);
  const results = useMemo(
    () => (query.trim() ? searchProducts(query).sort((a, b) => b.popularity - a.popularity) : []),
    [query],
  );

  const commit = (q = query) => {
    if (q.trim().length > 1) pushSearch(q.trim());
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Row style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <IconButton icon="arrow-left" label="Volver" color={colors.white} onPress={() => router.back()} />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="¿Qué se te antoja hoy?"
          autoFocus
          onSubmit={() => commit()}
          style={{ flex: 1 }}
        />
      </Row>

      {!query.trim() ? (
        <View style={styles.body}>
          {recent.length > 0 && (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="labelLg">Búsquedas recientes</Txt>
                <Tap onPress={clearSearches} hitSlop={8} accessibilityLabel="Borrar búsquedas recientes">
                  <Txt variant="labelMd" color={colors.primary}>
                    Borrar
                  </Txt>
                </Tap>
              </Row>
              <View style={styles.wrap}>
                {recent.map((r) => (
                  <Tap
                    key={r}
                    onPress={() => setQuery(r)}
                    style={styles.recent}
                    accessibilityLabel={`Buscar ${r}`}
                  >
                    <Icon name="history" size={16} color={colors.textMuted} />
                    <Txt variant="labelMd">{r}</Txt>
                  </Tap>
                ))}
              </View>
            </>
          )}
          <Txt variant="labelLg">Lo más buscado</Txt>
          <View style={styles.wrap}>
            {POPULAR.map((p) => (
              <Chip key={p} label={p} onPress={() => setQuery(p)} />
            ))}
          </View>
          <Txt variant="labelLg">Categorías</Txt>
          <View style={styles.wrap}>
            {categories.map((c) => (
              <Tap
                key={c.id}
                onPress={() => router.replace(`/categoria/${c.id}`)}
                style={styles.recent}
                accessibilityLabel={c.name}
              >
                <Icon name={c.icon} size={16} color={colors.primary} />
                <Txt variant="labelMd">{c.name}</Txt>
              </Tap>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
          ListHeaderComponent={
            results.length ? (
              <Txt variant="bodySm" color={colors.textMuted}>
                {results.length} resultados para “{query.trim()}”
              </Txt>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="magnify-close"
              title="Sin resultados"
              message={`No encontramos “${query.trim()}”. Prueba con otra palabra o explora las categorías.`}
              action="Ver ofertas"
              onAction={() => router.dismissTo('/descuentos')}
            />
          }
          renderItem={({ item }) => (
            <Tap
              onPress={() => {
                commit();
                router.push(`/producto/${item.id}`);
              }}
              style={styles.result}
              hasNestedControls
              accessibilityLabel={item.name}
              pressedStyle={{ opacity: 0.85 }}
            >
              <ProductImage product={item} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="labelLg" numberOfLines={2}>
                  {item.name}
                </Txt>
                <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                  {item.subtitle}
                </Txt>
                <PriceStack product={item} size="sm" horizontal />
              </View>
              <AddControl productId={item.id} />
            </Tap>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
  },
  body: { padding: space.lg, gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  recent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
