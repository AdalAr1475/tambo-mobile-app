import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStore, stores } from '@/data/stores';
import type { Address } from '@/data/types';
import { useCartCount } from '@/store/cart';
import { useSelectedAddress, useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { FulfillmentToggle, TextField } from './layout';
import { Sheet } from './Sheet';
import { Button, Chip, IconButton, Row, Tap, Txt } from './ui';

/* ——— Formulario de dirección (sheet y pantalla de direcciones) ——— */

export function AddressForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Address;
  onSaved: (a: Address) => void;
  onCancel?: () => void;
}) {
  const saveAddress = useSession((s) => s.saveAddress);
  const [label, setLabel] = useState(initial?.label ?? 'Casa');
  const [line1, setLine1] = useState(initial?.line1 ?? '');
  const [district, setDistrict] = useState(initial?.district ?? '');
  const [reference, setReference] = useState(initial?.reference ?? '');
  const [touched, setTouched] = useState(false);

  const errors = {
    line1: line1.trim().length < 5 ? 'Ingresa calle y número (ej. Av. Larco 400).' : undefined,
    district: district.trim().length < 3 ? 'Ingresa el distrito.' : undefined,
  };
  const valid = !errors.line1 && !errors.district;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const a: Address = {
      id: initial?.id ?? `dir-${Date.now()}`,
      label,
      line1: line1.trim(),
      district: district.trim(),
      reference: reference.trim() || undefined,
    };
    saveAddress(a);
    onSaved(a);
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        <Txt variant="labelMd" color={colors.textMuted}>
          Tipo de dirección
        </Txt>
        <Row style={{ flexWrap: 'wrap' }}>
          {['Casa', 'Oficina', 'Pareja', 'Otro'].map((l) => (
            <Chip key={l} label={l} active={label === l} onPress={() => setLabel(l)} />
          ))}
        </Row>
      </View>
      <TextField
        label="Dirección"
        icon="map-marker-outline"
        placeholder="Av. Larco 400, Dpto 502"
        value={line1}
        onChangeText={setLine1}
        error={touched ? errors.line1 : undefined}
      />
      <TextField
        label="Distrito"
        icon="city-variant-outline"
        placeholder="Miraflores, Lima"
        value={district}
        onChangeText={setDistrict}
        error={touched ? errors.district : undefined}
      />
      <TextField
        label="Referencia (opcional)"
        icon="note-text-outline"
        placeholder="Frente al parque, timbre 502"
        value={reference}
        onChangeText={setReference}
      />
      <Button label={initial ? 'Guardar cambios' : 'Guardar dirección'} variant="brand" onPress={submit} />
      {onCancel && <Button label="Cancelar" variant="ghost" onPress={onCancel} />}
    </View>
  );
}

/* ——— Selector de punto de entrega ——— */

export function DeliveryPointSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const fulfillment = useSession((s) => s.fulfillment);
  const setFulfillment = useSession((s) => s.setFulfillment);
  const addresses = useSession((s) => s.addresses);
  const addressId = useSession((s) => s.addressId);
  const storeId = useSession((s) => s.storeId);
  const selectAddress = useSession((s) => s.selectAddress);
  const selectStore = useSession((s) => s.selectStore);
  const [adding, setAdding] = useState(false);

  const close = () => {
    setAdding(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={adding ? 'Nueva dirección' : '¿Cómo quieres tu pedido?'}
      subtitle={adding ? undefined : 'Elige dónde recibir o recoger tus productos'}
    >
      {adding ? (
        <AddressForm
          onCancel={() => setAdding(false)}
          onSaved={(a) => {
            selectAddress(a.id);
            setFulfillment('delivery');
            toast('Dirección guardada', { tone: 'success' });
            close();
          }}
        />
      ) : (
        <View style={{ gap: space.md }}>
          <FulfillmentToggle value={fulfillment} onChange={setFulfillment} tone="light" />
          {fulfillment === 'delivery' ? (
            <>
              <Txt variant="labelSm" color={colors.textMuted} style={styles.kicker}>
                Mis direcciones
              </Txt>
              {addresses.map((a) => (
                <PointRow
                  key={a.id}
                  icon={
                    a.label === 'Oficina'
                      ? 'briefcase-outline'
                      : a.label === 'Casa'
                        ? 'home-outline'
                        : 'map-marker-outline'
                  }
                  title={a.label}
                  subtitle={`${a.line1}, ${a.district}`}
                  selected={a.id === addressId}
                  onPress={() => {
                    selectAddress(a.id);
                    close();
                  }}
                />
              ))}
              <Button
                label="Agregar nueva dirección"
                icon="plus"
                variant="outline"
                onPress={() => setAdding(true)}
              />
            </>
          ) : (
            <>
              <Txt variant="labelSm" color={colors.textMuted} style={styles.kicker}>
                Tiendas cercanas
              </Txt>
              {stores.map((s) => (
                <PointRow
                  key={s.id}
                  icon="storefront-outline"
                  title={`${s.name} - ${s.district}`}
                  subtitle={`${s.address} • ${s.distanceKm} km • Listo en ${s.eta}`}
                  selected={s.id === storeId}
                  onPress={() => {
                    selectStore(s.id);
                    close();
                  }}
                />
              ))}
            </>
          )}
        </View>
      )}
    </Sheet>
  );
}

