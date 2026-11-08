import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import type { OrderSplit } from '@/data/types';
import { money, round2 } from '@/lib/format';
import type { CartLine } from '@/lib/pricing';
import { splitByItems, splitEqual } from '@/lib/split';
import { toast } from '@/store/ui';
import { useDemo } from '@/store/demo';
import { colors, radius, space } from '@/theme/tokens';
import { DemoOnly } from './DemoOnly';
import { TextField } from './layout';
import { Button, Chip, IconButton, Row, Txt } from './ui';

/** Actualiza importes y descarta autorizaciones si cambió el contexto del cobro. */
export function recalculateSplit(
  draft: OrderSplit | undefined,
  lines: CartLine[],
  total: number,
  shipping: number,
  method: 'yape' | 'card',
  keepPayments: boolean,
): OrderSplit {
  const n = draft?.participants.length ?? 2;
  const assignment = lines.map((_, i) => Math.min(draft?.assignment?.[i] ?? 0, n - 1));
  const mode = draft?.mode ?? 'equal';
  const amounts = mode === 'equal' ? splitEqual(total, n) : splitByItems(lines, assignment, shipping, n, total);
  return {
    mode,
    assignment: mode === 'items' ? assignment : undefined,
    participants: amounts.map((amount, i) => ({
      name: i === 0 ? 'Tú (anfitrión)' : draft?.participants[i]?.name ?? `Amigo ${i}`,
      amount,
      method: i === 0 ? method : 'yape',
      paid: amount === 0 || (keepPayments && !!draft?.participants[i]?.paid),
    })),
  };
}

