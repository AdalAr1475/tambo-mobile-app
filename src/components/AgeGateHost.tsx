import { Modal, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSession } from '@/store/session';
import { useUi } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { Button, Txt } from './ui';

/** Confirmación de mayoría de edad antes de agregar bebidas alcohólicas (Ley 28681). */
export function AgeGateHost() {
  const gate = useUi((s) => s.ageGate);
  const close = useUi((s) => s.closeAgeGate);
  const verify = useSession((s) => s.verifyAge);

  return (
    <Modal visible={!!gate} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.scrim}>
        <Animated.View entering={ZoomIn.duration(220)} style={styles.dialog}>
          <View style={styles.iconWrap}>
            <Txt variant="headlineLg" weight="extrabold" color={colors.primary}>
              +18
            </Txt>
          </View>
          <Txt variant="headlineMd" align="center">
            ¿Eres mayor de edad?
          </Txt>
          <Txt variant="bodyMd" color={colors.textMuted} align="center">
            Este producto contiene alcohol. La venta está prohibida a menores de 18 años y el repartidor podrá
            solicitar tu DNI al entregar.
          </Txt>
          <View style={styles.legal}>
            <Icon name="alert-outline" size={16} color={colors.goldText} />
            <Txt variant="bodySm" color={colors.goldText} style={{ flex: 1 }}>
              Tomar bebidas alcohólicas en exceso es dañino.
            </Txt>
          </View>
          <Button
            label="Sí, soy mayor de 18"
            variant="brand"
            onPress={() => {
              const confirm = gate?.onConfirm;
              verify();
              close();
              confirm?.();
            }}
          />
          <Button label="No, volver" variant="ghost" onPress={close} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    padding: space.xl,
    gap: space.md,
    alignItems: 'stretch',
  },
  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    padding: space.sm,
  },
});
