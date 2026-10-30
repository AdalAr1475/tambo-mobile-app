import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { RadioCard, ScreenHeader, TextField } from '@/components/layout';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, Card, IconButton, Row, Txt } from '@/components/ui';
import type { PaymentMethodType, SavedCard } from '@/data/types';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

const brandOf = (n: string): SavedCard['brand'] =>
  n.startsWith('4')
    ? 'Visa'
    : n.startsWith('5')
      ? 'Mastercard'
      : n.startsWith('34') || n.startsWith('37')
        ? 'Amex'
        : 'Diners';

export default function PaymentsScreen() {
  const cards = useSession((s) => s.cards);
  const preferred = useSession((s) => s.preferredPayment);
  const setPreferred = useSession((s) => s.setPreferredPayment);
  const addCard = useSession((s) => s.addCard);
  const deleteCard = useSession((s) => s.deleteCard);
  const phone = useSession((s) => s.profile.phone);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ number: '', expiry: '', holder: '' });
  const [touched, setTouched] = useState(false);

  const digits = form.number.replace(/\D/g, '');
  const [mm] = form.expiry.split('/').map(Number);
  const errors = {
    number: digits.length < 15 ? 'Número de tarjeta inválido.' : undefined,
    expiry: !/^\d{2}\/\d{2}$/.test(form.expiry) || mm < 1 || mm > 12 ? 'Usa el formato MM/AA.' : undefined,
    holder: form.holder.trim().length < 3 ? 'Ingresa el nombre del titular.' : undefined,
  };

  const save = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    addCard({
      id: `card-${Date.now()}`,
      brand: brandOf(digits),
      last4: digits.slice(-4),
      holder: form.holder.toUpperCase(),
      expiry: form.expiry,
    });
    setAdding(false);
    setForm({ number: '', expiry: '', holder: '' });
    setTouched(false);
    toast('Tarjeta agregada', { tone: 'success', icon: 'credit-card-check-outline' });
  };

  const choose = (m: PaymentMethodType, label: string) => {
    setPreferred(m);
    toast(`${label} será tu método preferido`, { icon: 'check' });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Métodos de pago" />
      <ScrollView contentContainerStyle={styles.body}>
        <Txt variant="labelSm" color={colors.textMuted} style={styles.kicker}>
          Método preferido en el checkout
        </Txt>
        <RadioCard
          selected={preferred === 'yape'}
          onPress={() => choose('yape', 'Yape / Plin')}
          title="Yape / Plin"
          subtitle={`Vinculado a ${phone}`}
          badge={<Badge label="Sin comisiones" tone="warning" />}
          iconNode={
            <View style={styles.yape}>
              <Txt variant="headlineMd" color={colors.gold}>
                Y
              </Txt>
            </View>
          }
        />
        <RadioCard
          selected={preferred === 'card'}
          onPress={() => (cards.length ? choose('card', 'Tarjeta') : setAdding(true))}
          title="Tarjeta crédito / débito"
          subtitle={cards.length ? `${cards.length} guardadas` : 'Agrega una tarjeta'}
          icon="credit-card-outline"
        />
        <RadioCard
          selected={preferred === 'cash'}
          onPress={() => choose('cash', 'Efectivo')}
          title="Efectivo contra entrega"
          subtitle="Paga al recibir tu pedido"
          icon="cash"
        />

        <Txt variant="labelSm" color={colors.textMuted} style={[styles.kicker, { marginTop: space.md }]}>
          Mis tarjetas
        </Txt>
        {cards.map((c) => (
          <Card key={c.id} style={styles.card}>
            <View style={styles.cardIcon}>
              <Icon name="credit-card" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="labelLg">
                {c.brand} •••• {c.last4}
              </Txt>
              <Txt variant="bodySm" color={colors.textMuted}>
                {c.holder} • Vence {c.expiry}
              </Txt>
            </View>
            <IconButton
              icon="trash-can-outline"
              label={`Eliminar tarjeta ${c.last4}`}
              color={colors.error}
              onPress={() => {
                deleteCard(c.id);
                toast('Tarjeta eliminada', { icon: 'trash-can-outline' });
              }}
            />
          </Card>
        ))}
        <Button label="Agregar tarjeta" icon="plus" variant="outline" onPress={() => setAdding(true)} />
        <Row style={{ gap: 6, justifyContent: 'center' }}>
          <Icon name="lock-outline" size={14} color={colors.success} />
          <Txt variant="bodySm" color={colors.textMuted}>
            Tus datos se guardan cifrados (PCI DSS)
          </Txt>
        </Row>
      </ScrollView>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Nueva tarjeta">
        <View style={{ gap: space.md }}>
          <TextField
            label="Número de tarjeta"
            icon="credit-card-outline"
            keyboardType="number-pad"
            maxLength={19}
            placeholder="4111 1111 1111 1111"
            value={form.number}
            onChangeText={(t) =>
              setForm((f) => ({ ...f, number: t.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ') }))
            }
            error={touched ? errors.number : undefined}
          />
          <TextField
            label="Vencimiento"
            keyboardType="number-pad"
            maxLength={5}
            placeholder="MM/AA"
            value={form.expiry}
            onChangeText={(t) => {
              const d = t.replace(/\D/g, '');
              setForm((f) => ({ ...f, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2, 4)}` : d }));
            }}
            error={touched ? errors.expiry : undefined}
          />
          <TextField
            label="Titular"
            icon="account-outline"
            autoCapitalize="characters"
            placeholder="Como figura en la tarjeta"
            value={form.holder}
            onChangeText={(t) => setForm((f) => ({ ...f, holder: t }))}
            error={touched ? errors.holder : undefined}
          />
          <Button label="Guardar tarjeta" variant="brand" onPress={save} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  kicker: { textTransform: 'uppercase' },
  yape: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  cardIcon: {
    width: 48,
    height: 34,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
