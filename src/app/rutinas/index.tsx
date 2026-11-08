import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/layout';
import { AUTOPILOT_BENEFIT, AUTOPILOT_ICON, RoutineCard } from '@/components/routines';
import { Button, Chip, Row, Txt } from '@/components/ui';
import { ROUTINE_TEMPLATES } from '@/lib/routines';
import { useRoutines } from '@/store/routines';
import { colors, radius, space } from '@/theme/tokens';

export default function RoutinesScreen() {
  const insets = useSafeAreaInsets();
  const routines = useRoutines((s) => s.routines);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader kicker="Pedidos recurrentes" title="Tambo Auto-Pilot" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}>
        <Row style={styles.benefit}>
          <Icon name={AUTOPILOT_ICON} size={26} color={colors.onGold} />
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg" color={colors.onGold}>
              Configúralo una vez, llega solo
            </Txt>
            <Txt variant="bodySm" color={colors.onGold}>
              Beneficio Auto-Pilot: {AUTOPILOT_BENEFIT} en cada entrega programada.
            </Txt>
          </View>
        </Row>

        <Txt variant="labelLg">Plantillas en 1 toque</Txt>
        <Row style={{ flexWrap: 'wrap' }}>
          {ROUTINE_TEMPLATES.map((t) => (
            <Chip key={t.key} label={t.label} onPress={() => router.push(`/rutinas/nueva?plantilla=${t.key}`)} />
          ))}
        </Row>

        {routines.length > 0 && <Txt variant="labelLg">Mis rutinas ({routines.length})</Txt>}
        {routines.map((r) => (
          <RoutineCard key={r.id} routine={r} />
        ))}

        <Button
          label="Crear rutina personalizada"
          icon="plus"
          variant={routines.length ? 'outline' : 'brand'}
          onPress={() => router.push('/rutinas/nueva')}
        />
        <Row style={{ gap: 6, alignItems: 'flex-start' }}>
          <Icon name="information-outline" size={16} color={colors.textMuted} />
          <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
            En la versión final las rutinas se ejecutan en nuestros servidores aunque tu teléfono esté apagado. En
            este prototipo se disparan con la app abierta a la hora programada (o con el modo demo).
          </Txt>
        </Row>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  benefit: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.gold,
  },
});
