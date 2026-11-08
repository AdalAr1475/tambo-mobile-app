import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { Txt } from './ui';

/**
 * Código de verificación en casillas (ej. código de aprobación de Yape).
 * Un TextInput invisible cubre las casillas: permite tipear, pegar el código completo y el
 * autocompletado de iOS/Android.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  error,
  accessibilityLabel = 'Código de aprobación',
}: {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  error?: boolean;
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  const cursor = Math.min(value.length, length - 1);

  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, i) => {
        const digit = value[i];
        return (
          <View
            key={i}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.box,
              !!digit && styles.boxFilled,
              focused && i === cursor && styles.boxActive,
              error && !digit && styles.boxError,
            ]}
          >
            <Txt variant="headlineLg" color={colors.primaryDark}>
              {digit ?? ''}
            </Txt>
          </View>
        );
      })}
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="text"
        accessibilityHint={`Ingresa los ${length} dígitos. Puedes pegar el código completo.`}
        accessibilityValue={{ text: `${value.length} de ${length} dígitos ingresados${error ? '. Código incompleto o inválido' : ''}` }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, justifyContent: 'space-between' },
  box: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.85,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  boxActive: { borderColor: colors.primary, borderWidth: 2 },
  boxError: { borderColor: colors.error },
  hidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
    fontFamily: fonts.regular,
  },
});
