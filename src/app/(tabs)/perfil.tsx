import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { ScreenHeader } from '@/components/layout';
import { Sheet } from '@/components/Sheet';
import { Badge, Button, Card, IconButton, Row, Tap, Txt } from '@/components/ui';
import { coupons, user } from '@/data/stores';
import { haptic } from '@/lib/feedback';
import { randomCode } from '@/store/orders';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

const REWARDS = [
  { id: 'cafe', title: 'Café americano gratis', points: 150, icon: 'coffee-outline' as IconName },
  { id: 'empanada', title: 'Empanada de carne gratis', points: 250, icon: 'food-croissant' as IconName },
  { id: 'chela', title: 'Chelita Pilsen 355 ml gratis', points: 400, icon: 'glass-mug-variant' as IconName },
  { id: 'combo', title: 'Combo Piqueo gratis', points: 600, icon: 'ticket-percent-outline' as IconName },
];

export default function ProfileScreen() {
  const profile = useSession((s) => s.profile);
  const points = useSession((s) => s.points);
  const addresses = useSession((s) => s.addresses);
  const cards = useSession((s) => s.cards);
  const favorites = useSession((s) => s.favorites);
  const usedCoupons = useSession((s) => s.usedCoupons);
  const addPoints = useSession((s) => s.addPoints);
  const logout = useSession((s) => s.logout);
  const notifications = useSession((s) => s.notifications);
  const [clubOpen, setClubOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const availableCoupons = coupons.filter((c) => !usedCoupons.includes(c.code)).length;
  const level = points >= 1000 ? 'Tambo Pro' : points >= 300 ? 'Tambo Lover' : 'Tambo Fan';

  const redeem = (r: (typeof REWARDS)[number]) => {
    addPoints(-r.points);
    haptic.success();
    setClubOpen(false);
    toast(`¡Canjeaste ${r.title}! Muestra el código ${randomCode('CLUB')} en caja`, {
      icon: 'gift-outline',
      tone: 'success',
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader
        title="Mi Perfil"
        back={false}
        right={
          <View>
            <IconButton
              icon="bell-outline"
              label="Notificaciones"
              color={colors.white}
              onPress={() => router.push('/perfil/notificaciones')}
            />
            {notifications.promos && <View style={styles.bellDot} />}
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.body}>
        <Card style={styles.userCard}>
          <View>
            <View style={styles.avatarRing}>
              <Image
                source={user.avatar}
                style={styles.avatar}
                contentFit="cover"
                accessibilityLabel={`Foto de ${profile.name}`}
              />
            </View>
            <IconButton
              icon="pencil"
              label="Editar perfil"
              size={30}
              bg={colors.primary}
              color={colors.white}
              onPress={() => router.push('/perfil/editar')}
              style={styles.editBtn}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="headlineMd" numberOfLines={1}>
              Hola, {profile.name}
            </Txt>
            <Row style={{ gap: 6 }}>
              <Icon name="email-outline" size={14} color={colors.textMuted} />
              <Txt variant="bodySm" color={colors.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {profile.email}
              </Txt>
            </Row>
            <Row style={{ gap: 6 }}>
              <Icon name="phone-outline" size={14} color={colors.textMuted} />
              <Txt variant="bodySm" color={colors.textMuted}>
                {profile.phone}
              </Txt>
            </Row>
            <Badge
              label={`${level} • ${points} Puntos`}
              tone="warning"
              icon="star-circle-outline"
              style={{ marginTop: 6 }}
            />
          </View>
        </Card>

        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.club}
        >
          <View style={styles.clubIcon}>
            <Icon name="gift-outline" size={26} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="headlineMd" color={colors.gold}>
              Gana puntos en cada compra
            </Txt>
            <Txt variant="bodySm" color="rgba(255,255,255,0.9)">
              Canjea chelitas y snacks gratis en tu Tambo más cercano.
            </Txt>
          </View>
          <Button label="Ver Club" size="sm" full={false} onPress={() => setClubOpen(true)} />
        </LinearGradient>

        <Txt variant="headlineMd" style={styles.groupTitle}>
          Mi Cuenta y Pedidos
        </Txt>
        <Card style={styles.group}>
          <MenuRow
            icon="map-marker-outline"
            tint={colors.primaryTint}
            title="Mis Direcciones guardadas"
            subtitle={
              addresses.length ? addresses.map((a) => a.label).join(', ') : 'Agrega tu primera dirección'
            }
            href="/perfil/direcciones"
          />
          <MenuRow
            icon="wallet-outline"
            tint={colors.goldSoft}
            title="Métodos de pago"
            subtitleNode={
              <Row style={{ gap: 6 }}>
                <Badge label="Yape" tone="soft" />
                {cards.map((c) => (
                  <Txt key={c.id} variant="bodySm" color={colors.textMuted}>
                    • {c.brand} {c.last4}
                  </Txt>
                ))}
              </Row>
            }
            href="/perfil/pagos"
          />
          <MenuRow
            icon="tag-outline"
            tint={colors.magentaSoft}
            title="Mis Cupones y Descuentos"
            subtitle={`${availableCoupons} cupones disponibles por canjear`}
            subtitleColor={colors.wine}
            href="/perfil/cupones"
          />
          <MenuRow
            icon="heart-outline"
            tint={colors.primaryTint}
            title="Mis Favoritos"
            subtitle={
              favorites.length
                ? `${favorites.length} productos guardados`
                : 'Tus productos guardados de siempre'
            }
            href="/perfil/favoritos"
            last
          />
        </Card>

        <Txt variant="headlineMd" style={styles.groupTitle}>
          Ajustes y Soporte
        </Txt>
        <Card style={styles.group}>
          <MenuRow icon="tune-variant" title="Notificaciones y preferencias" href="/perfil/notificaciones" />
          <MenuRow
            icon="face-agent"
            title="Centro de Ayuda y Preguntas frecuentes"
            subtitle="Atención al cliente 24/7"
            href="/perfil/ayuda"
          />
          <MenuRow
            icon="shield-account-outline"
            title="Términos y condiciones / Libro de reclamaciones"
            href="/perfil/legal"
            last
          />
        </Card>

        <Tap onPress={() => setLogoutOpen(true)} style={styles.logout} accessibilityLabel="Cerrar sesión">
          <Icon name="logout" size={22} color={colors.error} />
          <Txt variant="labelLg" color={colors.error}>
            Cerrar sesión
          </Txt>
        </Tap>
        <Txt variant="bodySm" align="center" color={colors.textSubtle}>
          Versión 4.12.0 • Tambo+ Perú (prototipo)
        </Txt>
      </ScrollView>

      <Sheet
        visible={clubOpen}
        onClose={() => setClubOpen(false)}
        title="Club Tambo Lover"
        subtitle={`Tienes ${points} puntos • 1 punto por cada S/ 1`}
      >
        <View style={{ gap: space.md }}>
          <View style={styles.levelBox}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="labelMd">{level}</Txt>
              <Txt variant="labelSm" color={colors.textMuted}>
                {points >= 1000
                  ? 'Nivel máximo'
                  : `${(points >= 300 ? 1000 : 300) - points} pts para el siguiente nivel`}
              </Txt>
            </Row>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(100, (points / (points >= 300 ? 1000 : 300)) * 100)}%` },
                ]}
              />
            </View>
          </View>
          {REWARDS.map((r) => {
            const can = points >= r.points;
            return (
              <Row key={r.id} style={styles.reward}>
                <View style={styles.rewardIcon}>
                  <Icon name={r.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="labelLg">{r.title}</Txt>
                  <Txt variant="bodySm" color={colors.textMuted}>
                    {r.points} puntos
                  </Txt>
                </View>
                <Button
                  label={can ? 'Canjear' : `Faltan ${r.points - points}`}
                  size="sm"
                  variant={can ? 'brand' : 'soft'}
                  full={false}
                  disabled={!can}
                  onPress={() => redeem(r)}
                />
              </Row>
            );
          })}
        </View>
      </Sheet>

      <Sheet
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="¿Cerrar sesión?"
        subtitle="Tu carrito y tus pedidos se mantendrán guardados."
      >
        <View style={{ gap: space.sm }}>
          <Button
            label="Sí, cerrar sesión"
            variant="danger"
            icon="logout"
            onPress={() => {
              setLogoutOpen(false);
              logout();
            }}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setLogoutOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  subtitleNode,
  subtitleColor = colors.textMuted,
  href,
  tint = colors.surfaceMid,
  last,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  subtitleNode?: React.ReactNode;
  subtitleColor?: string;
  href: Href;
  tint?: string;
  last?: boolean;
}) {
  return (
    <Tap
      onPress={() => router.push(href)}
      style={[styles.menuRow, !last && styles.menuDivider]}
      accessibilityLabel={title}
      pressedStyle={{ backgroundColor: colors.surfaceLow }}
    >
      <View style={[styles.menuIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyLg">{title}</Txt>
        {subtitle && (
          <Txt variant="bodySm" color={subtitleColor} numberOfLines={1}>
            {subtitle}
          </Txt>
        )}
        {subtitleNode}
      </View>
      <Icon name="chevron-right" size={22} color={colors.textMuted} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  avatarRing: { padding: 3, borderRadius: 48, borderWidth: 2, borderColor: colors.primarySoft },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  editBtn: { position: 'absolute', right: -2, bottom: -2, borderWidth: 2, borderColor: colors.white },
  club: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
  },
  clubIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: { marginTop: space.md, marginLeft: space.xs, color: colors.textMuted },
  group: { overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: 64 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceMid },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F7C1BB',
    backgroundColor: '#FFF1EF',
    marginTop: space.md,
  },
  levelBox: { padding: space.md, borderRadius: radius.lg, backgroundColor: colors.goldSoft, gap: space.sm },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.goldDark, borderRadius: 4 },
  reward: {
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: space.md,
  },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
