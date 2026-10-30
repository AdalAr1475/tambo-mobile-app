import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { ScreenHeader } from '@/components/layout';
import { Card, Txt } from '@/components/ui';
import { useSession, type NotificationPrefs } from '@/store/session';
import { colors, radius, space } from '@/theme/tokens';

const OPTIONS: { key: keyof NotificationPrefs; icon: IconName; title: string; subtitle: string }[] = [
  {
    key: 'orderUpdates',
    icon: 'moped-outline',
    title: 'Estado de mis pedidos',
    subtitle: 'Avisos cuando tu pedido se prepara, sale y llega',
  },
  {
    key: 'promos',
    icon: 'tag-outline',
    title: 'Ofertas y promociones',
    subtitle: 'Tamboo Nights, 2x1 y descuentos del día',
  },
  {
    key: 'email',
    icon: 'email-outline',
    title: 'Correo electrónico',
    subtitle: 'Boletas y novedades a tu correo',
  },
  {
    key: 'sms',
    icon: 'message-text-outline',
    title: 'SMS y WhatsApp',
    subtitle: 'Código de pedido y avisos del repartidor',
  },
];

export default function NotificationsScreen() {
  const prefs = useSession((s) => s.notifications);
  const set = useSession((s) => s.setNotification);
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Notificaciones" />
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={{ overflow: 'hidden' }}>
          {OPTIONS.map((o, i) => (
            <View key={o.key} style={[styles.row, i < OPTIONS.length - 1 && styles.divider]}>
              <View style={styles.icon}>
                <Icon name={o.icon} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="labelLg">{o.title}</Txt>
                <Txt variant="bodySm" color={colors.textMuted}>
                  {o.subtitle}
                </Txt>
              </View>
              <Switch
                value={prefs[o.key]}
                onValueChange={(v) => set(o.key, v)}
                trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
                thumbColor={colors.white}
                accessibilityLabel={o.title}
              />
            </View>
          ))}
        </Card>
        <Txt variant="bodySm" color={colors.textMuted} align="center">
          Las notificaciones del estado de tu pedido son importantes para coordinar la entrega.
        </Txt>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceMid },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
