import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { Icon, type IconName } from '@/components/Icon';
import { Accordion, ScreenHeader, SearchBar } from '@/components/layout';
import { Card, Row, Tap, Txt } from '@/components/ui';
import { normalize } from '@/data/products';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

const FAQ = [
  {
    q: '¿Cuánto demora el delivery?',
    a: 'Entre 25 y 35 minutos desde que confirmas tu pedido. Puedes seguir al repartidor en tiempo real desde Órdenes.',
  },
  {
    q: '¿Cuánto cuesta el envío?',
    a: 'El delivery cuesta S/ 4.50 y es gratis en pedidos desde S/ 40 o usando el cupón ENVIOGRATIS. Si eliges "Para llevar", no pagas envío.',
  },
  {
    q: '¿Puedo cancelar mi pedido?',
    a: 'Sí, mientras la tienda no empiece a prepararlo. Ingresa al seguimiento del pedido y toca "Cancelar pedido". El reembolso llega en un máximo de 48 horas.',
  },
  {
    q: '¿Qué medios de pago aceptan?',
    a: 'Yape, Plin, tarjetas Visa, Mastercard, Amex y Diners, y efectivo contra entrega (el repartidor lleva vuelto).',
  },
  {
    q: '¿Por qué me piden DNI con bebidas alcohólicas?',
    a: 'Por ley, la venta de alcohol es solo para mayores de 18 años. El repartidor o el cajero pueden solicitar tu DNI al entregar.',
  },
  {
    q: '¿Cómo uso mis puntos Tambo Lover?',
    a: 'Sumas 1 punto por cada S/ 1. Canjéalos desde Perfil > Ver Club por cafés, empanadas o chelitas gratis.',
  },
  {
    q: '¿Dónde encuentro mi boleta?',
    a: 'En Órdenes > Historial > Boleta electrónica. También puedes enviarla a tu correo.',
  },
];

const CHANNELS: { icon: IconName; title: string; subtitle: string; url: string }[] = [
  {
    icon: 'whatsapp',
    title: 'WhatsApp',
    subtitle: 'Respuesta en menos de 5 min',
    url: 'https://wa.me/51987000000',
  },
  { icon: 'phone-outline', title: 'Llámanos', subtitle: '(01) 615-0000 • 24/7', url: 'tel:016150000' },
  { icon: 'email-outline', title: 'Correo', subtitle: 'ayuda@tambo.pe', url: 'mailto:ayuda@tambo.pe' },
];

export default function HelpScreen() {
  const [query, setQuery] = useState('');
  const q = normalize(query.trim());
  const faqs = FAQ.filter((f) => !q || normalize(f.q + f.a).includes(q));

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Centro de Ayuda">
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="¿En qué te ayudamos?"
          style={{ marginHorizontal: space.sm, marginTop: space.sm }}
        />
      </ScreenHeader>
      <ScrollView contentContainerStyle={styles.body}>
        <Txt variant="headlineMd">Contáctanos</Txt>
        <Row style={{ alignItems: 'stretch' }}>
          {CHANNELS.map((c) => (
            <Tap
              key={c.title}
              onPress={() => Linking.openURL(c.url).catch(() => toast(c.subtitle, { icon: c.icon }))}
              style={styles.channel}
              accessibilityLabel={`${c.title}: ${c.subtitle}`}
            >
              <View style={styles.channelIcon}>
                <Icon name={c.icon} size={24} color={colors.primary} />
              </View>
              <Txt variant="labelMd" align="center">
                {c.title}
              </Txt>
              <Txt variant="bodySm" align="center" color={colors.textMuted} style={{ fontSize: 11 }}>
                {c.subtitle}
              </Txt>
            </Tap>
          ))}
        </Row>

        <Txt variant="headlineMd" style={{ marginTop: space.md }}>
          Preguntas frecuentes
        </Txt>
        <Card style={{ paddingHorizontal: space.lg }}>
          {faqs.length === 0 ? (
            <Txt variant="bodyMd" color={colors.textMuted} style={{ paddingVertical: space.lg }}>
              No encontramos respuestas para “{query}”. Escríbenos por WhatsApp.
            </Txt>
          ) : (
            faqs.map((f) => (
              <Accordion key={f.q} title={f.q} icon="help-circle-outline">
                <Txt variant="bodyMd" color={colors.textMuted}>
                  {f.a}
                </Txt>
              </Accordion>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  channel: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  channelIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
