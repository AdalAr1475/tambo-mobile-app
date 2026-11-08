import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DemoOnly } from '@/components/DemoOnly';
import { Icon, type IconName } from '@/components/Icon';
import { ScreenHeader } from '@/components/layout';
import { POINTS_ICON, RedeemCard } from '@/components/points';
import { Button, Card, Divider, Row, Txt } from '@/components/ui';
import { products } from '@/data/products';
import { friendlyDate, money } from '@/lib/format';
import { haptic } from '@/lib/feedback';
import { DEMO_TOP_UP, EARN_PER_SOL, formatPoints, levelFor, pointsValue, pts } from '@/lib/points';
import { toast } from '@/store/ui';
import { useBalance, useLifetime, useWallet, type LedgerKind } from '@/store/wallet';
import { colors, radius, space } from '@/theme/tokens';

const KIND_ICON: Record<LedgerKind, IconName> = {
  earn: 'cart-arrow-down',
  redeem: 'gift-outline',
  revert: 'undo-variant',
  bonus: 'party-popper',
  demo: 'flask-outline',
};

const HOW: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'cart-check',
    title: `Gana ${EARN_PER_SOL} puntos por cada S/ 1`,
    text: 'En cada compra pagada en soles (sin contar el envío).',
  },
  {
    icon: 'gift-outline',
    title: 'Canjea al 100% o puntos + soles',
    text: 'Elige productos de la zona de canje y llévatelos gratis o a precio reducido.',
  },
  {
    icon: 'sale',
    title: 'Úsalos como descuento',
    text: 'En el checkout, cada 100 puntos valen S/ 1.00 de descuento.',
  },
];

const PREVIEW = 6;

export default function PointsScreen() {
  const insets = useSafeAreaInsets();
  const balance = useBalance();
  const lifetime = useLifetime();
  const ledger = useWallet((s) => s.ledger);
  const demoTopUp = useWallet((s) => s.demoTopUp);
  const [showAll, setShowAll] = useState(false);
  const { level, next, progress, toNext } = levelFor(lifetime);
  const redeemable = useMemo(() => products.filter((p) => p.redeem), []);
  const moves = showAll ? ledger : ledger.slice(0, PREVIEW);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader kicker="Club de beneficios" title="Tambo Lover Puntos" />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}>
        <LinearGradient
          colors={[colors.gold, colors.goldDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ gap: 6 }}>
              <Icon name={POINTS_ICON} size={20} color={colors.onGold} />
              <Txt variant="labelSm" color={colors.onGold} style={{ textTransform: 'uppercase' }}>
                Tu saldo
              </Txt>
            </Row>
            <View style={styles.levelChip}>
              <Txt variant="labelSm" color={colors.gold}>
                {level.name.toUpperCase()}
              </Txt>
            </View>
          </Row>
          <Txt
            variant="headlineXl"
            color={colors.onGold}
            style={{ fontSize: 40, lineHeight: 46 }}
            accessibilityLabel={`${formatPoints(balance)} puntos`}
          >
            {formatPoints(balance)}
            <Txt variant="headlineMd" color={colors.onGold}>
              {' '}
              pts
            </Txt>
          </Txt>
          <Txt variant="bodyMd" color={colors.onGold}>
            Equivalen a {money(pointsValue(balance))} para canjear
          </Txt>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <Txt variant="bodySm" color={colors.onGold}>
            {next
              ? `Te faltan ${pts(toNext)} ganados para ${next.name}`
              : 'Estás en el nivel más alto. ¡Gracias por ser Tambo Pro!'}
          </Txt>
        </LinearGradient>

        <DemoOnly>
          <Button
            label={`Recargar ${formatPoints(DEMO_TOP_UP)} pts demo`}
            icon="plus-circle-outline"
            variant="outline"
            size="sm"
            onPress={() => {
              demoTopUp();
              haptic.success();
              toast(`Sumamos ${pts(DEMO_TOP_UP)} de prueba`, { icon: POINTS_ICON, tone: 'success' });
            }}
          />
        </DemoOnly>

        <Card style={styles.block}>
          <Txt variant="headlineMd" style={{ fontSize: 16 }}>
            ¿Cómo funciona?
          </Txt>
          {HOW.map((h) => (
            <Row key={h.title} style={{ alignItems: 'flex-start', gap: space.md }}>
              <View style={styles.howIcon}>
                <Icon name={h.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="labelLg">{h.title}</Txt>
                <Txt variant="bodySm" color={colors.textMuted}>
                  {h.text}
                </Txt>
              </View>
            </Row>
          ))}
        </Card>

        <View style={{ gap: space.sm }}>
          <Row style={{ gap: 6 }}>
            <Icon name="gift-outline" size={22} color={colors.magenta} />
            <Txt variant="headlineMd">Zona de canje</Txt>
          </Row>
          <Txt variant="bodySm" color={colors.textMuted}>
            Llévalos 100% con puntos o paga una parte en soles, como en CMR Puntos.
          </Txt>
        </View>
        {redeemable.map((p) => (
          <RedeemCard key={p.id} product={p} />
        ))}

        <Card style={styles.block}>
          <Txt variant="headlineMd" style={{ fontSize: 16 }}>
            Movimientos
          </Txt>
          {moves.map((m, i) => (
            <View key={m.id} style={{ gap: space.sm }}>
              {i > 0 && <Divider />}
              <Row style={{ gap: space.md }}>
                <View style={styles.moveIcon}>
                  <Icon name={KIND_ICON[m.kind]} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="labelMd" numberOfLines={2}>
                    {m.note}
                  </Txt>
                  <Txt variant="bodySm" color={colors.textSubtle}>
                    {friendlyDate(m.at)}
                  </Txt>
                </View>
                <Txt variant="labelLg" weight="bold" color={m.delta > 0 ? colors.success : colors.error}>
                  {m.delta > 0 ? '+' : '−'}
                  {formatPoints(Math.abs(m.delta))}
                </Txt>
              </Row>
            </View>
          ))}
          {ledger.length > PREVIEW && (
            <Button
              label={showAll ? 'Ver menos' : `Ver todos (${ledger.length})`}
              variant="ghost"
              size="sm"
              onPress={() => setShowAll((s) => !s)}
            />
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  hero: { borderRadius: radius.xl, padding: space.lg, gap: space.sm },
  levelChip: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: 4,
  },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.12)', overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primaryDark },
  block: { padding: space.lg, gap: space.md },
  howIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
