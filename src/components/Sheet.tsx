import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, radius, space } from '@/theme/tokens';
import { IconButton, Txt } from './ui';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
};

export function Sheet({ visible, onClose, title, subtitle, children, footer, scroll = true }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
        <Animated.View
          entering={SlideInDown.springify().damping(22).stiffness(180)}
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, space.lg) }]}
        >
          <View style={styles.handle} />
          {title && (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Txt variant="headlineMd">{title}</Txt>
                {subtitle && (
                  <Txt variant="bodySm" color={colors.textMuted} style={{ marginTop: 2 }}>
                    {subtitle}
                  </Txt>
                )}
              </View>
              <IconButton icon="close" label="Cerrar" onPress={onClose} bg={colors.surfaceMid} size={36} />
            </View>
          )}
          {scroll ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={{ paddingBottom: space.md }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.bodyStatic}>{children}</View>
          )}
          {footer && <View style={styles.footer}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    maxHeight: '88%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...elevation.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.handle,
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.md,
  },
  body: { paddingHorizontal: space.xl },
  bodyStatic: { paddingHorizontal: space.xl, paddingBottom: space.md },
  footer: { paddingHorizontal: space.xl, paddingTop: space.sm },
});
