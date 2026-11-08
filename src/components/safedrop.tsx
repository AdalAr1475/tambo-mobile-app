import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Order } from '@/data/types';
import { haptic } from '@/lib/feedback';
import { scanAndVerify, VERIFY_MESSAGE } from '@/lib/token';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';
import { DemoOnly } from './DemoOnly';
import { Icon } from './Icon';
import { DynamicQr } from './locker';
import { Button, Card, Row, Txt } from './ui';

/**
 * Tambo SafeDrop: el pedido solo se marca como entregado cuando el repartidor escanea el QR
 * dinámico (o digita el PIN) en la puerta. Reemplaza la entrega "por tiempo".
 */
export function SafeDropCard({ order, arrived }: { order: Order; arrived: boolean }) {
  const [scanning, setScanning] = useState(false);

  const simulateScan = async () => {
    setScanning(true);
    const result = await scanAndVerify(order);
    setScanning(false);
    if (result.ok) {
      haptic.success();
      toast('Entrega verificada con SafeDrop', { tone: 'success', icon: 'shield-check' });
    } else {
      haptic.warning();
      toast(VERIFY_MESSAGE[result.reason], { tone: 'error' });
    }
  };

  return (
    <Animated.View entering={FadeInDown}>
      <Card style={styles.card}>
        <Row style={{ gap: space.sm }}>
          <View style={styles.icon}>
            <Icon name="shield-check-outline" size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg">Seguridad de entrega • Tambo SafeDrop</Txt>
            <Txt variant="bodySm" color={colors.textMuted}>
              {arrived ? 'Tu repartidor está en la puerta.' : 'Tu repartidor está a menos de 50 m.'} Muéstrale
              este código: solo así se marca como entregado.
            </Txt>
          </View>
        </Row>
        <DynamicQr order={order} size={168} />
        <DemoOnly>
          <Button
            label={scanning ? 'Escaneando…' : 'Simular escaneo del motorizado'}
            icon="cellphone-nfc"
            variant="outline"
            size="sm"
            disabled={scanning}
            onPress={simulateScan}
          />
        </DemoOnly>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md, borderColor: colors.primary, borderWidth: 2 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
