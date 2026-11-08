import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';
import { getProduct } from '@/data/products';
import { getStore } from '@/data/stores';
import { haptic } from '@/lib/feedback';
import { money } from '@/lib/format';
import {
  countdownLabel,
  DAY_NAMES,
  DAY_ORDER,
  DAY_SHORT,
  daysLabel,
  monthlyEstimate,
  nextRun,
  nextRunLabel,
  runRoutineWithNotice,
  dateKey,
  routineTotals,
  timeLabel,
} from '@/lib/routines';
import { useNow } from '@/store/orders';
import { useRoutines, type Routine } from '@/store/routines';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';
import { DemoOnly } from './DemoOnly';
import { Icon } from './Icon';
import { Badge, Button, Card, Divider, Row, Tap, Txt } from './ui';

export const AUTOPILOT_ICON = 'autorenew' as const;

export const AUTOPILOT_BENEFIT = '10% OFF + delivery gratis + puntos dobles';

/** Chip que identifica pedidos generados por una rutina. */
export function AutoPilotBadge() {
  return <Badge label="Auto-Pilot" tone="soft" icon={AUTOPILOT_ICON} />;
}

/** Selector de días de la semana (L M M J V S D). */
export function DayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      {DAY_ORDER.map((d) => {
        const active = value.includes(d);
        return (
          <Tap
            key={d}
            onPress={() => {
              haptic.tap();
              onChange(active ? value.filter((x) => x !== d) : [...value, d]);
            }}
            style={[styles.day, active && styles.dayActive]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={DAY_NAMES[d]}
          >
            <Txt variant="labelLg" color={active ? colors.white : colors.text}>
              {DAY_SHORT[d]}
            </Txt>
          </Tap>
        );
      })}
    </Row>
  );
}

const destinationLabel = (r: Routine, addressLabel?: string) =>
  r.fulfillment === 'delivery'
    ? `Delivery a ${addressLabel ?? 'tu dirección'}`
    : `${r.pickupMethod === 'locker' ? 'Smart Locker' : 'Recojo'} en ${getStore(r.storeId).name}`;

/** Tarjeta de una rutina: próxima entrega, productos, pausa, saltar, editar y simulación. */
export function RoutineCard({ routine: r }: { routine: Routine }) {
  const now = useNow(30_000);
  const toggle = useRoutines((s) => s.toggle);
  const skip = useRoutines((s) => s.skip);
  const unskip = useRoutines((s) => s.unskip);
  const address = useSession((s) => s.addresses.find((a) => a.id === r.addressId));
  const next = nextRun(r, now);
  const totals = routineTotals(r);
  const month = monthlyEstimate(r, now);
  const names = r.items.map((i) => `${i.qty} ${getProduct(i.productId)?.name ?? ''}`).join(' + ');

  const skipNext = () => {
    if (!next) return;
    const key = dateKey(next);
    skip(r.id, key);
    haptic.tap();
    toast(`Saltaremos la entrega del ${nextRunLabel(next, now).toLowerCase()}`, {
      icon: 'debug-step-over',
      action: { label: 'Deshacer', onPress: () => unskip(r.id, key) },
    });
  };

  return (
    <Card style={[styles.card, !r.active && { opacity: 0.75 }]}>
      <Row style={{ gap: space.md }}>
        <View style={styles.icon}>
          <Icon name={r.icon} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="labelLg" numberOfLines={1}>
            {r.name}
          </Txt>
          <Txt variant="bodySm" color={colors.textMuted}>
            {daysLabel(r.days)} • {timeLabel(r.time)}
          </Txt>
        </View>
        <Switch
          value={r.active}
          onValueChange={() => {
            toggle(r.id);
            haptic.tap();
          }}
          trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
          thumbColor={colors.white}
          accessibilityLabel={r.active ? `Pausar ${r.name}` : `Activar ${r.name}`}
        />
      </Row>

      <View style={[styles.next, !next && { backgroundColor: colors.surfaceMid }]}>
        <Icon name={next ? 'calendar-clock' : 'pause-circle-outline'} size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Txt variant="labelMd">{next ? `Próxima: ${nextRunLabel(next, now)}` : 'Rutina en pausa'}</Txt>
          <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
            {next ? `${countdownLabel(next, now)} • ` : ''}
            {destinationLabel(r, address?.label)}
          </Txt>
        </View>
      </View>

      <Txt variant="bodySm" color={colors.textMuted} numberOfLines={2}>
        {names}
      </Txt>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Txt variant="labelLg" color={colors.primary}>
            {money(totals.total)} por entrega
          </Txt>
          <Txt variant="bodySm" color={colors.textMuted}>
            ≈ {month.deliveries} entregas/mes • {money(month.total)}
          </Txt>
        </View>
        <Badge label={`+${totals.pointsEarned} pts`} tone="warning" icon="star-circle" />
      </Row>

      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <Button
          label="Saltar próxima"
          icon="debug-step-over"
          size="sm"
          variant="ghost"
          full={false}
          disabled={!next}
          onPress={skipNext}
        />
        <Button
          label="Editar"
          icon="pencil-outline"
          size="sm"
          variant="soft"
          full={false}
          onPress={() => router.push(`/rutinas/${r.id}`)}
        />
      </Row>
      <DemoOnly>
        <Button
          label={`Simular disparo de las ${timeLabel(r.time)}`}
          icon="lightning-bolt"
          variant="outline"
          size="sm"
          onPress={() => {
            haptic.success();
            runRoutineWithNotice(r, { simulated: true });
          }}
        />
      </DemoOnly>
    </Card>
  );
}

