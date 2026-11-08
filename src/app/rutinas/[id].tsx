import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { RadioCard, ScreenHeader, SearchBar, TextField } from '@/components/layout';
import { ProductImage, QuantityStepper } from '@/components/product';
import { AUTOPILOT_BENEFIT, AUTOPILOT_ICON, DayPicker } from '@/components/routines';
import { Sheet } from '@/components/Sheet';
import { SummaryRow } from '@/components/summary';
import { Badge, Button, Card, Chip, Divider, IconButton, Row, Tap, Txt } from '@/components/ui';
import { getProduct, searchProducts } from '@/data/products';
import { stores } from '@/data/stores';
import { haptic } from '@/lib/feedback';
import { money } from '@/lib/format';
import { pts } from '@/lib/points';
import {
  DAY_PRESETS,
  monthlyEstimate,
  nextRun,
  nextRunLabel,
  ROUTINE_TEMPLATES,
  routineTotals,
  TIME_OPTIONS,
  timeLabel,
} from '@/lib/routines';
import { useCart, type CartItem } from '@/store/cart';
import { useNow } from '@/store/orders';
import { useRoutine, useRoutines, type Routine } from '@/store/routines';
import { useSession } from '@/store/session';
import { toast, useUi } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

type Draft = Omit<Routine, 'id' | 'createdAt' | 'skipDates' | 'active' | 'lastRunDate'>;

/** Ítems del carrito sin canjes ni duplicados (los canjes no se repiten automáticamente). */
const fromCart = (items: CartItem[]) => {
  const qty = new Map<string, number>();
  for (const i of items) qty.set(i.productId, (qty.get(i.productId) ?? 0) + i.qty);
  return [...qty].map(([productId, q]) => ({ productId, qty: q }));
};

