import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/layout';
import { Badge, Button, Card, Row, Tap, Txt } from '@/components/ui';
import { coupons } from '@/data/stores';
import { money } from '@/lib/format';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

export default function CouponsScreen() {
  const used = useSession((s) => s.usedCoupons);
  const current = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const itemCount = useCart((s) => s.items.length);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Mis cupones" />
      <ScrollView contentContainerStyle={styles.body}>
        {coupons.map((c) => {
          const isUsed = used.includes(c.code);
          const applied = current === c.code;
          return (
            <Card key={c.code} style={[styles.coupon, isUsed && { opacity: 0.6 }]}>
              <View style={styles.stub}>
                <Icon
                  name={c.kind === 'shipping' ? 'moped-outline' : 'ticket-percent-outline'}
                  size={28}
                  color={colors.white}
                />
                <Txt variant="labelSm" color={colors.white} align="center">
                  {c.kind === 'fixed' ? money(c.value) : c.kind === 'percent' ? `${c.value}%` : 'GRATIS'}
                </Txt>
              </View>
              <View style={styles.content}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="labelLg" style={{ flex: 1 }}>
                    {c.title}
                  </Txt>
                  {isUsed ? (
                    <Badge label="Usado" tone="neutral" />
                  ) : applied ? (
                    <Badge label="Aplicado" tone="success" />
                  ) : (
                    <Badge label={`Vence ${c.expires}`} tone="warning" />
                  )}
                </Row>
                <Txt variant="bodySm" color={colors.textMuted}>
                  {c.description}
                </Txt>
                <Row style={{ justifyContent: 'space-between', marginTop: space.xs }}>
                  <Tap
                    onPress={async () => {
                      await Clipboard.setStringAsync(c.code);
                      toast(`Código ${c.code} copiado`, { icon: 'content-copy' });
                    }}
                    style={styles.code}
                    accessibilityLabel={`Copiar código ${c.code}`}
                  >
                    <Txt variant="labelMd" color={colors.primary} style={{ letterSpacing: 1 }}>
                      {c.code}
                    </Txt>
                    <Icon name="content-copy" size={14} color={colors.primary} />
                  </Tap>
                  {!isUsed && (
                    <Button
                      label={applied ? 'Quitar' : 'Aplicar'}
                      size="sm"
                      variant={applied ? 'outline' : 'brand'}
                      full={false}
                      onPress={() => {
                        setCoupon(applied ? undefined : c.code);
                        toast(
                          applied ? 'Cupón quitado del carrito' : `Cupón ${c.code} aplicado a tu carrito`,
                          { icon: 'ticket-percent-outline' },
                        );
                      }}
                    />
                  )}
                </Row>
              </View>
            </Card>
          );
        })}
        {itemCount > 0 && current && (
          <Button label="Ir al carrito" icon="cart-outline" onPress={() => router.push('/carrito')} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  coupon: { flexDirection: 'row', overflow: 'hidden' },
  stub: {
    width: 84,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRightWidth: 2,
    borderStyle: 'dashed',
    borderRightColor: colors.white,
  },
  content: { flex: 1, padding: space.md, gap: 4 },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    height: 34,
    backgroundColor: colors.primaryTint,
  },
});
