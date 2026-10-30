import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/layout';
import { Button, Row, Tap, Txt } from '@/components/ui';
import { haptic } from '@/lib/feedback';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, radius, space } from '@/theme/tokens';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const savedEmail = useSession((s) => s.profile.email);
  const login = useSession((s) => s.login);
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const errors = {
    email: !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Ingresa un correo válido.' : undefined,
    password: password.length < 6 ? 'La contraseña debe tener al menos 6 caracteres.' : undefined,
  };

  const submit = async () => {
    setTouched(true);
    if (errors.email || errors.password) {
      haptic.warning();
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    haptic.success();
    login(email.trim());
    toast('¡Bienvenido de vuelta!', { icon: 'hand-wave-outline' });
  };

  return (
    <LinearGradient colors={[colors.primary, colors.primaryDark]} style={{ flex: 1 }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + space.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Row style={{ justifyContent: 'center', gap: space.sm }}>
            <View style={styles.dot} />
            <Txt variant="headlineXl" color={colors.white} style={{ fontSize: 40, lineHeight: 46 }}>
              Tambo+
            </Txt>
          </Row>
          <Txt variant="bodyLg" color="rgba(255,255,255,0.85)" align="center">
            Tus antojos en 25 minutos o listos para recoger sin colas.
          </Txt>

          <View style={styles.card}>
            <Txt variant="headlineLg">Inicia sesión</Txt>
            <TextField
              label="Correo electrónico"
              icon="email-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              error={touched ? errors.email : undefined}
            />
            <View>
              <TextField
                label="Contraseña"
                icon="lock-outline"
                secureTextEntry={!show}
                autoComplete="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                error={touched ? errors.password : undefined}
              />
              <Tap
                onPress={() => setShow((s) => !s)}
                style={styles.eye}
                hitSlop={8}
                accessibilityLabel={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </Tap>
            </View>
            <Tap
              onPress={() =>
                toast(`Te enviamos un enlace a ${email || 'tu correo'}`, { icon: 'email-fast-outline' })
              }
              style={{ alignSelf: 'flex-end' }}
              accessibilityLabel="Olvidé mi contraseña"
            >
              <Txt variant="labelMd" color={colors.primary}>
                ¿Olvidaste tu contraseña?
              </Txt>
            </Tap>
            <Button label="Ingresar" size="lg" loading={loading} onPress={submit} />
            <Row style={{ gap: space.md }}>
              <View style={styles.line} />
              <Txt variant="bodySm" color={colors.textMuted}>
                o continúa con
              </Txt>
              <View style={styles.line} />
            </Row>
            <Row>
              <Button
                label="Google"
                icon="google"
                variant="outline"
                full={false}
                style={{ flex: 1 }}
                onPress={() => {
                  setPassword('demo1234');
                  toast('Demo: usa “Ingresar” para continuar');
                }}
              />
              <Button
                label="Apple"
                icon="apple"
                variant="outline"
                full={false}
                style={{ flex: 1 }}
                onPress={() => {
                  setPassword('demo1234');
                  toast('Demo: usa “Ingresar” para continuar');
                }}
              />
            </Row>
            <Txt variant="bodySm" align="center" color={colors.textMuted}>
              Prototipo: cualquier correo válido y una contraseña de 6+ caracteres funcionan.
            </Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, gap: space.lg, flexGrow: 1, justifyContent: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.gold },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.sheet,
    padding: space.xl,
    gap: space.md,
    marginTop: space.lg,
  },
  eye: { position: 'absolute', right: space.md, top: 38 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
});
