import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Accordion, ScreenHeader, TextField } from '@/components/layout';
import { Button, Card, Chip, Row, Txt } from '@/components/ui';
import { randomCode } from '@/store/orders';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, space } from '@/theme/tokens';

const TERMS = [
  {
    title: 'Términos y condiciones de uso',
    body: 'Al usar Tambo+ aceptas nuestras condiciones de venta. Los precios incluyen IGV y pueden variar según la tienda. Las promociones son válidas hasta agotar stock y no son acumulables salvo indicación.',
  },
  {
    title: 'Condiciones de delivery',
    body: 'El tiempo de entrega es referencial (25-35 min). El repartidor esperará hasta 10 minutos en el punto de entrega. Los productos con alcohol solo se entregan a mayores de 18 años con DNI.',
  },
  {
    title: 'Política de privacidad',
    body: 'Tratamos tus datos personales conforme a la Ley N° 29733. Usamos tu ubicación solo para calcular tiempos y costos de entrega.',
  },
];

export default function LegalScreen() {
  const email = useSession((s) => s.profile.email);
  const [type, setType] = useState<'Reclamo' | 'Queja'>('Reclamo');
  const [order, setOrder] = useState('');
  const [detail, setDetail] = useState('');
  const [touched, setTouched] = useState(false);
  const error = detail.trim().length < 15 ? 'Describe lo ocurrido (mínimo 15 caracteres).' : undefined;

  const submit = () => {
    setTouched(true);
    if (error) return;
    const code = randomCode('LR', 6);
    toast(`${type} registrado (${code}). Te responderemos a ${email} en máx. 15 días hábiles.`, {
      tone: 'success',
      icon: 'book-check-outline',
    });
    setOrder('');
    setDetail('');
    setTouched(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Legal y reclamos" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card style={{ paddingHorizontal: space.lg }}>
          {TERMS.map((t) => (
            <Accordion key={t.title} title={t.title} icon="file-document-outline">
              <Txt variant="bodyMd" color={colors.textMuted}>
                {t.body}
              </Txt>
            </Accordion>
          ))}
        </Card>

        <Txt variant="headlineMd" style={{ marginTop: space.md }}>
          Libro de reclamaciones
        </Txt>
        <Card style={{ padding: space.lg, gap: space.md }}>
          <Txt variant="bodySm" color={colors.textMuted}>
            Reclamo: disconformidad con el producto o servicio. Queja: malestar con la atención.
          </Txt>
          <Row>
            {(['Reclamo', 'Queja'] as const).map((t) => (
              <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />
            ))}
          </Row>
          <TextField
            label="N° de pedido (opcional)"
            icon="receipt-text-outline"
            placeholder="TB-00000"
            autoCapitalize="characters"
            value={order}
            onChangeText={setOrder}
          />
          <TextField
            label="Detalle"
            placeholder="Cuéntanos qué pasó"
            multiline
            numberOfLines={4}
            value={detail}
            onChangeText={setDetail}
            error={touched ? error : undefined}
          />
          <Button
            label={`Enviar ${type.toLowerCase()}`}
            variant="brand"
            icon="send-outline"
            onPress={submit}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
});