export default function RoutineEditorScreen() {
  const { id, plantilla, desde } = useLocalSearchParams<{ id: string; plantilla?: string; desde?: string }>();
  const insets = useSafeAreaInsets();
  const existing = useRoutine(id === 'nueva' ? undefined : id);
  const save = useRoutines((s) => s.save);
  const remove = useRoutines((s) => s.remove);
  const addresses = useSession((s) => s.addresses);
  const cards = useSession((s) => s.cards);
  const phone = useSession((s) => s.profile.phone);
  const creating = !existing;

  const [draft, setDraft] = useState<Draft>(() => {
    if (existing) return existing;
    const s = useSession.getState();
    const base: Draft = {
      name: '',
      icon: 'calendar-sync',
      items: [],
      days: [1, 2, 3, 4, 5],
      time: '07:00',
      fulfillment: s.fulfillment,
      addressId: s.addressId,
      storeId: s.storeId,
      pickupMethod: 'locker',
      payment: 'yape',
    };
    const template = ROUTINE_TEMPLATES.find((t) => t.key === plantilla);
    if (template) return template.build({ addresses: s.addresses, storeId: s.storeId });
    if (desde === 'carrito') return { ...base, name: 'Mi pedido de siempre', items: fromCart(useCart.getState().items) };
    return base;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setQty = (productId: string, qty: number) =>
    set(
      'items',
      qty <= 0
        ? draft.items.filter((i) => i.productId !== productId)
        : draft.items.some((i) => i.productId === productId)
          ? draft.items.map((i) => (i.productId === productId ? { ...i, qty } : i))
          : [...draft.items, { productId, qty }],
    );

  const preview: Routine = {
    ...draft,
    id: existing?.id ?? 'preview',
    createdAt: existing?.createdAt ?? 0,
    skipDates: existing?.skipDates ?? [],
    active: true,
  };
  const now = useNow(30_000);
  const totals = routineTotals(draft);
  const month = monthlyEstimate(preview, now);
  const next = nextRun(preview, now);
  const hasAlcohol = draft.items.some((i) => getProduct(i.productId)?.alcoholic);

  const errors = {
    name: draft.name.trim().length < 3 ? 'Ponle un nombre (ej. Desayuno oficina).' : undefined,
    items: draft.items.length === 0 ? 'Agrega al menos un producto.' : undefined,
    days: draft.days.length === 0 ? 'Elige al menos un día.' : undefined,
    address:
      draft.fulfillment === 'delivery' && !addresses.some((a) => a.id === draft.addressId)
        ? 'Elige una dirección de entrega.'
        : undefined,
  };

  const commit = () => {
    const routine: Routine = {
      ...draft,
      name: draft.name.trim(),
      id: existing?.id ?? `rut-${Date.now()}`,
      createdAt: existing?.createdAt ?? Date.now(),
      skipDates: existing?.skipDates ?? [],
      lastRunDate: existing?.lastRunDate,
      active: existing?.active ?? true,
    };
    save(routine);
    haptic.success();
    const upcoming = nextRun(routine, Date.now());
    toast(
      `${creating ? 'Rutina activada' : 'Rutina actualizada'}${upcoming ? ` • próxima: ${nextRunLabel(upcoming, Date.now())}` : ''}`,
      { icon: AUTOPILOT_ICON, tone: 'success' },
    );
    router.back();
  };

  const submit = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      haptic.warning();
      toast('Revisa los datos marcados en rojo', { tone: 'error' });
      return;
    }
    // Las rutinas con alcohol verifican la edad al crearlas, no en cada entrega automática.
    if (hasAlcohol && !useSession.getState().ageVerified) useUi.getState().openAgeGate(commit);
    else commit();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        kicker="Tambo Auto-Pilot"
        title={creating ? 'Nueva rutina' : 'Editar rutina'}
        right={
          !creating ? (
            <IconButton icon="trash-can-outline" label="Eliminar rutina" color={colors.white} onPress={() => setDeleteOpen(true)} />
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
        <Row style={styles.benefit}>
          <Icon name="creation" size={20} color={colors.goldText} />
          <Txt variant="labelMd" color={colors.goldText} style={{ flex: 1 }}>
            Beneficio Auto-Pilot: {AUTOPILOT_BENEFIT}
          </Txt>
        </Row>

        {creating && (
          <View style={{ gap: space.sm }}>
            <Txt variant="labelLg">Plantillas en 1 toque</Txt>
            <Row style={{ flexWrap: 'wrap' }}>
              {ROUTINE_TEMPLATES.map((t) => (
                <Chip
                  key={t.key}
                  label={t.label}
                  onPress={() => {
                    const s = useSession.getState();
                    setDraft(t.build({ addresses: s.addresses, storeId: s.storeId }));
                    haptic.tap();
                  }}
                />
              ))}
            </Row>
          </View>
        )}

        <Card style={styles.block}>
          <TextField
            label="Nombre de la rutina"
            icon="tag-outline"
            placeholder="Ej. Desayuno oficina 7 AM"
            value={draft.name}
            onChangeText={(t) => set('name', t)}
            error={submitted ? errors.name : undefined}
          />
        </Card>

        <Card style={styles.block}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="labelLg">Productos</Txt>
            <Button label="Agregar" icon="plus" size="sm" variant="soft" full={false} onPress={() => setPickerOpen(true)} />
          </Row>
          {draft.items.map((i) => {
            const p = getProduct(i.productId);
            if (!p) return null;
            return (
              <Row key={i.productId} style={{ gap: space.md }}>
                <ProductImage product={p} size={44} rounded={radius.md} />
                <View style={{ flex: 1 }}>
                  <Txt variant="labelMd" numberOfLines={2}>
                    {p.name}
                  </Txt>
                  <Txt variant="bodySm" color={colors.textMuted}>
                    {money(p.price)}
                  </Txt>
                </View>
                <QuantityStepper value={i.qty} onChange={(n) => setQty(i.productId, n)} size="sm" trashAtMin />
              </Row>
            );
          })}
          {submitted && errors.items && (
            <Txt variant="bodySm" color={colors.error}>
              {errors.items}
            </Txt>
          )}
          {hasAlcohol && (
            <Txt variant="bodySm" color={colors.textMuted}>
              Incluye alcohol: verificaremos tu mayoría de edad al guardar.
            </Txt>
          )}
        </Card>

        <Card style={styles.block}>
          <Txt variant="labelLg">¿Qué días?</Txt>
          <DayPicker value={draft.days} onChange={(d) => set('days', d)} />
          <Row style={{ flexWrap: 'wrap' }}>
            {DAY_PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                active={[...p.days].sort().join() === [...draft.days].sort().join()}
                onPress={() => set('days', p.days)}
              />
            ))}
          </Row>
          {submitted && errors.days && (
            <Txt variant="bodySm" color={colors.error}>
              {errors.days}
            </Txt>
          )}
          <Divider />
          <Txt variant="labelLg">¿A qué hora?</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {TIME_OPTIONS.map((t) => (
              <Chip key={t} label={timeLabel(t)} active={draft.time === t} onPress={() => set('time', t)} />
            ))}
          </ScrollView>
        </Card>

        <Card style={styles.block}>
          <Txt variant="labelLg">¿Dónde lo recibes?</Txt>
          <RadioCard
            selected={draft.fulfillment === 'delivery'}
            onPress={() => set('fulfillment', 'delivery')}
            title="Delivery"
            subtitle="Te lo llevamos a la hora exacta"
            icon="moped-outline"
          />
          {draft.fulfillment === 'delivery' && (
            <Row style={{ flexWrap: 'wrap' }}>
              {addresses.map((a) => (
                <Chip key={a.id} label={`${a.label}: ${a.line1}`} active={draft.addressId === a.id} onPress={() => set('addressId', a.id)} />
              ))}
            </Row>
          )}
          <RadioCard
            selected={draft.fulfillment === 'pickup'}
            onPress={() => set('fulfillment', 'pickup')}
            title="Para llevar"
            subtitle="Listo a la hora en tu Smart Locker o en caja"
            icon="locker-multiple"
          />
          {draft.fulfillment === 'pickup' && (
            <View style={{ gap: space.sm }}>
              <Row style={{ flexWrap: 'wrap' }}>
                {stores.map((s) => (
                  <Chip key={s.id} label={s.name} active={draft.storeId === s.id} onPress={() => set('storeId', s.id)} />
                ))}
              </Row>
              <Row>
                <Chip label="Smart Locker" active={draft.pickupMethod === 'locker'} onPress={() => set('pickupMethod', 'locker')} />
                <Chip label="Mostrador" active={draft.pickupMethod === 'counter'} onPress={() => set('pickupMethod', 'counter')} />
              </Row>
            </View>
          )}
          {submitted && errors.address && (
            <Txt variant="bodySm" color={colors.error}>
              {errors.address}
            </Txt>
          )}
        </Card>

        <Card style={styles.block}>
          <Txt variant="labelLg">Pago automático</Txt>
          <RadioCard
            selected={draft.payment === 'yape'}
            onPress={() => set('payment', 'yape')}
            title="Yape Auto-Pay"
            subtitle={`Cobro automático a ${phone}`}
            icon="cellphone-check"
          />
          {cards[0] && (
            <RadioCard
              selected={draft.payment === 'card'}
              onPress={() => set('payment', 'card')}
              title={`Tarjeta ${cards[0].brand} •••• ${cards[0].last4}`}
              subtitle="Cobro automático en cada entrega"
              icon="credit-card-outline"
            />
          )}
          <RadioCard
            selected={draft.payment === 'points'}
            onPress={() => set('payment', 'points')}
            title="Tambo Lover Puntos"
            subtitle="Usa tu saldo; si no alcanza, el resto va por Yape Auto-Pay"
            icon="star-circle"
          />
        </Card>

        <Card style={styles.block}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="labelLg">Cada entrega</Txt>
            <Badge label="Auto-Pilot" tone="soft" icon={AUTOPILOT_ICON} />
          </Row>
          <SummaryRow label="Productos" value={money(totals.subtotal)} />
          {totals.routineDiscount > 0 && (
            <SummaryRow label="Beneficio Auto-Pilot (10%)" value={`- ${money(totals.routineDiscount)}`} tone="discount" icon="sale" />
          )}
          <SummaryRow
            label={draft.fulfillment === 'delivery' ? 'Delivery' : 'Para llevar'}
            value="Gratis"
            tone="success"
            icon={draft.fulfillment === 'delivery' ? 'moped-outline' : 'storefront-outline'}
          />
          <Divider dashed />
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="headlineMd">Total por entrega</Txt>
            <Txt variant="headlineMd" color={colors.primary}>
              {money(totals.total)}
            </Txt>
          </Row>
          <Txt variant="bodySm" color={colors.goldText}>
            Sumas {pts(totals.pointsEarned)} por entrega (puntos dobles).
          </Txt>
          <Txt variant="bodySm" color={colors.textMuted}>
            ≈ {month.deliveries} entregas en los próximos 30 días • {money(month.total)}
            {next ? ` • primera: ${nextRunLabel(next, now)}` : ''}
          </Txt>
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Button label={creating ? 'Activar rutina' : 'Guardar cambios'} icon={AUTOPILOT_ICON} size="lg" onPress={submit} />
      </View>

      <ProductPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={draft.items}
        onAdd={(productId) => {
          const current = draft.items.find((i) => i.productId === productId)?.qty ?? 0;
          setQty(productId, current + 1);
          haptic.tap();
        }}
      />
      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="¿Eliminar rutina?" subtitle={draft.name}>
        <View style={{ gap: space.md }}>
          <Txt variant="bodyMd" color={colors.textMuted}>
            Dejaremos de programar estas entregas. Los pedidos que ya se generaron no cambian.
          </Txt>
          <Button
            label="Sí, eliminar"
            variant="danger"
            icon="trash-can-outline"
            onPress={() => {
              if (existing) remove(existing.id);
              setDeleteOpen(false);
              toast('Rutina eliminada', { icon: 'trash-can-outline' });
              router.back();
            }}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setDeleteOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}

function ProductPicker({
  visible,
  onClose,
  selected,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  selected: CartItem[];
  onAdd: (productId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchProducts(query).slice(0, 30), [query]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Agregar productos" subtitle="Toca + para sumarlo a tu rutina">
      <View style={{ gap: space.sm }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar café, agua, pan…" />
        {results.map((p) => {
          const qty = selected.find((i) => i.productId === p.id)?.qty ?? 0;
          return (
            <Tap key={p.id} onPress={() => onAdd(p.id)} style={styles.pickRow} accessibilityLabel={`Agregar ${p.name}`}>
              <ProductImage product={p} size={40} rounded={radius.md} />
              <View style={{ flex: 1 }}>
                <Txt variant="labelMd" numberOfLines={1}>
                  {p.name}
                </Txt>
                <Txt variant="bodySm" color={colors.textMuted}>
                  {money(p.price)}
                </Txt>
              </View>
              {qty > 0 && <Badge label={`x${qty}`} tone="soft" />}
              <Icon name="plus-circle" size={26} color={colors.primary} />
            </Tap>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  block: { padding: space.lg, gap: space.md },
  benefit: { gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldSoft },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
