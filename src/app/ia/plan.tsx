import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AI_ICON } from '@/components/ai';
import { Icon } from '@/components/Icon';
import { ScreenHeader, TextField } from '@/components/layout';
import { ProductImage, QuantityStepper } from '@/components/product';
import { Slider } from '@/components/slider';
import { Badge, Button, Card, Chip, Divider, Row, Tap, Txt } from '@/components/ui';
import { getProduct } from '@/data/products';
import {
  aiIntentConfigured,
  INTENT_MAX_CHARS,
  interpretIntent,
  IntentError,
  type Intent,
} from '@/lib/aiIntent';
import { haptic } from '@/lib/feedback';
import { money } from '@/lib/format';
import {
  buildPlan,
  slotOptions,
  vibeHasAlcohol,
  VIBES,
  type Plan,
  type PlanConstraints,
  type PlanParams,
  type Vibe,
} from '@/lib/recommender';
import { useAddManyToCart } from '@/lib/useAddManyToCart';
import { useCartCount } from '@/store/cart';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

const BUDGET = { min: 10, max: 100, step: 5 };
const PEOPLE = { min: 1, max: 6 };
/** Pausa breve para que se note el cálculo (sin fingir una latencia larga). */
const THINK_MS = 600;
/** `noAlcoholFor` igual o mayor que el grupo = nadie toma. */
const ALL_SOBER = 99;

const EXAMPLES = [
  'Somos 4, vamos a ver el partido, tenemos 50 soles y uno no toma alcohol',
  'Noche de estudio para 2 con S/ 25 y algo caliente',
  'Desayuno vegetariano para 3, máximo S/ 30',
];

type ToggleKey = 'vegetarian' | 'sweet' | 'hotDrinks';
const TOGGLES: { key: ToggleKey; label: string }[] = [
  { key: 'vegetarian', label: 'Vegetariano' },
  { key: 'sweet', label: 'Algo dulce' },
  { key: 'hotDrinks', label: 'Bebida caliente' },
];

const sober = (c: PlanConstraints, people: number) => Math.min(c.noAlcoholFor ?? 0, people);
const soberLabel = (c: PlanConstraints, people: number) => {
  const n = sober(c, people);
  return n >= people ? 'Sin alcohol (todos)' : `Sin alcohol para ${n}`;
};
/** Ciclo del chip: apagado → 1 → … → todos → apagado. */
const nextSober = (c: PlanConstraints, people: number) => {
  const n = sober(c, people);
  if (n >= people) return 0;
  return n + 1 >= people ? ALL_SOBER : n + 1;
};
const personas = (n: number) => (n === 1 ? '1 persona' : `${n} personas`);
const keyOf = (p: PlanParams) => JSON.stringify(p);

