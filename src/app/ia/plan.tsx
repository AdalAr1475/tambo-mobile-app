import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AI_ICON } from '@/components/ai';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/layout';
import { ProductImage, QuantityStepper } from '@/components/product';
import { Slider } from '@/components/slider';
import { Badge, Button, Card, Divider, Row, Tap, Txt } from '@/components/ui';
import { getProduct } from '@/data/products';
import { haptic } from '@/lib/feedback';
import { money } from '@/lib/format';
import { buildPlan, nextOption, VIBES, type Plan, type Vibe } from '@/lib/recommender';
import { useAddManyToCart } from '@/lib/useAddManyToCart';
import { useCartCount } from '@/store/cart';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

const BUDGET = { min: 10, max: 100, step: 5 };
/** Pausa breve para que se note el cálculo (sin fingir una latencia larga). */
const THINK_MS = 600;

export default function AiPlanScreen() {
  const insets = useSafeAreaInsets();
  const addMany = useAddManyToCart();
  const cartCount = useCartCount();
  const [budget, setBudget] = useState(35);
  const [people, setPeople] = useState(3);
  const [vibe, setVibe] = useState<Vibe>('patas');
  const [thinking, setThinking] = useState(false);
  const [plan, setPlan] = useState<Plan>();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [planKey, setPlanKey] = useState('');
  const params = { budget, people, vibe };
  const currentKey = `${budget}|${people}|${vibe}`;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const generate = (b = budget) => {
    setThinking(true);
    setPlan(undefined);
    setOverrides({});
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPlan(buildPlan({ budget: b, people, vibe }));
      setPlanKey(`${b}|${people}|${vibe}`);
      setThinking(false);
      haptic.success();
    }, THINK_MS);
  };

  /** "Cambiar": prueba la siguiente opción del espacio que entre en el presupuesto. */
  const swap = (slotKey: string, currentId: string) => {
    const options = VIBES[vibe].slots.find((s) => s.key === slotKey)?.options ?? [];
    let candidate = currentId;
    for (let i = 1; i < options.length; i++) {
      candidate = nextOption(vibe, slotKey, candidate) ?? candidate;
      const next = buildPlan(params, { ...overrides, [slotKey]: candidate });
      if (next.ok && next.total <= budget) {
        setOverrides((o) => ({ ...o, [slotKey]: candidate }));
        setPlan(next);
        haptic.tap();
        return;
      }
    }
    toast('No hay otra opción para eso dentro de tu presupuesto', { icon: 'information-outline' });
  };

  const changed = !!plan && !thinking && planKey !== currentKey;

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader kicker="Tambo IA" title="Arma tu plan" />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.block}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="labelLg">Presupuesto</Txt>
            <Txt variant="headlineMd" color={colors.primary}>
              {money(budget)}
            </Txt>
          </Row>
          <Slider
            value={budget}
            min={BUDGET.min}
            max={BUDGET.max}
            step={BUDGET.step}
            onChange={setBudget}
            accessibilityLabel="Presupuesto"
            accessibilityText={money(budget)}
          />
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="bodySm" color={colors.textMuted}>
              {money(BUDGET.min)}
            </Txt>
            <Txt variant="bodySm" color={colors.textMuted}>
              {money(BUDGET.max)}
            </Txt>
          </Row>
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Txt variant="labelLg">¿Cuántos son?</Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                De 1 a 6 personas
              </Txt>
            </View>
            <QuantityStepper value={people} onChange={setPeople} min={1} max={6} />
          </Row>
        </Card>

        <Txt variant="labelLg">¿Qué plan tienes?</Txt>
        <View style={styles.vibes}>
          {(Object.keys(VIBES) as Vibe[]).map((v) => {
            const active = v === vibe;
            return (
              <Tap
                key={v}
                onPress={() => setVibe(v)}
                style={[styles.vibe, active && styles.vibeActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={VIBES[v].label}
              >
                <Icon name={VIBES[v].icon} size={26} color={active ? colors.white : colors.primary} />
                <Txt variant="labelMd" color={active ? colors.white : colors.text} align="center">
                  {VIBES[v].label}
                </Txt>
              </Tap>
            );
          })}
        </View>

        <Button
          label={plan ? 'Generar de nuevo' : 'Generar combo IA'}
          icon={AI_ICON}
          size="lg"
          loading={thinking}
          onPress={() => generate()}
        />
        {changed && (
          <Txt variant="bodySm" color={colors.goldText} align="center">
            Cambiaste los datos: genera de nuevo para actualizar el plan.
          </Txt>
        )}

        {thinking && (
          <Animated.View entering={FadeIn} style={styles.thinking}>
            <ActivityIndicator color={colors.primary} />
            <Txt variant="bodyMd" color={colors.textMuted}>
              Comparando precios, promociones y porciones del catálogo…
            </Txt>
          </Animated.View>
        )}

        {plan && !plan.ok && (
          <Animated.View entering={FadeInDown}>
            <Card style={[styles.block, { borderColor: colors.goldBorder }]}>
              <Row style={{ gap: space.sm, alignItems: 'flex-start' }}>
                <Icon name="cash-remove" size={22} color={colors.goldText} />
                <Txt variant="bodyMd" style={{ flex: 1 }}>
                  Con {money(budget)} no alcanza para {people} {people === 1 ? 'persona' : 'personas'} en “
                  {VIBES[vibe].label}”. Con {money(plan.minBudget - budget)} más armamos tu plan.
                </Txt>
              </Row>
              <Button
                label={`Usar ${money(plan.minBudget)}`}
                variant="outline"
                onPress={() => {
                  const b = Math.min(BUDGET.max, Math.ceil(plan.minBudget / BUDGET.step) * BUDGET.step);
                  setBudget(b);
                  generate(b);
                }}
              />
            </Card>
          </Animated.View>
        )}

        {plan && plan.ok && (
          <Animated.View entering={FadeInDown} style={{ gap: space.md }}>
            <Card style={styles.block}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="headlineMd" style={{ fontSize: 17 }}>
                  Tu plan: {VIBES[vibe].label}
                </Txt>
                <Badge label="Tambo IA" tone="promo" icon={AI_ICON} />
              </Row>
              {plan.items.map((item) => {
                const p = getProduct(item.productId)!;
                return (
                  <Row key={item.slotKey} style={{ gap: space.md, alignItems: 'flex-start' }}>
                    <ProductImage product={p} size={52} rounded={radius.md} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="labelSm" color={colors.primary} style={{ textTransform: 'uppercase' }}>
                        {item.slotLabel}
                      </Txt>
                      <Txt variant="labelMd" numberOfLines={2}>
                        {item.qty} x {p.name}
                      </Txt>
                      {item.canSwap && (
                        <Tap
                          onPress={() => swap(item.slotKey, item.productId)}
                          hitSlop={8}
                          accessibilityLabel={`Cambiar ${item.slotLabel}`}
                        >
                          <Txt variant="labelSm" color={colors.primary} style={{ textDecorationLine: 'underline' }}>
                            Cambiar
                          </Txt>
                        </Tap>
                      )}
                    </View>
                    <Txt variant="labelLg">{money(item.cost)}</Txt>
                  </Row>
                );
              })}
              <Divider dashed />
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="headlineMd">Total del plan</Txt>
                <Txt variant="headlineMd" color={colors.primary}>
                  {money(plan.total)}
                </Txt>
              </Row>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(100, (plan.total / plan.budget) * 100)}%` }]} />
              </View>
              <Txt variant="bodySm" color={colors.textMuted}>
                {Math.round(plan.coverage * 100)}% del plan cubierto • te sobran {money(plan.remaining)} de{' '}
                {money(plan.budget)}
                {plan.regular > plan.total ? ` • ahorras ${money(plan.regular - plan.total)} en promos` : ''}
              </Txt>
              {plan.hasAlcohol && (
                <Txt variant="labelSm" color={colors.textSubtle}>
                  Incluye bebidas alcohólicas: solo para mayores de 18 años.
                </Txt>
              )}
            </Card>
            <Button
              label="Agregar todo al carrito"
              icon="cart-plus"
              variant="brand"
              size="lg"
              onPress={() =>
                addMany(
                  plan.items.map((i) => ({ productId: i.productId, qty: i.qty })),
                  { message: `Agregamos tu plan "${VIBES[vibe].label}" al carrito` },
                )
              }
            />
            {cartCount > 0 && (
              <Button label="Ver carrito" variant="outline" icon="cart-outline" onPress={() => router.push('/carrito')} />
            )}
          </Animated.View>
        )}

        <Row style={{ gap: 6, alignItems: 'flex-start' }}>
          <Icon name="shield-lock-outline" size={16} color={colors.textMuted} />
          <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
            El plan se calcula en tu teléfono con precios y promos reales del catálogo. No enviamos tus datos.
          </Txt>
        </Row>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  block: { padding: space.lg, gap: space.md },
  vibes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  vibe: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    gap: 6,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  vibeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.success },
});
