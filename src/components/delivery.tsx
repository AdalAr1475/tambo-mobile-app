import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { districtCentroid, getStore, stores } from '@/data/stores';
import type { Address } from '@/data/types';
import { haptic } from '@/lib/feedback';
import {
  addressCoords,
  COVERAGE_METERS,
  DELIVERY_RANGE_METERS,
  deliveryStoreFor,
  formatDistance,
  haversine,
  storesByDistance,
} from '@/lib/geo';
import { useUserLocation } from '@/lib/useUserLocation';
import { useCartCount } from '@/store/cart';
import { useSelectedAddress, useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';
import { Icon } from './Icon';
import { fulfillmentMeta, FulfillmentToggle, TextField } from './layout';
import { SmartMap } from './map/SmartMap';
import { PointsPill } from './points';
import { Sheet } from './Sheet';
import { Badge, Button, Chip, IconButton, Row, Tap, Txt } from './ui';

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
      // Sin geocodificación en tiempo real: se ubica en el centro del distrito (o se conserva la anterior).
      coords:
        initial?.coords && initial.district === district.trim() ? initial.coords : districtCentroid(district),
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
  const user = useUserLocation();
  const nearby = useMemo(() => storesByDistance(user.coords), [user.coords]);

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
                  extra={<ServingStore address={a} />}
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
              {/* Mapa de cobertura: tu ubicación, radio de 1.5 km y tiendas con casilleros libres. */}
              <View style={styles.mapBox}>
                <SmartMap
                  height={200}
                  interactive={false}
                  markers={[
                    { id: 'user', kind: 'user', position: user.coords },
                    ...stores.map((s) => ({
                      id: `store:${s.id}`,
                      kind: 'store' as const,
                      position: s.coords,
                      selected: s.id === storeId,
                      badge: s.lockers ? `🔒${s.lockers.free}` : undefined,
                    })),
                  ]}
                  circles={[{ id: 'coverage', center: user.coords, radius: COVERAGE_METERS }]}
                  fit={[user.coords, ...nearby.slice(0, 3).map((n) => n.store.coords)]}
                  onMarkerPress={(id) => {
                    if (!id.startsWith('store:')) return;
                    selectStore(id.slice(6));
                    haptic.tap();
                    close();
                  }}
                  fallback={
                    <View style={styles.mapFallback}>
                      <Icon name="map-outline" size={28} color={colors.textMuted} />
                      <Txt variant="bodySm" color={colors.textMuted}>
                        Mapa no disponible sin conexión
                      </Txt>
                    </View>
                  }
                />
              </View>
              <Row style={{ gap: 4 }}>
                <Icon name="crosshairs-gps" size={14} color={colors.textMuted} />
                <Txt variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
                  {user.source === 'gps'
                    ? 'Según tu ubicación actual'
                    : user.source === 'approx'
                      ? 'Ubicación aproximada (no pudimos usar tu GPS)'
                      : 'Ubicación de demo: Parque Kennedy, Miraflores'}{' '}
                  • cobertura inmediata de {formatDistance(COVERAGE_METERS)}
                </Txt>
              </Row>
              {nearby.map(({ store: s, meters }) => (
                <PointRow
                  key={s.id}
                  icon="storefront-outline"
                  title={`${s.name} - ${s.district}`}
                  subtitle={`${s.address} • a ${formatDistance(meters)} • Listo en ${s.eta}`}
                  extra={
                    <Row style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      {s.lockers && (
                        <Badge
                          label={s.lockers.free ? `Smart Locker: ${s.lockers.free} libres` : 'Sin casilleros libres'}
                          tone={s.lockers.free ? 'success' : 'neutral'}
                          icon="locker-multiple"
                        />
                      )}
                      {meters > COVERAGE_METERS && <Badge label="Más lejos" tone="neutral" />}
                    </Row>
                  }
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

/** Tienda que atiende una dirección y si está dentro del radio de delivery. */
function ServingStore({ address }: { address: Address }) {
  const store = deliveryStoreFor(address);
  const meters = haversine(addressCoords(address), store.coords);
  const covered = meters <= DELIVERY_RANGE_METERS;
  return (
    <Row style={{ gap: 4, marginTop: 4 }}>
      <Icon
        name={covered ? 'storefront-outline' : 'map-marker-off-outline'}
        size={14}
        color={covered ? colors.success : colors.error}
      />
      <Txt variant="bodySm" color={covered ? colors.success : colors.error} numberOfLines={1} style={{ flex: 1 }}>
        {covered ? `Te atiende ${store.name} (${formatDistance(meters)})` : 'Fuera de cobertura delivery'}
      </Txt>
    </Row>
  );
}

function PointRow({
  icon,
  title,
  subtitle,
  extra,
  selected,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle: string;
  extra?: React.ReactNode;
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
        {extra}
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

/**
 * Cabecera compacta: una píldora de contexto (modalidad · ETA · dirección o tienda) que abre
 * "¿Cómo quieres tu pedido?". La modalidad ya no se cambia aquí con un toggle propio.
 */
export function LocationHeader() {
  const insets = useSafeAreaInsets();
  const point = useDeliveryPoint();
  const count = useCartCount();
  const [open, setOpen] = useState(false);
  const meta = fulfillmentMeta[point.fulfillment];

  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <StatusBar style="light" />
      <Row style={{ gap: space.sm }}>
        <Tap
          onPress={() => setOpen(true)}
          style={styles.contextPill}
          accessibilityLabel={`${meta.label}, ${point.kicker.toLowerCase()} ${point.title}, ${point.eta}. Cambiar modalidad o ${point.fulfillment === 'delivery' ? 'dirección' : 'tienda'}`}
          pressedStyle={{ opacity: 0.8 }}
        >
          <View style={styles.pin}>
            <Icon name={meta.icon} size={20} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="labelSm" color="rgba(255,255,255,0.8)" numberOfLines={1}>
              {meta.label.toUpperCase()} • {point.eta}
            </Txt>
            <Txt variant="labelLg" weight="bold" color={colors.white} numberOfLines={1}>
              {point.title}
            </Txt>
          </View>
          <Icon name="chevron-down" size={22} color={colors.white} />
        </Tap>
        <PointsPill />
        <IconButton
          icon="shopping-outline"
          label={count > 0 ? `${count} ${count === 1 ? 'producto' : 'productos'} en tu carrito. Abrir carrito` : 'Carrito vacío. Abrir carrito'}
          color={colors.white}
          bg="rgba(255,255,255,0.14)"
          badge={count}
          onPress={() => router.push('/carrito')}
          style={{ borderRadius: radius.lg }}
        />
      </Row>
      <DeliveryPointSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { textTransform: 'uppercase', marginTop: space.xs },
  mapBox: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  mapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: colors.surfaceMid,
  },
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
  contextPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingLeft: 4,
    paddingRight: space.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
