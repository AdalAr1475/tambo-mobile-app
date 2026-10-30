import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeader, TextField } from '@/components/layout';
import { Button } from '@/components/ui';
import { user } from '@/data/stores';
import { useSession } from '@/store/session';
import { toast } from '@/store/ui';
import { colors, space } from '@/theme/tokens';

export default function EditProfileScreen() {
  const profile = useSession((s) => s.profile);
  const update = useSession((s) => s.updateProfile);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [touched, setTouched] = useState(false);

  const errors = {
    name: name.trim().length < 3 ? 'Ingresa tu nombre completo.' : undefined,
    email: !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Ingresa un correo válido.' : undefined,
    phone: phone.replace(/\D/g, '').length < 9 ? 'Ingresa un celular válido (9 dígitos).' : undefined,
  };

  const save = () => {
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    update({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    toast('Perfil actualizado', { tone: 'success' });
    router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Editar perfil" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Image
            source={user.avatar}
            style={styles.avatar}
            contentFit="cover"
            accessibilityLabel="Foto de perfil"
          />
          <TextField
            label="Nombre completo"
            icon="account-outline"
            value={name}
            onChangeText={setName}
            error={touched ? errors.name : undefined}
          />
          <TextField
            label="Correo electrónico"
            icon="email-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            error={touched ? errors.email : undefined}
          />
          <TextField
            label="Celular"
            icon="phone-outline"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            error={touched ? errors.phone : undefined}
          />
          <Button label="Guardar cambios" variant="brand" onPress={save} style={{ marginTop: space.md }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignSelf: 'center',
    borderWidth: 3,
    borderColor: colors.primarySoft,
  },
});