export default function AiPlanScreen() {
  const insets = useSafeAreaInsets();
  const addMany = useAddManyToCart();
  const cartCount = useCartCount();
  const [budget, setBudget] = useState(35);
  const [people, setPeople] = useState(3);
  const [vibe, setVibe] = useState<Vibe>('patas');
  const [constraints, setConstraints] = useState<PlanConstraints>({});
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(false);
  /** El formulario se llenó con lo que entendió Tambo IA (se muestran los chips "Entendí"). */
  const [fromAi, setFromAi] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [plan, setPlan] = useState<Plan>();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [planKey, setPlanKey] = useState('');
  const params: PlanParams = { budget, people, vibe, constraints };
  const currentKey = keyOf(params);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useRef(true);
  const scroll = useRef<ScrollViewInstance>(null);
  const formY = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const generate = (p: PlanParams = params, delay = THINK_MS) => {
    setThinking(true);
    setPlan(undefined);
    setOverrides({});
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPlan(buildPlan(p));
      setPlanKey(keyOf(p));
      setThinking(false);
      haptic.success();
    }, delay);
  };

  const toForm = () => scroll.current?.scrollTo({ y: Math.max(0, formY.current - space.md), animated: true });

  /** Aplica lo que entendió Tambo IA al formulario (ajustado a sus rangos) y arma el plan. */
  const apply = (intent: Intent) => {
    const adjusted: string[] = [];
    let b = intent.budget ?? budget;
    if (b > BUDGET.max || b < BUDGET.min) {
      b = Math.min(BUDGET.max, Math.max(BUDGET.min, b));
      adjusted.push(`el presupuesto a ${money(b)}`);
    }
    let n = intent.people ?? people;
    if (n > PEOPLE.max) {
      n = PEOPLE.max;
      adjusted.push(`el grupo a ${personas(n)}`);
    }
    const next: PlanParams = {
      budget: b,
      people: n,
      vibe: intent.vibe ?? vibe,
      constraints: intent.constraints,
    };
    setBudget(next.budget);
    setPeople(next.people);
    setVibe(next.vibe);
    setConstraints(intent.constraints);
    setFromAi(true);
    generate(next, 0);
    if (adjusted.length)
      toast(`Ajustamos ${adjusted.join(' y ')}, el máximo del plan`, { icon: 'information-outline' });
  };

  const ask = async (input?: string) => {
    const value = (input ?? text).trim();
    if (!value || asking) return;
    if (input) setText(input);
    Keyboard.dismiss();
    setAsking(true);
    try {
      const intent = await interpretIntent(value);
      if (mounted.current) apply(intent);
    } catch (e) {
      if (!mounted.current) return;
      const reason = e instanceof IntentError ? e.reason : 'invalid';
      haptic.warning();
      if (reason === 'irrelevant') {
        toast('No entendí qué plan necesitas. Prueba con uno de los ejemplos.', {
          icon: 'help-circle-outline',
        });
        return;
      }
      // Sin red, timeout, proxy sin configurar o respuesta inválida: queda el formulario de siempre.
      toast(
        reason === 'rate'
          ? 'Muchas consultas seguidas: usamos el modo sin conexión'
          : 'Usamos el modo sin conexión',
        {
          icon: 'wifi-off',
        },
      );
      setFromAi(false);
      toForm();
    } finally {
      if (mounted.current) setAsking(false);
    }
  };

  /** "Cambiar": prueba la siguiente opción del espacio que entre en el presupuesto. */
  const swap = (slotKey: string, currentId: string) => {
    const options = slotOptions(params, slotKey);
    let i = options.indexOf(currentId);
    for (let tries = 1; tries < options.length; tries++) {
      i = (i + 1) % options.length;
      const candidate = options[i];
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

  const setConstraint = (patch: PlanConstraints) => setConstraints((c) => ({ ...c, ...patch }));
  const showSober = vibeHasAlcohol(vibe);
  const changed = !!plan && !thinking && planKey !== currentKey;

  /**
   * Lo que entendió Tambo IA, con los valores actuales. Tocar un dato lleva al formulario para
   * corregirlo; tocar una preferencia la quita (`remove`).
   */
  const understood: { key: string; label: string; remove?: PlanConstraints }[] = [
    { key: 'budget', label: money(budget) },
    { key: 'people', label: personas(people) },
    { key: 'vibe', label: VIBES[vibe].label },
    ...(showSober && sober(constraints, people) > 0
      ? [{ key: 'sober', label: soberLabel(constraints, people), remove: { noAlcoholFor: 0 } }]
      : []),
    ...TOGGLES.filter((t) => constraints[t.key]).map((t) => ({
      key: t.key,
      label: t.label,
      remove: { [t.key]: false },
    })),
    ...(constraints.maxItems
      ? [{ key: 'max', label: `Máx. ${constraints.maxItems} productos`, remove: { maxItems: undefined } }]
      : []),
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader kicker="Tambo IA" title="Arma tu plan" />
      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.block}>
          <Row style={{ gap: space.sm }}>
            <Icon name={AI_ICON} size={20} color={colors.primary} />
            <Txt variant="labelLg">Cuéntale a Tambo IA qué necesitas</Txt>
          </Row>
          <TextField
            value={text}
            onChangeText={setText}
            placeholder="Cuéntale a Tambo IA qué necesitas…"
            accessibilityLabel="Describe tu plan"
            multiline
            maxLength={INTENT_MAX_CHARS}
          />
          <Button
            label="Armar con Tambo IA"
            icon={AI_ICON}
            variant="brand"
            loading={asking}
            disabled={!text.trim()}
            onPress={() => ask()}
          />
          <Txt variant="labelSm" color={colors.textMuted}>
            PRUEBA CON
          </Txt>
          {EXAMPLES.map((example) => (
            <Tap
              key={example}
              onPress={() => ask(example)}
              disabled={asking}
              style={styles.example}
              accessibilityLabel={`Ejemplo: ${example}`}
            >
              <Icon name="message-text-outline" size={16} color={colors.primary} />
              <Txt variant="bodySm" style={{ flex: 1 }}>
                {example}
              </Txt>
            </Tap>
          ))}
        </Card>

        {asking && (
          <Animated.View entering={FadeIn} style={styles.thinking}>
            <ActivityIndicator color={colors.primary} />
            <Txt variant="bodyMd" color={colors.textMuted}>
              Tambo IA está entendiendo tu pedido…
            </Txt>
          </Animated.View>
        )}

        {fromAi && !asking && (
          <Animated.View entering={FadeInDown}>
            <Card style={[styles.block, { borderColor: colors.primary }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="labelLg">Tambo IA entendió</Txt>
                <Badge label="Revisa" tone="promo" icon="pencil-outline" />
              </Row>
              <View style={styles.chips}>
                {understood.map((c) => (
                  <Chip
                    key={c.key}
                    label={c.remove ? `${c.label} ✕` : c.label}
                    active
                    onPress={() => (c.remove ? setConstraint(c.remove) : toForm())}
                  />
                ))}
              </View>
              <Txt variant="bodySm" color={colors.textMuted}>
                Toca un dato para corregirlo abajo o una preferencia para quitarla. Los productos y precios
                los elige el catálogo, no la IA.
              </Txt>
            </Card>
          </Animated.View>
        )}

        <Row style={{ gap: space.sm }}>
          <View style={styles.rule} />
          <Txt variant="labelMd" color={colors.textMuted}>
            {fromAi ? 'o corrige tu plan aquí' : 'o arma tu plan manualmente'}
          </Txt>
          <View style={styles.rule} />
        </Row>

        <View onLayout={(e) => (formY.current = e.nativeEvent.layout.y)}>
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
                  De {PEOPLE.min} a {PEOPLE.max} personas
                </Txt>
              </View>
              <QuantityStepper value={people} onChange={setPeople} min={PEOPLE.min} max={PEOPLE.max} />
            </Row>
          </Card>
        </View>

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

        <Txt variant="labelLg">Preferencias</Txt>
        <View style={styles.chips}>
          {showSober && (
            <Chip
              label={sober(constraints, people) > 0 ? soberLabel(constraints, people) : 'Sin alcohol'}
              active={sober(constraints, people) > 0}
              onPress={() => setConstraint({ noAlcoholFor: nextSober(constraints, people) })}
            />
          )}
          {TOGGLES.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              active={!!constraints[t.key]}
              onPress={() => setConstraint({ [t.key]: !constraints[t.key] })}
            />
          ))}
          {!!constraints.maxItems && (
            <Chip
              label={`Máx. ${constraints.maxItems} productos ✕`}
              active
              onPress={() => setConstraint({ maxItems: undefined })}
            />
          )}
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
                  Con {money(budget)} no alcanza para {personas(people)} en “{VIBES[vibe].label}”. Con{' '}
                  {money(plan.minBudget - budget)} más armamos tu plan.
                </Txt>
              </Row>
              <Button
                label={`Usar ${money(plan.minBudget)}`}
                variant="outline"
                onPress={() => {
                  const b = Math.min(BUDGET.max, Math.ceil(plan.minBudget / BUDGET.step) * BUDGET.step);
                  setBudget(b);
                  generate({ ...params, budget: b });
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
                          <Txt
                            variant="labelSm"
                            color={colors.primary}
                            style={{ textDecorationLine: 'underline' }}
                          >
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
                <View
                  style={[styles.fill, { width: `${Math.min(100, (plan.total / plan.budget) * 100)}%` }]}
                />
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
              <Button
                label="Ver carrito"
                variant="outline"
                icon="cart-outline"
                onPress={() => router.push('/carrito')}
              />
            )}
          </Animated.View>
        )}

        <Row style={{ gap: 6, alignItems: 'flex-start' }}>
          <Icon name="shield-lock-outline" size={16} color={colors.textMuted} />
          <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
            {aiIntentConfigured
              ? 'Si escribes tu pedido, solo ese texto viaja a Tambo IA (Gemini) para entenderlo. Los productos y precios se calculan en tu teléfono con el catálogo.'
              : 'El plan se calcula en tu teléfono con precios y promos reales del catálogo. No enviamos tus datos.'}
          </Txt>
        </Row>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  block: { padding: space.lg, gap: space.md },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
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