export function PartySplit({
  value, onChange, lines, total, shipping, hostReady, disabled,
}: {
  value: OrderSplit;
  onChange: (split: OrderSplit) => void;
  lines: CartLine[];
  total: number;
  shipping: number;
  hostReady: boolean;
  disabled: boolean;
}) {
  const n = value.participants.length;
  const method = value.participants[0].method;
  const demoEnabled = useDemo((s) => s.enabled);
  const [simulating, setSimulating] = useState(false);
  if (simulating && (!demoEnabled || disabled)) setSimulating(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  useEffect(() => () => timers.current.forEach(clearTimeout), [demoEnabled, disabled]);
  const update = (draft: OrderSplit) => {
    timers.current.forEach(clearTimeout);
    setSimulating(false);
    onChange(recalculateSplit(draft, lines, total, shipping, method, false));
  };
  const paid = value.participants.filter((p) => p.paid);
  const paidTotal = round2(paid.reduce((sum, p) => sum + p.amount, 0));
  const progress = `${paid.length} de ${n} pagaron · ${money(paidTotal)} / ${money(total)}`;
  const simulate = () => {
    if (simulating || disabled) return;
    setSimulating(true);
    const pending = value.participants.flatMap((p, i) => i > 0 && !p.paid ? [i] : []);
    timers.current = pending.map((participant, i) => setTimeout(() => {
      onChange({
        ...latest.current,
        participants: latest.current.participants.map((p, j) => j === participant ? { ...p, paid: true } : p),
      });
      if (i === pending.length - 1) setSimulating(false);
    }, 800 * (i + 1)));
  };

  return (
    <View style={styles.body}>
      <Txt variant="bodySm" color={colors.textMuted}>
        Demo sin cobros reales. Compartir una solicitud no confirma un pago. Tu parte se autoriza con el método elegido.
      </Txt>
      <Row style={styles.wrap}>
        <Chip label="Partes iguales" active={value.mode === 'equal'}
          onPress={() => !disabled && update({ ...value, mode: 'equal' })} />
        <Chip label="Por producto" active={value.mode === 'items'}
          onPress={() => !disabled && update({ ...value, mode: 'items' })} />
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="labelMd">{n} personas</Txt>
        <Row>
          <IconButton icon="minus" label="Quitar participante" disabled={disabled || n <= 2}
            onPress={() => update({ ...value, participants: value.participants.slice(0, -1) })} />
          <IconButton icon="plus" label="Agregar participante" disabled={disabled || n >= 5}
            onPress={() => update({ ...value, participants: [...value.participants,
              { name: `Amigo ${n}`, amount: 0, method: 'yape', paid: false }] })} />
        </Row>
      </Row>
      {value.mode === 'items' && (
        <>
          <Txt variant="bodySm" color={colors.textMuted}>
            Asigna cada línea completa. El envío se divide por igual; cupón y puntos se prorratean entre productos.
          </Txt>
          {lines.map((line, index) => (
            <View key={`${line.product.id}-${line.redeem ?? 'cash'}`} style={styles.line}>
              <Txt variant="labelMd">{line.qty} × {line.product.name}</Txt>
              <Row style={styles.wrap}>
                {value.participants.map((p, i) => (
                  <Chip key={i} label={`${i === 0 ? '👤' : '👥'} ${p.name || `Amigo ${i}`}`}
                    active={value.assignment?.[index] === i}
                    onPress={() => {
                      if (disabled) return;
                      const assignment = [...(value.assignment ?? lines.map(() => 0))];
                      assignment[index] = i;
                      update({ ...value, assignment });
                    }} />
                ))}
              </Row>
            </View>
          ))}
        </>
      )}
      {value.participants.map((p, i) => (
        <View key={i} style={styles.person}>
          {i === 0 ? <Txt variant="labelLg">{p.name}</Txt> : (
            <TextField label={`Nombre del amigo ${i}`} value={p.name} maxLength={24} editable={!disabled}
              accessibilityLabel={`Nombre del amigo ${i}`}
              onChangeText={(name) => onChange({ ...value,
                participants: value.participants.map((person, j) => j === i ? { ...person, name } : person) })} />
          )}
          <Row style={styles.wrap}>
            <Txt variant="headlineMd" color={colors.primary}>{money(p.amount)}</Txt>
            <Txt variant="bodySm" color={p.paid ? colors.text : colors.textMuted}>
              {p.amount === 0 ? 'Sin saldo pendiente ✓' : p.paid
                ? `Pagado con ${p.method === 'card' ? 'tarjeta' : 'Yape'} ✓ (demo)` : 'Pago pendiente'}
            </Txt>
          </Row>
          {i === 0 && !p.paid && (
            <Button label={`Autorizar mi parte con ${method === 'card' ? 'tarjeta' : 'Yape'}`} variant="outline" multiline
              disabled={disabled || !hostReady} onPress={() => onChange({ ...value,
                participants: value.participants.map((person, j) => j === 0 ? { ...person, paid: true } : person) })} />
          )}
          {i === 0 && !hostReady && !p.paid && (
            <Txt variant="bodySm" color={colors.textMuted}>Completa los datos de tu medio de pago para autorizar tu parte.</Txt>
          )}
          {i > 0 && (
            <Button label="Enviar solicitud Yape" variant="outline" icon="share-variant-outline"
              disabled={disabled || p.paid} accessibilityLabel={`Enviar solicitud Yape a ${p.name} por ${money(p.amount)}`}
              onPress={async () => {
                try {
                  await Share.share({ title: 'Tambo Party Split',
                    message: `¡${p.name || `Amigo ${i}`}! Tu parte de la compra en Tambo es ${money(p.amount)}. Yapéale al anfitrión. Solicitud de demostración; no realiza cobros.` });
                } catch {
                  toast('No se pudo compartir. Prueba desde tu celular.', { tone: 'error' });
                }
              }} />
          )}
        </View>
      ))}
      <View accessible accessibilityRole="progressbar" accessibilityLabel={progress}
        accessibilityValue={{ min: 0, max: n, now: paid.length }} accessibilityLiveRegion="polite"
        style={styles.line}>
        <Txt variant="labelMd">{progress}</Txt>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${paid.length / n * 100}%` }]} />
        </View>
      </View>
      <DemoOnly>
        <Button label="⚡ Simular pagos Yape de amigos" variant="soft" loading={simulating} multiline
          disabled={disabled || value.participants.slice(1).every((p) => p.paid)} onPress={simulate} />
      </DemoOnly>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  wrap: { flexWrap: 'wrap' },
  line: { gap: space.sm },
  person: { padding: space.md, gap: space.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
  track: { height: space.sm, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
});