function PointRow({
  icon,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      style={[styles.point, selected && styles.pointActive]}
    >
      <View style={[styles.pointIcon, selected && { backgroundColor: colors.primary }]}>
        <Icon name={icon} size={20} color={selected ? colors.white : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="labelLg">{title}</Txt>
        <Txt variant="bodySm" color={colors.textMuted} numberOfLines={2}>
          {subtitle}
        </Txt>
      </View>
      {selected && <Icon name="check-circle" size={22} color={colors.primary} />}
    </Tap>
  );
}

/** Texto del punto de entrega actual (dirección o tienda). */
export function useDeliveryPoint() {
  const fulfillment = useSession((s) => s.fulfillment);
  const storeId = useSession((s) => s.storeId);
  const address = useSelectedAddress();
  const store = getStore(storeId);
  return fulfillment === 'delivery'
    ? {
        fulfillment,
        kicker: 'Entregar en',
        title: address ? address.line1 : 'Agrega una dirección',
        subtitle: address?.district ?? '',
        eta: '25-35 min',
        address,
        store,
      }
    : {
        fulfillment,
        kicker: 'Recoger en',
        title: store.name,
        subtitle: store.address,
        eta: store.eta,
        address,
        store,
      };
}

/* ——— Header de Inicio / Descuentos ——— */

export function LocationHeader() {
  const insets = useSafeAreaInsets();
  const point = useDeliveryPoint();
  const setFulfillment = useSession((s) => s.setFulfillment);
  const count = useCartCount();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <StatusBar style="light" />
      <Row style={{ gap: space.md }}>
        <Tap
          onPress={() => setOpen(true)}
          style={styles.locationBtn}
          accessibilityLabel={`${point.kicker}: ${point.title}. Cambiar`}
          pressedStyle={{ opacity: 0.8 }}
        >
          <View style={styles.pin}>
            <Icon
              name={point.fulfillment === 'delivery' ? 'map-marker-outline' : 'storefront-outline'}
              size={20}
              color={colors.gold}
            />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Txt variant="labelSm" color="rgba(255,255,255,0.8)" style={{ textTransform: 'uppercase' }}>
              {point.kicker}:
            </Txt>
            <Row style={{ gap: 4 }}>
              <Txt variant="headlineMd" color={colors.white} numberOfLines={1} style={{ flexShrink: 1 }}>
                {point.title}
              </Txt>
              <Icon name="chevron-down" size={20} color={colors.white} />
            </Row>
          </View>
        </Tap>
        <IconButton
          icon="shopping-outline"
          label={`Carrito, ${count} productos`}
          color={colors.white}
          bg="rgba(255,255,255,0.14)"
          badge={count}
          onPress={() => router.push('/carrito')}
          style={{ borderRadius: radius.lg }}
        />
      </Row>
      <View style={{ marginTop: space.md }}>
        <FulfillmentToggle value={point.fulfillment} onChange={setFulfillment} />
      </View>
      <DeliveryPointSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { textTransform: 'uppercase', marginTop: space.xs },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pointActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  locationBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
