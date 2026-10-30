import { Platform, TextStyle, ViewStyle } from 'react-native';

/** Tokens del Tambo Digital Retail System (stitch_app_delivery_tambo/tambo_digital_retail_system/DESIGN.md). */
export const colors = {
  primary: '#6B1464',
  primaryDark: '#4C0047',
  primaryDeep: '#5A0C50',
  primarySoft: '#FFD7F3',
  primaryTint: '#FDF0FA',
  onPrimaryContainer: '#E884D7',
  gold: '#FFBE3B',
  goldDark: '#E5A824',
  goldSoft: '#FFF1D2',
  onGold: '#1A1A1A',
  goldText: '#7C5800',
  magenta: '#D81B60',
  magentaSoft: '#FFD9DE',
  wine: '#7C0032',
  success: '#0E9F6E',
  successSoft: '#DDF6EC',
  error: '#BA1A1A',
  errorSoft: '#FFDAD6',
  background: '#FCF9F8',
  surface: '#FFFFFF',
  surfaceLow: '#F6F3F2',
  surfaceMid: '#F0EDED',
  surfaceHigh: '#EAE7E7',
  text: '#1C1B1B',
  textMuted: '#51434D',
  textSubtle: '#6C757D',
  placeholder: '#9A8E96',
  border: '#E9E4E6',
  borderStrong: '#D5C1CD',
  outline: '#83727D',
  handle: '#D0D5DD',
  scrim: 'rgba(20, 10, 20, 0.55)',
  white: '#FFFFFF',
} as const;

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, sheet: 20, full: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const type = {
  headlineXl: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  headlineLg: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  headlineMd: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22 },
  bodyMd: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  price: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24 },
  priceStrike: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textDecorationLine: 'line-through',
  },
  labelLg: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  labelMd: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  labelSm: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

const shadow = (y: number, blur: number, opacity: number, color = '#000'): ViewStyle =>
  Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${y}px ${blur}px rgba(0,0,0,${opacity})` } as ViewStyle,
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
      elevation: Math.max(1, Math.round(blur / 3)),
    },
  })!;

export const elevation = {
  card: shadow(2, 8, 0.06, '#6B1464'),
  float: shadow(4, 14, 0.1),
  sheet: shadow(-6, 24, 0.14),
  nav: shadow(-2, 10, 0.05),
} as const;

/** Espacio inferior para que la tab bar y la barra flotante no tapen contenido. */
export const TAB_BAR_HEIGHT = 64;

/** En web la app se centra con ancho de teléfono. */
export const MAX_APP_WIDTH = 480;
