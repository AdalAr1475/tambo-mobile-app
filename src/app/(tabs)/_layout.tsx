import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { TabBar } from '@/components/TabBar';
import { useActiveOrders, useNow } from '@/store/orders';
import { colors } from '@/theme/tokens';

function TabBarWithBadges(props: BottomTabBarProps) {
  const now = useNow(3000);
  const active = useActiveOrders(now).length;
  return <TabBar {...props} badges={{ ordenes: active }} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBarWithBadges {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="categorias" options={{ title: 'Categorías' }} />
      <Tabs.Screen name="descuentos" options={{ title: 'Descuentos' }} />
      <Tabs.Screen name="ordenes" options={{ title: 'Órdenes' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