/** Tarjeta del Inicio: próxima entrega Auto-Pilot o invitación a crear una rutina. */
export function AutoPilotHomeCard() {
  const routines = useRoutines((s) => s.routines);
  const now = useNow(60_000);
  const upcoming = routines
    .map((r) => ({ r, at: nextRun(r, now) }))
    .filter((x): x is { r: Routine; at: Date } => !!x.at)
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

  if (!upcoming) {
    return (
      <Tap
        onPress={() => router.push('/rutinas')}
        style={styles.homeWrap}
        pressedStyle={{ opacity: 0.9 }}
        accessibilityLabel="Crea tu rutina Tambo Auto-Pilot"
      >
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.homeCard}
        >
          <View style={styles.homeIcon}>
            <Icon name={AUTOPILOT_ICON} size={24} color={colors.onGold} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelLg" color={colors.white}>
              Tambo Auto-Pilot
            </Txt>
            <Txt variant="bodySm" color="rgba(255,255,255,0.85)">
              Programa tu desayuno o tu agua de cada día. {AUTOPILOT_BENEFIT}.
            </Txt>
          </View>
          <Icon name="chevron-right" size={24} color={colors.white} />
        </LinearGradient>
      </Tap>
    );
  }

  const { r, at } = upcoming;
  return (
    <Tap
      onPress={() => router.push('/rutinas')}
      style={styles.homeWrap}
      pressedStyle={{ opacity: 0.9 }}
      accessibilityLabel={`Próxima entrega Auto-Pilot: ${nextRunLabel(at, now)}, ${r.name}`}
    >
      <Card style={styles.homeNext}>
        <View style={[styles.homeIcon, { backgroundColor: colors.primarySoft }]}>
          <Icon name={AUTOPILOT_ICON} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="labelSm" color={colors.primary} style={{ textTransform: 'uppercase' }}>
            Auto-Pilot • {countdownLabel(at, now)}
          </Txt>
          <Txt variant="labelLg" numberOfLines={1}>
            Próxima: {nextRunLabel(at, now)}
          </Txt>
          <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1}>
            {r.name}
            {routines.length > 1 ? ` • ${routines.length} rutinas` : ''}
          </Txt>
        </View>
        <Icon name="chevron-right" size={22} color={colors.textMuted} />
      </Card>
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
  },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  homeWrap: { marginHorizontal: space.lg, marginTop: space.lg },
  homeCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.xl },
  homeNext: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  homeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
