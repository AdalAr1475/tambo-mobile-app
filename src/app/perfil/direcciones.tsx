import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AddressForm } from '@/components/delivery';
import { Icon } from '@/components/Icon';
import { EmptyState, ScreenHeader } from '@/components/layout';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, Card, IconButton, Row, Tap, Txt } from '@/components/ui';
import type { Address } from '@/data/types';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

export default function AddressesScreen() {
  const addresses = useSession((s) => s.addresses);
  const addressId = useSession((s) => s.addressId);
  const selectAddress = useSession((s) => s.selectAddress);
  const deleteAddress = useSession((s) => s.deleteAddress);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Mis direcciones" />
      <ScrollView contentContainerStyle={styles.body}>
        {addresses.length === 0 && (
          <EmptyState
            icon="map-marker-plus-outline"
            title="Sin direcciones"
            message="Agrega una dirección para recibir tus pedidos por delivery."
          />
        )}
        {addresses.map((a) => {
          const selected = a.id === addressId;
          return (
            <Card
              key={a.id}
              style={[styles.card, selected && { borderColor: colors.primary, borderWidth: 2 }]}
            >
              <Tap
                onPress={() => {
                  selectAddress(a.id);
                  toast(`Entregaremos en ${a.label}`, { icon: 'map-marker-check-outline' });
                }}
                style={styles.row}
                accessibilityLabel={`Usar dirección ${a.label}`}
                accessibilityState={{ selected }}
              >
                <View style={styles.icon}>
                  <Icon
                    name={
                      a.label === 'Oficina'
                        ? 'briefcase-outline'
                        : a.label === 'Casa'
                          ? 'home-outline'
                          : 'map-marker-outline'
                    }
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Row>
                    <Txt variant="labelLg">{a.label}</Txt>
                    {selected && <Badge label="Predeterminada" tone="soft" />}
                  </Row>
                  <Txt variant="bodyMd">{a.line1}</Txt>
                  <Txt variant="bodySm" color={colors.textMuted}>
                    {a.district}
                  </Txt>
                  {a.reference && (
                    <Txt variant="bodySm" color={colors.textMuted}>
                      Ref.: {a.reference}
                    </Txt>
                  )}
                </View>
              </Tap>
              <Row style={styles.actions}>
                <IconButton
                  icon="pencil-outline"
                  label={`Editar ${a.label}`}
                  size={40}
                  onPress={() => setEditing(a)}
                />
                <IconButton
                  icon="trash-can-outline"
                  label={`Eliminar ${a.label}`}
                  size={40}
                  color={colors.error}
                  onPress={() => setConfirmDelete(a)}
                />
              </Row>
            </Card>
          );
        })}
        <Button
          label="Agregar nueva dirección"
          icon="plus"
          variant="brand"
          onPress={() => setEditing('new')}
        />
      </ScrollView>

      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nueva dirección' : 'Editar dirección'}
      >
        {editing && (
          <AddressForm
            initial={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={(a) => {
              if (editing === 'new') selectAddress(a.id);
              setEditing(null);
              toast('Dirección guardada', { tone: 'success' });
            }}
          />
        )}
      </Sheet>

      <Sheet
        visible={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="¿Eliminar dirección?"
        subtitle={confirmDelete ? `${confirmDelete.label}: ${confirmDelete.line1}` : undefined}
      >
        <View style={{ gap: space.sm }}>
          <Button
            label="Eliminar"
            variant="danger"
            onPress={() => {
              if (confirmDelete) deleteAddress(confirmDelete.id);
              setConfirmDelete(null);
              toast('Dirección eliminada', { icon: 'trash-can-outline' });
            }}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setConfirmDelete(null)} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  card: { flexDirection: 'row', alignItems: 'center', paddingRight: space.sm },
  row: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 0 },
});
