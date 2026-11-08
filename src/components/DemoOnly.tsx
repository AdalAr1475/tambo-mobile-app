import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useDemo } from '@/store/demo';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { Row, Txt } from './ui';

/**
 * Controles de simulación para la presentación en vivo. Solo se ven con el Modo Presentador
 * activo (`/demo`), dentro de un recuadro punteado dorado para no confundirlos con la app real.
 */
export function DemoOnly({
  children,
  label = 'Modo demo',
  style,
}: {
  children: ReactNode;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const enabled = useDemo((s) => s.enabled);
  if (!enabled) return null;
  return (
    <View style={[styles.box, style]}>
      <Row style={{ gap: 4 }}>
        <Icon name="flask-outline" size={14} color={colors.goldText} />
        <Txt variant="labelSm" color={colors.goldText} style={{ textTransform: 'uppercase' }}>
          {label}
        </Txt>
      </Row>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.gold,
    backgroundColor: colors.goldSoft,
  },
});
